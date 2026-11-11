import { buildWorkerSource } from './workerSource';

/**
 * HTML loaded into the hidden WebView on iOS/Android.
 *
 * The page itself does no Python work. It only:
 *   1. spawns the Pyodide worker from a Blob URL,
 *   2. relays worker messages to React Native (window.ReactNativeWebView.postMessage),
 *   3. exposes window.__pq.post / window.__pq.restart for injectJavaScript.
 *
 * Because Python runs in a worker, this page's main thread stays responsive
 * even during an infinite loop, so restart() can always terminate the worker.
 */
export function buildNativeHostPage(): string {
  const workerSrc = JSON.stringify(buildWorkerSource());
  return `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
(function () {
  var send = function (obj) { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); };
  var url = URL.createObjectURL(new Blob([${workerSrc}], { type: "text/javascript" }));
  var worker = null;
  function spawn() {
    worker = new Worker(url);
    worker.onmessage = function (e) { send(e.data); };
    worker.onerror = function (e) { send({ type: "boot_error", message: (e && e.message) || "Worker error" }); };
  }
  window.__pq = {
    post: function (msg) { if (worker) worker.postMessage(msg); },
    restart: function () { if (worker) worker.terminate(); spawn(); }
  };
  if (typeof Worker === "undefined") {
    send({ type: "boot_error", message: "Web Workers are not supported in this WebView" });
  } else {
    spawn();
  }
})();
</script>
</body></html>`;
}
