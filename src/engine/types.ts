/** Shapes shared by the harness (Python), the worker, the supervisor and the validator. */

export interface PyValue {
  /** Python type name: "int", "str", "list", "dict", "function", ... */
  type: string;
  /** Plain-JSON projection of the value (sets are sorted, tuples become arrays). */
  value: unknown;
  /** Python repr(), truncated. */
  repr: string;
  /** True when the variable was injected as a sensor input. */
  isInput?: boolean;
}

export interface PyError {
  type: string;
  message: string;
  line: number | null;
  column?: number | null;
  lineText?: string | null;
  /** NameError/AttributeError name, or KeyError key repr. */
  name?: string | null;
  trace?: { line: number; function: string }[];
}

export interface ProbeResult {
  expr: string;
  ok: boolean;
  value: PyValue | null;
  error: PyError | null;
  stdout: string;
}

export interface RunRequest {
  code: string;
  inputs?: Record<string, unknown>;
  probes?: string[];
  softTimeoutSec?: number;
}

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  outputTruncated: boolean;
  error: PyError | null;
  timedOut: boolean;
  variables: Record<string, PyValue>;
  probes: ProbeResult[];
  durationMs: number;
}

/** Anything that can execute Python: the in-app engine, or CPython in scripts. */
export type PythonRunner = (req: RunRequest) => Promise<RunResult>;

// ---- Worker wire protocol -------------------------------------------------

export type WorkerInbound = { type: 'run'; id: number; request: RunRequest };

export type WorkerOutbound =
  | { type: 'ready'; version: string }
  | { type: 'boot_error'; message: string }
  | { type: 'result'; id: number; payload?: string; fatal?: string };

export type EngineStatus = 'idle' | 'booting' | 'ready' | 'busy' | 'restarting' | 'error';

export function engineFailure(type: string, message: string, extra: Partial<RunResult> = {}): RunResult {
  return {
    ok: false,
    stdout: '',
    stderr: '',
    outputTruncated: false,
    error: { type, message, line: null },
    timedOut: false,
    variables: {},
    probes: [],
    durationMs: 0,
    ...extra,
  };
}
