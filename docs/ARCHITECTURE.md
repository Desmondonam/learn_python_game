# PyQuest architecture

PyQuest is one Expo (React Native + TypeScript) codebase that ships to **Web, iOS and Android**.
Player code runs **on the device** in [Pyodide](https://pyodide.org) (CPython compiled to WebAssembly). No backend is involved.

```
┌──────────────────────── React Native / React DOM (UI thread) ────────────────────────┐
│  Mission Map · Level HUD · Codex · Profile         zustand store ⇄ AsyncStorage       │
│                    │                                                                 │
│  CodeRunner ──► validateSubmission() ──► pythonEngine.run()  (supervisor.ts)         │
│                    ▲   one run per scenario      │  queue · 3 s hard timeout · reboot │
│                    └──── RunResult JSON ◄────────┤                                   │
└──────────────────────────────────────────────────┼───────────────────────────────────┘
                                                   │ EngineTransport
                   ┌───────────────────────────────┴──────────────────────────────┐
         Web       │ new Worker(blob)                     iOS / Android            │
   PythonEngineHost.web.tsx                       PythonEngineHost.tsx             │
                   │                              hidden <WebView> ─► page relays  │
                   ▼                                 injectJavaScript / postMessage │
        ┌──────────────────────── Dedicated Web Worker ─────────────────────────┐  │
        │ importScripts(pyodide.js) → loadPyodide() → runPython(harness.py)     │◄─┘
        │ run_player(request_json) → result_json                                │
        └───────────────────────────────────────────────────────────────────────┘
```

## 1. Client-side Python engine

| File | Role |
|---|---|
| `src/engine/harness.py` | **Source of truth** for execution. It is a fresh namespace per run, with sensor inputs injected as globals, stdout/stderr captured and capped at 10k chars, `input()` disabled, a recursion limit, a soft timeout through `sys.settrace`, serialised variables, expression probes, and structured errors (type, line, offending source line, trimmed trace). |
| `scripts/build-harness.mjs` | Embeds `harness.py` into `harness.generated.ts`. It runs automatically before `start`/`web`/`ios`/`android`/`verify:levels`. |
| `src/engine/workerSource.ts` | The Worker script, shared by all platforms. It loads Pyodide `0.29.3` from jsDelivr and exposes `run_player`. |
| `src/engine/supervisor.ts` | `PythonEngine` serialises runs onto one worker, enforces the **3 s hard timeout**, and on timeout terminates the worker and boots a new one. `run()` always resolves and never rejects. Engine faults come back as `EngineError` results. |
| `src/engine/PythonEngineHost.web.tsx` | Web transport: a real `Worker` created from a Blob URL. |
| `src/engine/PythonEngineHost.tsx` + `nativeHostPage.ts` | iOS/Android transport. A 1×1 invisible `react-native-webview` loads a tiny HTML page, and that page spawns the **same Worker**. Messages travel through `injectJavaScript` (in) and `window.ReactNativeWebView.postMessage` (out). |
| `src/engine/humanizeError.ts` | Maps `IndentationError`, `NameError`, `TypeError` (concatenation, None, arity…), `IndexError`, `KeyError`, `TimeoutError` and others to a short title, a plain-English explanation and a concrete tip. The raw error stays one tap away. |

### Isolation and timeouts (three layers)

1. **Soft limit, 2.5 s, inside Python.** A `sys.settrace` hook checks the clock every 512 events and raises a private `BaseException` subclass. Because it isn't an `Exception`, `except Exception:` can't swallow it. Most runaway loops end here cleanly, with no reboot.
2. **Hard limit, 3 s, in the supervisor.** It runs on the UI thread, which is never blocked because Python runs in a worker. When it fires, the job resolves as `TimeoutError` and `worker.terminate()` kills even `while True: try: … except BaseException: pass`. A fresh worker boots straight away (~2–3 s, and Pyodide files come from the HTTP cache).
3. **Native backstop.** If the in-page restart doesn't report `ready` within 20 s, or the OS kills the WebView's content process (`onContentProcessDidTerminate` / `onRenderProcessGone`), the WebView is remounted.

Measured in Chrome against the production web build: boot ≈ 4–6 s on first launch, soft timeout 2.5 s, hard kill 3.0 s plus UI, and reboot ≈ 2.4 s.

### Setup notes

* Pyodide is fetched from `https://cdn.jsdelivr.net/pyodide/v0.29.3/full/` on first launch, and the HTTP cache keeps it after that. For **guaranteed offline** first launch, download that folder's `pyodide.js`, `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip` and `pyodide-lock.json`. Serve them from your own origin (web), or bundle them as assets and point `PYODIDE_INDEX_URL` at a local server or file URL (native). Then pass the new URL to `buildWorkerSource()`.
* Native needs a **development build**, not Expo Go, because `react-native-webview`, `expo-audio` and friends are native modules: `npx expo run:ios` / `npx expo run:android`, or `eas build --profile development`.
* The WebView page uses `baseUrl: https://pyquest.local/` so the document has a real origin. Blob workers and cross-origin `importScripts` both need that.
* Upgrading Pyodide means changing `PYODIDE_VERSION` in `workerSource.ts`. The harness only uses the standard library.

## 2. Level definitions (JSON schema)

* Schema: [`schema/curriculum.schema.json`](../schema/curriculum.schema.json) (JSON Schema 2020-12)
* Data: [`src/content/curriculum.json`](../src/content/curriculum.json): 5 worlds, 20 levels (10 live console, 5 code repair, 5 predict output)
* TypeScript mirror: [`src/content/types.ts`](../src/content/types.ts)

Every level shares these fields: `id`, `world`, `order`, `mechanic`, `title`, `concept`, `tags`, `xp`, `briefing`, `objective`, `hints[]`, and `careers{dataScience, softwareEngineering, webDevelopment}`. The rest depends on the mechanic:

| Mechanic | Extra fields | How it's validated |
|---|---|---|
| `live_console` | `starterCode`, `solution`, `scenarios?`, `tests[]` | The player's program is run once per scenario and every test is scored |
| `code_repair` | `template` with `{{blankId}}` slots, `blanks[{id, answers[]}]`, `tokenBank[]`, `scenarios?`, `tests[]` | The template is filled and run exactly like live_console, so **any fill that behaves correctly passes**, not only the listed answer |
| `predict_output` | `snippet`, `choices[]`, `answerIndex`, `explanation` | Checked locally against the marked choice. After solving, the player can run the snippet for real |

**Scenarios** are sets of "sensor inputs" injected as globals, for example `{"fuel": 50}`. Several scenarios per level stop players from hard-coding the expected output.

**Test kinds** (`tests[].kind`):

| kind | fields | passes when |
|---|---|---|
| `stdout_equals` | `expected` | normalised stdout matches exactly (trailing whitespace ignored) |
| `stdout_contains` | `expected` | stdout contains the text |
| `variable_equals` | `name`, `expected`, `tolerance?` | the global's value matches (sets order-insensitive, floats within tolerance, bool ≠ int) |
| `variable_type` | `name`, `expected` | `type(var).__name__` matches |
| `expression_equals` | `expr`, `expected` | `eval(expr)` after the run matches, which is how functions get tested |
| `no_error` | — | the program ran without raising |
| `code_matches` / `code_not_matches` | `pattern`, `flags?` | a regex over the source, e.g. "must use `for`" or "must not call `sum(`" |

Optional on any test: `scenario`, `hidden` (it shows as "Hidden check" until it passes), and `failHint`.

### Curriculum QA

`npm run verify:levels` (requires Python 3.10+ on PATH):
1. validates the JSON against the schema,
2. checks references (scenario ids, template placeholders against blanks, answers present in the token bank, regexes compile),
3. runs every reference solution through **the same validator and harness** under native CPython, and every test must pass,
4. confirms each `starterCode` does *not* already pass,
5. executes every predict-output snippet and confirms the marked choice is the real output.

## 3. Gameplay loop

`src/app/level/[id].tsx` drives the loop:

```
briefing → attempt ──► CodeRunner (validate) / PredictOutput (lock in)
              ├─ fail → fail SFX + haptic, failed-attempt count ↑ (persisted), test panel + humanized error,
              │         hint nudge after 2 failures. Engine faults don't count against the player.
              └─ pass → completeLevel():
                          stars  = 3 (first try, no hints) | 2 (≤2 fails & ≤1 hint) | 1
                          XP     = xp × stars/3; replays award only the improvement
                          streak = consecutive local calendar days with a clear
                          badges = evaluated from badges.ts predicates
                          unlock = next level (linear progression)
                       → Celebration (stars stamp in, XP counts up) → next / map / review
```

Persistence uses `zustand/persist` with AsyncStorage (`localStorage` on web) under the key `pyquest-progress`. It stores solved levels (best stars, XP earned, attempts, hints), XP, streak, badges, code drafts and settings.

## Project layout

```
src/app/                 Expo Router screens
  (tabs)/index.tsx         Mission Map
  (tabs)/codex.tsx         Career Path Codex
  (tabs)/profile.tsx       Player Profile
  level/[id].tsx           Level HUD + gameplay loop
src/components/runner/   CodeRunner, TestPanel, ConsolePanel
src/components/code/     CodeEditor, BlankFiller, CodeView, highlight
src/components/level/    PredictOutput, HintPanel, Celebration
src/engine/              harness.py, worker, supervisor, platform hosts, humanizeError
src/validator/           validateSubmission (pure TS, shared with scripts)
src/game/                stars/XP/streak/ranks, badges
src/store/               persisted progress store
src/content/             curriculum.json + loader + types
schema/                  curriculum.schema.json
scripts/                 build-harness.mjs, verify-levels.ts
assets/sfx/              synthesized retro sound effects
```
