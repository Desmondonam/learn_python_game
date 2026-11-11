import {
  engineFailure,
  type EngineStatus,
  type RunRequest,
  type RunResult,
  type WorkerInbound,
  type WorkerOutbound,
} from './types';

/**
 * A platform-specific channel to a Pyodide worker.
 *  - WebWorkerTransport (web): a real Web Worker.
 *  - WebViewTransport (iOS/Android): a Worker living inside a hidden WebView.
 */
export interface EngineTransport {
  start(onMessage: (msg: WorkerOutbound) => void): void;
  send(msg: WorkerInbound): void;
  /** Hard kill the worker and boot a fresh one. Must eventually emit 'ready'. */
  restart(): void;
  dispose(): void;
}

export const HARD_TIMEOUT_MS = 3000;
/** Cooperative limit inside Python. Lower than the hard limit so most runaway
 * loops end cleanly without paying for a full Pyodide reboot. */
export const SOFT_TIMEOUT_SEC = 2.5;
const BOOT_TIMEOUT_MS = 60_000;

interface Job {
  id: number;
  request: RunRequest;
  timeoutMs: number;
  resolve: (r: RunResult) => void;
  timer?: ReturnType<typeof setTimeout>;
}

type Listener = (status: EngineStatus) => void;

/**
 * Serialises runs onto a single worker and enforces the 3 s hard timeout.
 * Every run() resolves, never rejects: engine problems come back as a
 * RunResult with an `EngineError`/`TimeoutError` so the UI has one code path.
 */
export class PythonEngine {
  private transport: EngineTransport | null = null;
  private status: EngineStatus = 'idle';
  private queue: Job[] = [];
  private current: Job | null = null;
  private nextId = 1;
  private bootTimer?: ReturnType<typeof setTimeout>;
  private listeners = new Set<Listener>();
  public pyodideVersion: string | null = null;
  public lastBootError: string | null = null;

  attach(transport: EngineTransport) {
    this.detach();
    this.transport = transport;
    this.setStatus('booting');
    this.armBootTimer();
    transport.start((msg) => this.onMessage(msg));
  }

  detach() {
    if (!this.transport) return;
    this.transport.dispose();
    this.transport = null;
    this.clearBootTimer();
    this.failAll('EngineError', 'The Python engine was shut down.');
    this.setStatus('idle');
  }

  getStatus() {
    return this.status;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  run(request: RunRequest, timeoutMs = HARD_TIMEOUT_MS): Promise<RunResult> {
    return new Promise((resolve) => {
      const job: Job = {
        id: this.nextId++,
        request: { softTimeoutSec: SOFT_TIMEOUT_SEC, ...request },
        timeoutMs,
        resolve,
      };
      this.queue.push(job);
      if (this.status === 'error' && this.transport) this.reboot();
      else if (!this.transport) {
        // No host mounted yet; keep queued. attach() will drain it.
      }
      this.pump();
    });
  }

  /** Bound function form, handy to pass around as a PythonRunner. */
  runner = (request: RunRequest) => this.run(request);

  // ---------------------------------------------------------------------

  private onMessage(msg: WorkerOutbound) {
    switch (msg.type) {
      case 'ready':
        this.clearBootTimer();
        this.pyodideVersion = msg.version;
        this.lastBootError = null;
        this.setStatus('ready');
        this.pump();
        break;
      case 'boot_error':
        this.clearBootTimer();
        this.lastBootError = msg.message;
        this.setStatus('error');
        this.failAll(
          'EngineError',
          'The Python engine could not start. The first launch needs an internet connection to download it.',
        );
        break;
      case 'result': {
        const job = this.current;
        if (!job || job.id !== msg.id) return; // stale result from a killed run
        clearTimeout(job.timer);
        this.current = null;
        this.setStatus('ready');
        job.resolve(this.parse(msg));
        this.pump();
        break;
      }
    }
  }

  private parse(msg: Extract<WorkerOutbound, { type: 'result' }>): RunResult {
    if (msg.fatal || !msg.payload) return engineFailure('EngineError', msg.fatal ?? 'Empty result from engine');
    try {
      return JSON.parse(msg.payload) as RunResult;
    } catch {
      return engineFailure('EngineError', 'Malformed result from engine');
    }
  }

  private pump() {
    if (this.status !== 'ready' || this.current || !this.transport) return;
    const job = this.queue.shift();
    if (!job) return;
    this.current = job;
    this.setStatus('busy');
    job.timer = setTimeout(() => this.onHardTimeout(job), job.timeoutMs);
    this.transport.send({ type: 'run', id: job.id, request: job.request });
  }

  private onHardTimeout(job: Job) {
    if (this.current !== job) return;
    this.current = null;
    job.resolve(
      engineFailure('TimeoutError', `Program ran longer than ${job.timeoutMs / 1000}s`, {
        timedOut: true,
        durationMs: job.timeoutMs,
      }),
    );
    this.reboot();
  }

  private reboot() {
    if (!this.transport) return;
    this.setStatus('restarting');
    this.armBootTimer();
    this.transport.restart();
  }

  private armBootTimer() {
    this.clearBootTimer();
    this.bootTimer = setTimeout(() => {
      this.lastBootError = 'Boot timed out';
      this.setStatus('error');
      this.failAll('EngineError', 'The Python engine took too long to start. Check your connection and retry.');
    }, BOOT_TIMEOUT_MS);
  }

  private clearBootTimer() {
    if (this.bootTimer) clearTimeout(this.bootTimer);
    this.bootTimer = undefined;
  }

  private failAll(type: string, message: string) {
    const jobs = this.current ? [this.current, ...this.queue] : [...this.queue];
    this.current = null;
    this.queue = [];
    for (const job of jobs) {
      clearTimeout(job.timer);
      job.resolve(engineFailure(type, message));
    }
  }

  private setStatus(s: EngineStatus) {
    if (this.status === s) return;
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }
}

/** App-wide singleton. A platform host component attaches the transport. */
export const pythonEngine = new PythonEngine();
