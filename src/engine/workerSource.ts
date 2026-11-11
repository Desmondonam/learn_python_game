import { HARNESS_SOURCE } from './harness.generated';

export const PYODIDE_VERSION = '0.29.3';
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/**
 * Source of the dedicated Web Worker that hosts Pyodide.
 *
 * The same string is used on every platform:
 *  - Web:     new Worker(blobUrl) directly in the page.
 *  - Native:  new Worker(blobUrl) inside a hidden WebView (see nativeHostPage.ts).
 *
 * Running Python in a worker keeps the UI thread free and gives the host a
 * real kill switch: worker.terminate() stops even a `while True: pass`.
 */
export function buildWorkerSource(indexUrl: string = PYODIDE_INDEX_URL): string {
  return `
"use strict";
const INDEX_URL = ${JSON.stringify(indexUrl)};
const HARNESS = ${JSON.stringify(HARNESS_SOURCE)};
let runPlayer = null;

async function boot() {
  importScripts(INDEX_URL + "pyodide.js");
  const pyodide = await loadPyodide({
    indexURL: INDEX_URL,
    stdout: function () {},
    stderr: function () {},
  });
  pyodide.runPython(HARNESS);
  runPlayer = pyodide.globals.get("run_player");
  self.postMessage({ type: "ready", version: pyodide.version });
}

const booted = boot().catch(function (err) {
  self.postMessage({ type: "boot_error", message: String((err && err.message) || err) });
});

self.onmessage = async function (event) {
  const msg = event.data;
  if (!msg || msg.type !== "run") return;
  await booted;
  if (!runPlayer) {
    self.postMessage({ type: "result", id: msg.id, fatal: "Python engine failed to boot" });
    return;
  }
  try {
    const payload = runPlayer(JSON.stringify(msg.request));
    self.postMessage({ type: "result", id: msg.id, payload: payload });
  } catch (err) {
    self.postMessage({ type: "result", id: msg.id, fatal: String((err && err.message) || err) });
  }
};
`;
}
