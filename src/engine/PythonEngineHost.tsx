import { useEffect, useState, useSyncExternalStore, type ComponentType, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { buildNativeHostPage } from './nativeHostPage';
import { pythonEngine, type EngineTransport } from './supervisor';
import type { WorkerInbound, WorkerOutbound } from './types';

/**
 * react-native-webview 14's props intersection (iOS & Android & Windows) collapses to `never`
 * under React Native 0.88's types. Re-declare just the props we use.
 */
type HostWebViewProps = {
  ref?: Ref<WebView>;
  originWhitelist: string[];
  source: { html: string; baseUrl: string };
  javaScriptEnabled: boolean;
  onMessage: (e: WebViewMessageEvent) => void;
  onContentProcessDidTerminate: () => void;
  onRenderProcessGone: () => void;
};
const HostWebView = WebView as unknown as ComponentType<HostWebViewProps>;

/** If the in-page restart doesn't produce 'ready' in time, remount the WebView. */
const RESTART_BACKSTOP_MS = 20_000;

/**
 * iOS / Android: Pyodide runs in a Web Worker inside an invisible WebView.
 * React Native's JS thread is never blocked by player code.
 */
class WebViewTransport implements EngineTransport {
  private onMessage: (msg: WorkerOutbound) => void = () => {};
  private backstop?: ReturnType<typeof setTimeout>;
  private webView: WebView | null = null;
  /** Bumped to remount the WebView (kills page + worker). Observed via useSyncExternalStore. */
  private generation = 0;
  private listeners = new Set<() => void>();

  subscribe = (cb: () => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getGeneration = () => this.generation;

  remount() {
    this.generation++;
    this.listeners.forEach((cb) => cb());
  }

  /** Callback ref target for the WebView. */
  setWebView = (instance: WebView | null) => {
    this.webView = instance;
  };

  start(onMessage: (msg: WorkerOutbound) => void) {
    this.onMessage = onMessage;
  }

  /** Called by the host component for every message coming out of the WebView. */
  receive(raw: string) {
    let msg: WorkerOutbound;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'ready' && this.backstop) {
      clearTimeout(this.backstop);
      this.backstop = undefined;
    }
    this.onMessage(msg);
  }

  send(msg: WorkerInbound) {
    this.webView?.injectJavaScript(`window.__pq && window.__pq.post(${JSON.stringify(msg)}); true;`);
  }

  restart() {
    this.webView?.injectJavaScript('window.__pq && window.__pq.restart(); true;');
    if (this.backstop) clearTimeout(this.backstop);
    this.backstop = setTimeout(() => this.remount(), RESTART_BACKSTOP_MS);
  }

  /** The WebView's web content process died (OS memory pressure, etc). */
  processGone() {
    this.remount();
  }

  dispose() {
    if (this.backstop) clearTimeout(this.backstop);
  }
}

/** One engine per app, so the transport is a module-level singleton. */
const transport = new WebViewTransport();
const attachWebView = (instance: WebView | null) => transport.setWebView(instance);

export function PythonEngineHost() {
  const [html] = useState(buildNativeHostPage);
  const generation = useSyncExternalStore(transport.subscribe, transport.getGeneration);

  useEffect(() => {
    pythonEngine.attach(transport);
    return () => pythonEngine.detach();
  }, []);

  return (
    <View style={styles.hidden} pointerEvents="none">
      <HostWebView
        key={generation}
        ref={attachWebView}
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://pyquest.local/' }}
        javaScriptEnabled
        onMessage={(e: WebViewMessageEvent) => transport.receive(e.nativeEvent.data)}
        onContentProcessDidTerminate={() => transport.processGone()}
        onRenderProcessGone={() => transport.processGone()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
});
