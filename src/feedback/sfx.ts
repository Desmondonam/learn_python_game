import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useProgress } from '../store/progress';

const SOURCES = {
  success: require('../../assets/sfx/success.wav'),
  fail: require('../../assets/sfx/fail.wav'),
  unlock: require('../../assets/sfx/unlock.wav'),
  click: require('../../assets/sfx/click.wav'),
  hint: require('../../assets/sfx/hint.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

/** Players are app-lifetime singletons, created lazily on first use. */
const players: Partial<Record<Sfx, AudioPlayer>> = {};

function player(name: Sfx): AudioPlayer | null {
  try {
    players[name] ??= createAudioPlayer(SOURCES[name]);
    return players[name]!;
  } catch {
    return null;
  }
}

export function playSfx(name: Sfx) {
  if (!useProgress.getState().soundOn) return;
  const p = player(name);
  if (!p) return;
  try {
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Audio is decoration; never let it break gameplay (e.g. web autoplay policies).
  }
}

const isNative = Platform.OS !== 'web';

export const haptic = {
  success() {
    if (isNative && useProgress.getState().hapticsOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error() {
    if (isNative && useProgress.getState().hapticsOn) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  tap() {
    if (isNative && useProgress.getState().hapticsOn) Haptics.selectionAsync().catch(() => {});
  },
};

/** Convenience: matched sound + haptic for gameplay moments. */
export const feedback = {
  success() {
    playSfx('success');
    haptic.success();
  },
  fail() {
    playSfx('fail');
    haptic.error();
  },
  unlock() {
    playSfx('unlock');
  },
  tap() {
    playSfx('click');
    haptic.tap();
  },
  hint() {
    playSfx('hint');
    haptic.tap();
  },
};
