import { levels } from '../content';

export interface LevelProgress {
  /** Best stars earned (1–3). */
  stars: number;
  /** XP already awarded for this level (best run). */
  xpEarned: number;
  attempts: number;
  hintsUsed: number;
  firstClearedAt: string;
}

export interface StreakState {
  current: number;
  best: number;
  /** Local calendar day (YYYY-MM-DD) of the last cleared level. */
  lastDay: string | null;
}

/**
 * Stars for a clear:
 *   ★★★  first try, no hints
 *   ★★☆  at most 2 failed attempts and at most 1 hint
 *   ★☆☆  anything else
 */
export function starsFor(failedAttempts: number, hintsUsed: number): number {
  if (failedAttempts === 0 && hintsUsed === 0) return 3;
  if (failedAttempts <= 2 && hintsUsed <= 1) return 2;
  return 1;
}

export function xpFor(baseXp: number, stars: number): number {
  return Math.round((baseXp * stars) / 3);
}

/** Linear progression: a level is open if it's the first, or the previous one is cleared. */
export function isUnlocked(levelId: string, solved: Record<string, LevelProgress>): boolean {
  const i = levels.findIndex((l) => l.id === levelId);
  if (i <= 0) return i === 0;
  return !!solved[levels[i - 1].id];
}

export function localDay(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

export function bumpStreak(s: StreakState, today = localDay()): StreakState {
  if (s.lastDay === today) return s;
  const current = s.lastDay && dayDiff(s.lastDay, today) === 1 ? s.current + 1 : 1;
  return { current, best: Math.max(s.best, current), lastDay: today };
}

/** Streak as displayed: it lapses to 0 if you skipped a whole day. */
export function liveStreak(s: StreakState, today = localDay()): number {
  if (!s.lastDay) return 0;
  return dayDiff(s.lastDay, today) <= 1 ? s.current : 0;
}

export const RANKS = [
  { xp: 0, title: 'Script Kiddie' },
  { xp: 200, title: 'Junior Operator' },
  { xp: 600, title: 'Signal Engineer' },
  { xp: 1100, title: 'Systems Architect' },
  { xp: 1700, title: 'Grid Sentinel' },
  { xp: 2300, title: 'Python Prime' },
];

export function rankFor(xp: number) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  return {
    title: RANKS[i].title,
    level: i + 1,
    floor: RANKS[i].xp,
    next: next?.xp ?? null,
    progress: next ? (xp - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1,
  };
}
