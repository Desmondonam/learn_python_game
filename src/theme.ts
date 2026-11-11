import { Platform } from 'react-native';
import type { World } from './content/types';

export const colors = {
  bg: '#05070D',
  bgDeep: '#020309',
  panel: '#0A101C',
  panelAlt: '#0E1728',
  border: '#1A2A44',
  borderBright: '#2A4268',
  grid: '#0F2236',

  text: '#D8E4F5',
  textDim: '#8496B3',
  textFaint: '#4B5B78',

  cyan: '#22E4FF',
  emerald: '#2BFF88',
  amber: '#FFB020',
  magenta: '#FF4FD8',
  violet: '#A98BFF',
  red: '#FF4D6D',

  codeKeyword: '#22E4FF',
  codeString: '#FFB020',
  codeNumber: '#2BFF88',
  codeComment: '#4B5B78',
  codeBuiltin: '#A98BFF',
} as const;

export type Accent = World['accent'];

export function accentColor(a: Accent): string {
  return colors[a];
}

/** Hex colour + alpha (0..1) → #RRGGBBAA */
export function alpha(hex: string, a: number): string {
  const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return hex + v;
}

export const fonts = {
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 };

/** Neon glow. On web boxShadow works; on native we approximate with shadow props (iOS) and nothing (Android). */
export function glow(color: string, strength = 1) {
  return Platform.select({
    web: { boxShadow: `0 0 ${12 * strength}px ${alpha(color, 0.55)}, inset 0 0 ${6 * strength}px ${alpha(color, 0.15)}` } as object,
    ios: { shadowColor: color, shadowOpacity: 0.6 * strength, shadowRadius: 10 * strength, shadowOffset: { width: 0, height: 0 } },
    default: {},
  });
}

/** Max content width so the layout stays readable on desktop web and tablets. */
export const MAX_WIDTH = 760;
