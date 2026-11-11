import { useEffect } from 'react';
import { pythonEngine, type EngineTransport } from './supervisor';
import type { WorkerOutbound } from './types';
import { buildWorkerSource } from './workerSource';

/** Web: Pyodide runs in a dedicated Web Worker created from a Blob URL. */
class WebWorkerTransport implements EngineTransport {
  private worker: Worker | null = null;
  private url: string;
  private onMessage: (msg: WorkerOutbound) => void = () => {};

  constructor() {
    const blob = new Blob([buildWorkerSource()], { type: 'text/javascript' });
    this.url = URL.createObjectURL(blob);
  }

  start(onMessage: (msg: WorkerOutbound) => void) {
    this.onMessage = onMessage;
    this.spawn();
  }

  private spawn() {
    const w = new Worker(this.url);
    w.onmessage = (e: MessageEvent<WorkerOutbound>) => this.onMessage(e.data);
    w.onerror = (e) => this.onMessage({ type: 'boot_error', message: e.message || 'Worker error' });
    this.worker = w;
  }

  send(msg: Parameters<EngineTransport['send']>[0]) {
    this.worker?.postMessage(msg);
  }

  restart() {
    this.worker?.terminate();
    this.spawn();
  }

  dispose() {
    this.worker?.terminate();
    this.worker = null;
    URL.revokeObjectURL(this.url);
  }
}

export function PythonEngineHost() {
  useEffect(() => {
    pythonEngine.attach(new WebWorkerTransport());
    return () => pythonEngine.detach();
  }, []);
  return null;
}
