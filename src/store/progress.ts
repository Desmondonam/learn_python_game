import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { getLevel, nextLevel } from '../content';
import { BADGES } from '../game/badges';
import { bumpStreak, starsFor, xpFor, type LevelProgress, type StreakState } from '../game/progression';

export interface CompletionOutcome {
  stars: number;
  previousStars: number;
  xpGained: number;
  newBadges: string[];
  firstClear: boolean;
  unlockedLevelId: string | null;
}

interface ProgressState {
  solved: Record<string, LevelProgress>;
  /** Failed attempts on levels not yet cleared (kept so leaving mid-level doesn't reset stars). */
  pendingAttempts: Record<string, number>;
  xp: number;
  streak: StreakState;
  /** badgeId -> ISO timestamp */
  badges: Record<string, string>;
  /** Unsubmitted editor contents per level (code, or JSON of blank fills). */
  drafts: Record<string, string>;
  soundOn: boolean;
  hapticsOn: boolean;

  completeLevel: (levelId: string, run: { failedAttempts: number; hintsUsed: number }) => CompletionOutcome;
  recordFailedAttempt: (levelId: string) => void;
  setDraft: (levelId: string, draft: string | null) => void;
  setSound: (on: boolean) => void;
  setHaptics: (on: boolean) => void;
  resetProgress: () => void;
}

const initial = {
  solved: {},
  pendingAttempts: {},
  xp: 0,
  streak: { current: 0, best: 0, lastDay: null } as StreakState,
  badges: {},
  drafts: {} as Record<string, string>,
};

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      ...initial,
      soundOn: true,
      hapticsOn: true,

      recordFailedAttempt: (levelId) =>
        set((s) => ({ pendingAttempts: { ...s.pendingAttempts, [levelId]: (s.pendingAttempts[levelId] ?? 0) + 1 } })),

      completeLevel: (levelId, { failedAttempts, hintsUsed }) => {
        const level = getLevel(levelId);
        const s = get();
        const prev = s.solved[levelId];
        const stars = starsFor(failedAttempts, hintsUsed);
        const bestStars = Math.max(stars, prev?.stars ?? 0);
        const xpTarget = xpFor(level?.xp ?? 0, bestStars);
        const xpGained = Math.max(0, xpTarget - (prev?.xpEarned ?? 0));

        const solved: Record<string, LevelProgress> = {
          ...s.solved,
          [levelId]: {
            stars: bestStars,
            xpEarned: Math.max(xpTarget, prev?.xpEarned ?? 0),
            attempts: (prev?.attempts ?? 0) + failedAttempts + 1,
            hintsUsed: prev ? Math.min(prev.hintsUsed, hintsUsed) : hintsUsed,
            firstClearedAt: prev?.firstClearedAt ?? new Date().toISOString(),
          },
        };
        const xp = s.xp + xpGained;
        const streak = bumpStreak(s.streak);

        const ctx = { solved, xp, streak };
        const now = new Date().toISOString();
        const newBadges = BADGES.filter((b) => !s.badges[b.id] && b.earned(ctx)).map((b) => b.id);
        const badges = { ...s.badges, ...Object.fromEntries(newBadges.map((id) => [id, now])) };

        const { [levelId]: _cleared, ...pendingAttempts } = s.pendingAttempts;
        set({ solved, xp, streak, badges, pendingAttempts });

        const next = nextLevel(levelId);
        return {
          stars,
          previousStars: prev?.stars ?? 0,
          xpGained,
          newBadges,
          firstClear: !prev,
          unlockedLevelId: !prev && next ? next.id : null,
        };
      },

      setDraft: (levelId, draft) =>
        set((s) => {
          const { [levelId]: _old, ...rest } = s.drafts;
          return { drafts: draft === null ? rest : { ...rest, [levelId]: draft } };
        }),

      setSound: (soundOn) => set({ soundOn }),
      setHaptics: (hapticsOn) => set({ hapticsOn }),
      resetProgress: () => set({ ...initial, streak: { current: 0, best: 0, lastDay: null } }),
    }),
    {
      name: 'pyquest-progress',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ solved, pendingAttempts, xp, streak, badges, drafts, soundOn, hapticsOn }) => ({
        solved,
        pendingAttempts,
        xp,
        streak,
        badges,
        drafts,
        soundOn,
        hapticsOn,
      }),
    },
  ),
);

/** True once persisted progress has been loaded from disk. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    (cb) => useProgress.persist.onFinishHydration(cb),
    () => useProgress.persist.hasHydrated(),
    () => false,
  );
}
