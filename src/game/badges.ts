import { levels, levelsInWorld, worlds } from '../content';
import type { LevelProgress, StreakState } from './progression';

export interface BadgeContext {
  solved: Record<string, LevelProgress>;
  xp: number;
  streak: StreakState;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
  earned: (c: BadgeContext) => boolean;
}

const worldComplete = (id: number) => (c: BadgeContext) => levelsInWorld(id).every((l) => c.solved[l.id]);

const WORLD_BADGE_NAMES: Record<number, [string, string]> = {
  1: ['Telemetry Certified', 'chip'],
  2: ['Logic Gatekeeper', 'source-branch'],
  3: ['Vault Keeper', 'database'],
  4: ['Automaton', 'cog-sync'],
  5: ['Module Architect', 'puzzle'],
};

export const BADGES: BadgeDef[] = [
  {
    id: 'first-boot',
    name: 'First Boot',
    description: 'Clear your first mission.',
    icon: 'power',
    earned: (c) => Object.keys(c.solved).length >= 1,
  },
  ...worlds.map<BadgeDef>((w) => ({
    id: `world-${w.id}`,
    name: WORLD_BADGE_NAMES[w.id]?.[0] ?? `${w.codename} Cleared`,
    description: `Clear every mission in ${w.codename}.`,
    icon: WORLD_BADGE_NAMES[w.id]?.[1] ?? 'flag-checkered',
    earned: worldComplete(w.id),
  })),
  {
    id: 'flawless-5',
    name: 'Flawless Execution',
    description: 'Earn 3 stars on 5 missions.',
    icon: 'star-shooting',
    earned: (c) => Object.values(c.solved).filter((p) => p.stars === 3).length >= 5,
  },
  {
    id: 'ghost-protocol',
    name: 'Ghost Protocol',
    description: 'Clear an entire world without revealing a single hint.',
    icon: 'incognito',
    earned: (c) => worlds.some((w) => levelsInWorld(w.id).every((l) => c.solved[l.id] && c.solved[l.id].hintsUsed === 0)),
  },
  {
    id: 'oracle',
    name: 'Oracle',
    description: 'Ace every Predict Output mission with 3 stars.',
    icon: 'crystal-ball',
    earned: (c) => levels.filter((l) => l.mechanic === 'predict_output').every((l) => c.solved[l.id]?.stars === 3),
  },
  {
    id: 'streak-3',
    name: 'Uptime ×3',
    description: 'Keep a 3-day streak.',
    icon: 'fire',
    earned: (c) => c.streak.best >= 3,
  },
  {
    id: 'kilobyte',
    name: 'Kilobyte',
    description: 'Earn 1,000 XP.',
    icon: 'lightning-bolt',
    earned: (c) => c.xp >= 1000,
  },
  {
    id: 'python-prime',
    name: 'Python Prime',
    description: 'Clear every mission with 3 stars.',
    icon: 'crown',
    earned: (c) => levels.every((l) => c.solved[l.id]?.stars === 3),
  },
];

export function getBadge(id: string) {
  return BADGES.find((b) => b.id === id);
}
