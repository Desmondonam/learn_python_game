"""PyQuest execution harness.

This file is the single source of truth for how player code is executed.
It runs unchanged in two places:

  * In the app: inside Pyodide (CPython compiled to WebAssembly) running in a
    Web Worker. `scripts/build-harness.mjs` embeds it into
    `src/engine/harness.generated.ts`, and the worker calls `run_player()`.
  * In CI / authoring: under native CPython via `scripts/verify-levels.ts`,
    which pipes a JSON request to `python harness.py` on stdin.

Protocol: `run_player(request_json) -> result_json`

  request = {
    "code": str,                      # the player's program
    "inputs": {name: json_value},     # "sensor inputs" injected as globals
    "probes": [str],                  # expressions evaluated after the run
    "softTimeoutSec": float,          # cooperative time limit (default 2.5s)
  }

Isolation layers (outermost first):
  1. Hard kill: the host terminates the whole worker after 3s (see supervisor.ts).
  2. Soft limit: a sys.settrace hook raises inside the player's frame once the
     deadline passes, so most infinite loops end cleanly with no reboot.
  3. Fresh namespace per run, capped stdout/stderr, recursion limit, input()
     disabled.
"""

import builtins
import io
import json
import math
import sys
import time

MAX_OUTPUT_CHARS = 10_000
MAX_VARIABLES = 60
MAX_REPR = 300
RECURSION_LIMIT = 400
PLAYER_FILE = "<player>"


class _Timeout(BaseException):
    """Raised by the tracer. BaseException so `except Exception:` can't swallow it."""


class _CappedBuffer(io.StringIO):
    def __init__(self, limit=MAX_OUTPUT_CHARS):
        super().__init__()
        self._limit = limit
        self._size = 0
        self.truncated = False

    def write(self, s):
        if self._size >= self._limit:
            self.truncated = True
            return len(s)
        room = self._limit - self._size
        chunk = s if len(s) <= room else s[:room]
        if len(chunk) < len(s):
            self.truncated = True
        self._size += len(chunk)
        super().write(chunk)
        return len(s)


def _make_tracer(deadline):
    counter = [0]

    def tracer(frame, event, arg):
        counter[0] += 1
        # Checking the clock on every event is slow; every 512 events is plenty.
        if counter[0] & 0x1FF == 0 and time.monotonic() > deadline:
            raise _Timeout()
        return tracer

    return tracer


def _disabled_input(*_args, **_kwargs):
    raise RuntimeError(
        "input() is not available in PyQuest. Your data arrives as sensor inputs "
        "(pre-loaded variables) instead."
    )


def _player_builtins():
    b = dict(builtins.__dict__)
    b["input"] = _disabled_input
    return b


def _to_json(value, depth=0):
    """Convert a Python value to plain JSON (lossy but deterministic)."""
    if depth > 6:
        return repr(value)
    if value is None or isinstance(value, (bool, str)):
        return value
    if isinstance(value, int):
        return value if abs(value) < 2**53 else repr(value)
    if isinstance(value, float):
        return value if math.isfinite(value) else repr(value)
    if isinstance(value, (list, tuple)):
        return [_to_json(v, depth + 1) for v in value]
    if isinstance(value, (set, frozenset)):
        return [_to_json(v, depth + 1) for v in sorted(value, key=repr)]
    if isinstance(value, dict):
        return {
            (k if isinstance(k, str) else repr(k)): _to_json(v, depth + 1)
            for k, v in value.items()
        }
    return repr(value)


def _describe(value):
    try:
        r = repr(value)
    except Exception:  # a hostile __repr__ shouldn't crash the harness
        r = "<unrepresentable>"
    if len(r) > MAX_REPR:
        r = r[: MAX_REPR - 3] + "..."
    kind = type(value).__name__
    if callable(value) and not isinstance(value, type):
        return {"type": kind, "value": None, "repr": r}
    return {"type": kind, "value": _to_json(value), "repr": r}


