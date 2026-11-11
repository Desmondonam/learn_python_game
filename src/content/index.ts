import raw from './curriculum.json';
import type { Curriculum, Level, World } from './types';

export const curriculum = raw as unknown as Curriculum;

export const worlds: World[] = [...curriculum.worlds].sort((a, b) => a.id - b.id);

/** All levels in play order (world, then order). */
export const levels: Level[] = [...curriculum.levels].sort((a, b) => a.world - b.world || a.order - b.order);

const byId = new Map(levels.map((l) => [l.id, l]));

export function getLevel(id: string): Level | undefined {
  return byId.get(id);
}

export function getWorld(id: number): World | undefined {
  return worlds.find((w) => w.id === id);
}

export function levelsInWorld(worldId: number): Level[] {
  return levels.filter((l) => l.world === worldId);
}

export function nextLevel(id: string): Level | undefined {
  const i = levels.findIndex((l) => l.id === id);
  return i >= 0 ? levels[i + 1] : undefined;
}

export function previousLevel(id: string): Level | undefined {
  const i = levels.findIndex((l) => l.id === id);
  return i > 0 ? levels[i - 1] : undefined;
}

export const MECHANIC_LABEL: Record<Level['mechanic'], string> = {
  code_repair: 'CODE REPAIR',
  live_console: 'LIVE CONSOLE',
  predict_output: 'PREDICT OUTPUT',
};
