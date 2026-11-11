import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { getBadge } from '../../game/badges';
import type { CompletionOutcome } from '../../store/progress';
import { alpha, colors, fonts, glow, radius, space } from '../../theme';
import { Icon, NeonButton } from '../ui';

/** Mission-complete overlay: pop-in, stars stamping one by one, XP counting up, badges. */
export function Celebration({
  outcome,
  onNext,
  onMap,
  onStay,
  hasNext,
}: {
  outcome: CompletionOutcome | null;
  onNext: () => void;
  onMap: () => void;
  onStay: () => void;
  hasNext: boolean;
}) {
  const visible = !!outcome;
  const scale = useState(() => new Animated.Value(0.6))[0];
  const opacity = useState(() => new Animated.Value(0))[0];
  const [stars] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const xp = useState(() => new Animated.Value(0))[0];
  const [xpShown, setXpShown] = useState(0);

  useEffect(() => {
    if (!outcome) return;
    // Listener first, so resetting the value to 0 also resets the displayed counter.
    const id = xp.addListener(({ value }) => setXpShown(Math.round(value)));
    scale.setValue(0.6);
    opacity.setValue(0);
    stars.forEach((s) => s.setValue(0));
    xp.setValue(0);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.stagger(
          180,
          stars.slice(0, outcome.stars).map((s) => Animated.spring(s, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true })),
        ),
        Animated.timing(xp, { toValue: outcome.xpGained, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      ]),
    ]).start();
    return () => xp.removeListener(id);
  }, [outcome, scale, opacity, stars, xp]);

  if (!outcome) return null;
  const improved = !outcome.firstClear && outcome.stars > outcome.previousStars;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, glow(colors.emerald, 1.4), { opacity, transform: [{ scale }] }]} accessibilityViewIsModal>
          <Text style={styles.kicker}>{outcome.firstClear ? 'MISSION COMPLETE' : improved ? 'NEW BEST' : 'MISSION REPLAYED'}</Text>
          <View style={styles.starRow}>
            {stars.map((s, i) => (
              <Animated.View
                key={i}
                style={
                  i < outcome.stars
                    ? { opacity: s, transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [2.2, 1] }) }] }
                    : null
                }
              >
                <Icon name={i < outcome.stars ? 'star' : 'star-outline'} size={46} color={i < outcome.stars ? colors.amber : colors.textFaint} />
              </Animated.View>
            ))}
          </View>
          <Text style={styles.xp}>+{xpShown} XP</Text>
          {outcome.xpGained === 0 ? <Text style={styles.sub}>Beat your star rating to earn more XP.</Text> : null}

          {outcome.newBadges.length ? (
            <View style={styles.badges}>
              {outcome.newBadges.map((id) => {
                const b = getBadge(id);
                return b ? (
                  <View key={id} style={styles.badge}>
                    <Icon name={b.icon as never} size={22} color={colors.violet} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.badgeName}>Badge unlocked: {b.name}</Text>
                      <Text style={styles.sub}>{b.description}</Text>
                    </View>
                  </View>
                ) : null;
              })}
            </View>
          ) : null}

          {outcome.unlockedLevelId ? (
            <Text style={styles.unlock}>
              <Icon name="lock-open-variant" size={14} color={colors.cyan} /> Next node unlocked on the mission map
            </Text>
          ) : null}

          <View style={{ gap: space.sm, alignSelf: 'stretch', marginTop: space.md }}>
            {hasNext ? <NeonButton label="Next mission" icon="arrow-right-bold" variant="emerald" onPress={onNext} /> : null}
            <NeonButton label="Mission map" icon="map-marker-path" variant="cyan" onPress={onMap} />
            <NeonButton label="Review this level" variant="ghost" compact onPress={onStay} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: alpha(colors.bgDeep, 0.88), alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.emerald,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  kicker: { fontFamily: fonts.mono, color: colors.emerald, fontWeight: '800', letterSpacing: 3, fontSize: 14 },
  starRow: { flexDirection: 'row', gap: space.sm, marginVertical: space.sm },
  xp: { fontFamily: fonts.mono, color: colors.cyan, fontWeight: '800', fontSize: 34 },
  sub: { color: colors.textDim, fontSize: 12, lineHeight: 17 },
  badges: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
  badge: { flexDirection: 'row', gap: space.sm, alignItems: 'center', borderWidth: 1, borderColor: alpha(colors.violet, 0.5), borderRadius: radius.sm, padding: space.sm, backgroundColor: alpha(colors.violet, 0.08) },
  badgeName: { color: colors.violet, fontWeight: '700', fontSize: 14 },
  unlock: { color: colors.cyan, fontSize: 13, fontFamily: fonts.mono },
});