def _error_info(exc, code_lines):
    info = {
        "type": type(exc).__name__,
        "message": str(exc),
        "line": None,
        "column": None,
        "lineText": None,
        "name": None,
        "trace": [],
    }
    if isinstance(exc, SyntaxError):
        info["message"] = exc.msg or str(exc)
        if exc.filename == PLAYER_FILE or exc.filename is None:
            info["line"] = exc.lineno
            info["column"] = exc.offset
    else:
        tb = exc.__traceback__
        while tb is not None:
            code = tb.tb_frame.f_code
            if code.co_filename == PLAYER_FILE:
                info["line"] = tb.tb_lineno
                info["trace"].append({"line": tb.tb_lineno, "function": code.co_name})
            tb = tb.tb_next
        if len(info["trace"]) > 8:  # deep recursion: keep the ends, drop the middle
            info["trace"] = info["trace"][:4] + info["trace"][-4:]
    if isinstance(exc, (NameError, AttributeError)):
        info["name"] = getattr(exc, "name", None)
    if isinstance(exc, KeyError) and exc.args:
        info["name"] = repr(exc.args[0])
        info["message"] = repr(exc.args[0])
    line = info["line"]
    if line and 1 <= line <= len(code_lines):
        info["lineText"] = code_lines[line - 1]
    return info


def _timeout_error(limit):
    return {
        "type": "TimeoutError",
        "message": f"Program ran longer than {limit:g}s",
        "line": None,
        "column": None,
        "lineText": None,
        "name": None,
        "trace": [],
    }


def _collect_variables(ns, input_names):
    out = {}
    for name, value in ns.items():
        if name.startswith("_") or name in ("__builtins__",):
            continue
        if type(value).__name__ == "module":
            continue
        out[name] = _describe(value)
        out[name]["isInput"] = name in input_names
        if len(out) >= MAX_VARIABLES:
            break
    return out


def run_player(request_json):
    req = json.loads(request_json)
    code = req.get("code", "")
    inputs = req.get("inputs") or {}
    probes = req.get("probes") or []
    soft_timeout = float(req.get("softTimeoutSec", 2.5))

    code_lines = code.split("\n")
    stdout = _CappedBuffer()
    stderr = _CappedBuffer()
    ns = {"__name__": "__main__", "__builtins__": _player_builtins()}
    ns.update(inputs)

    result = {
        "ok": True,
        "stdout": "",
        "stderr": "",
        "outputTruncated": False,
        "error": None,
        "timedOut": False,
        "variables": {},
        "probes": [],
        "durationMs": 0,
    }

    saved_out, saved_err = sys.stdout, sys.stderr
    saved_limit = sys.getrecursionlimit()
    started = time.monotonic()
    deadline = started + soft_timeout
    try:
        sys.stdout, sys.stderr = stdout, stderr
        try:
            compiled = compile(code, PLAYER_FILE, "exec")
        except SyntaxError as exc:  # includes IndentationError / TabError
            result["ok"] = False
            result["error"] = _error_info(exc, code_lines)
            compiled = None

        if compiled is not None:
            sys.setrecursionlimit(RECURSION_LIMIT)
            sys.settrace(_make_tracer(deadline))
            try:
                exec(compiled, ns)
            except _Timeout:
                result["ok"] = False
                result["timedOut"] = True
                result["error"] = _timeout_error(soft_timeout)
            except BaseException as exc:  # SystemExit etc. are reported, not raised
                result["ok"] = False
                result["error"] = _error_info(exc, code_lines)
            finally:
                sys.settrace(None)

        for expr in probes:
            probe = {"expr": expr, "ok": False, "value": None, "error": None, "stdout": ""}
            if not result["ok"]:
                probe["error"] = {"type": "Skipped", "message": "program crashed before checks ran"}
                result["probes"].append(probe)
                continue
            probe_out = _CappedBuffer()
            sys.stdout = probe_out
            sys.settrace(_make_tracer(deadline))
            try:
                value = eval(compile(expr, "<check>", "eval"), ns)
                probe["ok"] = True
                probe["value"] = _describe(value)
            except _Timeout:
                probe["error"] = _timeout_error(soft_timeout)
            except BaseException as exc:
                probe["error"] = _error_info(exc, code_lines)
            finally:
                sys.settrace(None)
                sys.stdout = stdout
            probe["stdout"] = probe_out.getvalue()
            result["probes"].append(probe)
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr = saved_out, saved_err
        sys.setrecursionlimit(saved_limit)

    result["stdout"] = stdout.getvalue()
    result["stderr"] = stderr.getvalue()
    result["outputTruncated"] = stdout.truncated or stderr.truncated
    result["variables"] = _collect_variables(ns, set(inputs))
    result["durationMs"] = round((time.monotonic() - started) * 1000, 2)
    return json.dumps(result)


if __name__ == "__main__" and sys.platform != "emscripten":
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stdout.write(run_player(sys.stdin.read()))
