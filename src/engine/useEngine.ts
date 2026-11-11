import { useSyncExternalStore } from 'react';
import { pythonEngine } from './supervisor';
import type { EngineStatus } from './types';

export function useEngineStatus(): EngineStatus {
  return useSyncExternalStore(
    (cb) => pythonEngine.subscribe(cb),
    () => pythonEngine.getStatus(),
    () => pythonEngine.getStatus(),
  );
}

export { pythonEngine };
