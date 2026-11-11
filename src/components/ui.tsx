import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Defs, Line, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';
import { useEngineStatus } from '../engine/useEngine';
import { feedback } from '../feedback/sfx';
import { alpha, colors, fonts, glow, radius, space } from '../theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export const Icon = MaterialCommunityIcons;

// ---------------------------------------------------------------------------

export function Mono({ style, ...props }: ComponentProps<typeof Text>) {
  return <Text {...props} style={[styles.mono, style]} />;
}

export function Label({ children, color = colors.textDim, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, { color }, style]}>{children}</Text>;
}

export function Panel({
  children,
  style,
  accent,
  title,
  right,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: string;
  title?: string;
  right?: ReactNode;
}) {
  return (
    <View style={[styles.panel, accent ? { borderColor: alpha(accent, 0.45) } : null, style]}>
      {title ? (
        <View style={styles.panelHeader}>
          <Label color={accent ?? colors.textDim}>{title}</Label>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------

type ButtonVariant = 'cyan' | 'emerald' | 'amber' | 'ghost' | 'danger';

export function NeonButton({
  label,
  onPress,
  variant = 'cyan',
  icon,
  disabled,
  loading,
  style,
  compact,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const c = variant === 'ghost' ? colors.textDim : variant === 'danger' ? colors.red : colors[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        feedback.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { borderColor: alpha(c, inactive ? 0.25 : 0.8), backgroundColor: alpha(c, pressed ? 0.22 : variant === 'ghost' ? 0 : 0.1) },
        !inactive && variant !== 'ghost' ? glow(c, 0.6) : null,
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={c} />
      ) : icon ? (
        <Icon name={icon} size={compact ? 16 : 18} color={alpha(c, inactive ? 0.4 : 1)} />
      ) : null}
      <Text style={[styles.buttonText, compact && { fontSize: 12 }, { color: alpha(c, inactive ? 0.4 : 1) }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------

export function Stars({ count, size = 14, max = 3 }: { count: number; size?: number; max?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${count} of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Icon key={i} name={i < count ? 'star' : 'star-outline'} size={size} color={i < count ? colors.amber : colors.textFaint} />
      ))}
    </View>
  );
}

export function Tag({ text, color = colors.cyan }: { text: string; color?: string }) {
  return (
    <View style={[styles.tag, { borderColor: alpha(color, 0.5), backgroundColor: alpha(color, 0.08) }]}>
      <Text style={[styles.tagText, { color }]}>{text}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = colors.cyan, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.panelAlt, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, height: '100%', backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Retro synth grid backdrop: a faint square grid plus a horizon glow. */
export function GridBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grid" width={32} height={32} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={32} y2={0} stroke={colors.grid} strokeWidth={1} />
            <Line x1={0} y1={0} x2={0} y2={32} stroke={colors.grid} strokeWidth={1} />
          </Pattern>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0.2} />
            <Stop offset="0.7" stopColor={colors.bg} stopOpacity={0.85} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={colors.bg} />
        <Rect width="100%" height="100%" fill="url(#grid)" />
        <Rect width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------

const STATUS_META = {
  idle: { label: 'OFFLINE', color: colors.textFaint },
  booting: { label: 'BOOTING', color: colors.amber },
  restarting: { label: 'REBOOTING', color: colors.amber },
  ready: { label: 'ONLINE', color: colors.emerald },
  busy: { label: 'RUNNING', color: colors.cyan },
  error: { label: 'FAULT', color: colors.red },
} as const;

export function EngineStatusPill() {
  const status = useEngineStatus();
  const meta = STATUS_META[status];
  const pulse = useState(() => new Animated.Value(1))[0];
  const animating = status === 'booting' || status === 'restarting' || status === 'busy';

  useEffect(() => {
    if (!animating) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animating, pulse]);

  return (
    <View style={[styles.statusPill, { borderColor: alpha(meta.color, 0.5) }]} accessibilityLabel={`Python engine ${meta.label}`}>
      <Animated.View style={[styles.statusDot, { backgroundColor: meta.color, opacity: pulse }]} />
      <Text style={[styles.statusText, { color: meta.color }]}>PY {meta.label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

/** Cross-platform confirm (Alert.alert's multi-button form doesn't work on web). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Panel style={styles.dialog} accent={colors.red} title={title}>
          <Text style={styles.body}>{message}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg, justifyContent: 'flex-end' }}>
            <NeonButton label="Cancel" variant="ghost" onPress={onCancel} compact />
            <NeonButton label={confirmLabel} variant="danger" icon="delete-forever" onPress={onConfirm} compact />
          </View>
        </Panel>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  mono: { fontFamily: fonts.mono, color: colors.text },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, fontWeight: '700', textTransform: 'uppercase' },
  body: { color: colors.text, fontSize: 15, lineHeight: 22 },
  dim: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  panel: {
    backgroundColor: alpha(colors.panel, 0.92),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space.md,
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  button: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: space.md },
  buttonText: { fontFamily: fonts.mono, fontWeight: '700', letterSpacing: 1.2, fontSize: 14, textTransform: 'uppercase' },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  tagText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: fonts.mono, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  backdrop: { flex: 1, backgroundColor: alpha(colors.bgDeep, 0.85), alignItems: 'center', justifyContent: 'center', padding: space.lg },
  dialog: { width: '100%', maxWidth: 420 },
});
