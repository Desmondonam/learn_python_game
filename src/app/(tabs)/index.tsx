import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { Screen } from '../../components/Screen';
import { EngineStatusPill, Icon, Label, ProgressBar, Stars, styles as ui } from '../../components/ui';
import { levels, levelsInWorld, MECHANIC_LABEL, worlds } from '../../content';
import type { Level, World } from '../../content/types';
import { feedback } from '../../feedback/sfx';
import { isUnlocked, liveStreak, rankFor, type LevelProgress } from '../../game/progression';
import { useProgress } from '../../store/progress';
import { accentColor, alpha, colors, fonts, glow, radius, space } from '../../theme';

const NODE = 64;
const ROW = 112;
/** Horizontal lanes the path zig-zags through, as a fraction of track width. */
const LANES = [0.5, 0.78, 0.5, 0.22];

const MECHANIC_ICON = { code_repair: 'wrench', live_console: 'console-line', predict_output: 'crystal-ball' } as const;

export default function MissionMap() {
  const solved = useProgress((s) => s.solved);
  const xp = useProgress((s) => s.xp);
  const streak = useProgress((s) => s.streak);
  const rank = rankFor(xp);
  const totalStars = Object.values(solved).reduce((n, p) => n + p.stars, 0);
  const current = levels.find((l) => !solved[l.id] && isUnlocked(l.id, solved));

  return (
    <Screen
      header={
        <View style={styles.hud}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>
              PY<Text style={{ color: colors.emerald }}>QUEST</Text>
            </Text>
            <Text style={styles.rank}>{rank.title}</Text>
          </View>
          <View style={styles.hudStats}>
            <HudStat icon="lightning-bolt" color={colors.cyan} value={xp} label="XP" />
            <HudStat icon="fire" color={colors.amber} value={liveStreak(streak)} label="DAY" />
            <HudStat icon="star" color={colors.amber} value={totalStars} label={`/${levels.length * 3}`} />
          </View>
        </View>
      }
    >
      <View style={styles.topRow}>
        <Label>Mission map</Label>
        <EngineStatusPill />
      </View>
      {current ? (
        <Pressable onPress={() => router.push(`/level/${current.id}`)} style={({ pressed }) => [styles.resume, glow(colors.cyan, 0.5), pressed && { opacity: 0.8 }]}>
          <Icon name="play-circle" size={28} color={colors.cyan} />
          <View style={{ flex: 1 }}>
            <Label color={colors.cyan}>Resume mission</Label>
            <Text style={styles.resumeTitle}>{current.title}</Text>
          </View>
          <Icon name="chevron-right" size={24} color={colors.cyan} />
        </Pressable>
      ) : (
        <View style={[styles.resume, { borderColor: colors.emerald }]}>
          <Icon name="trophy" size={28} color={colors.emerald} />
          <Text style={[styles.resumeTitle, { color: colors.emerald }]}>All systems online. Replay for 3 stars!</Text>
        </View>
      )}

      {worlds.map((w) => (
        <WorldSector key={w.id} world={w} solved={solved} />
      ))}
    </Screen>
  );
}

function HudStat({ icon, color, value, label }: { icon: 'fire' | 'star' | 'lightning-bolt'; color: string; value: number; label: string }) {
  return (
    <View style={styles.hudStat} accessibilityLabel={`${value} ${label}`}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[styles.hudValue, { color }]}>{value}</Text>
      <Text style={styles.hudLabel}>{label}</Text>
    </View>
  );
}

function WorldSector({ world, solved }: { world: World; solved: Record<string, LevelProgress> }) {
  const lv = levelsInWorld(world.id);
  const accent = accentColor(world.accent);
  const cleared = lv.filter((l) => solved[l.id]).length;
  const stars = lv.reduce((n, l) => n + (solved[l.id]?.stars ?? 0), 0);
  const open = isUnlocked(lv[0].id, solved);
  const [width, setWidth] = useState(0);

  const pos = lv.map((_, i) => ({ x: LANES[i % LANES.length] * width, y: ROW / 2 + i * ROW }));

  return (
    <View style={{ marginTop: space.xl }}>
      <View style={[styles.worldCard, { borderColor: alpha(accent, open ? 0.6 : 0.2) }, open && glow(accent, 0.4)]}>
        <View style={styles.worldHead}>
          <Text style={[styles.worldNum, { color: open ? accent : colors.textFaint }]}>{String(world.id).padStart(2, '0')}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.worldName, { color: open ? accent : colors.textFaint }]}>{world.codename}</Text>
            <Text style={styles.worldTitle}>{world.title}</Text>
          </View>
          {open ? <Text style={styles.worldStars}>★ {stars}/{lv.length * 3}</Text> : <Icon name="lock" size={20} color={colors.textFaint} />}
        </View>
        <Text style={[ui.dim, { marginTop: space.sm }]}>{world.theme}</Text>
        <View style={{ marginTop: space.sm }}>
          <ProgressBar value={cleared / lv.length} color={accent} height={4} />
        </View>
      </View>

      <View style={{ height: lv.length * ROW }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <>
            <Svg width={width} height={lv.length * ROW} style={StyleSheet.absoluteFill}>
              {pos.slice(1).map((p, i) => {
                const done = !!solved[lv[i].id];
                return (
                  <Line
                    key={i}
                    x1={pos[i].x}
                    y1={pos[i].y}
                    x2={p.x}
                    y2={p.y}
                    stroke={done ? accent : colors.borderBright}
                    strokeOpacity={done ? 0.9 : 0.6}
                    strokeWidth={done ? 3 : 2}
                    strokeDasharray={done ? undefined : '6 6'}
                  />
                );
              })}
            </Svg>
            {lv.map((level, i) => (
              <MapNode
                key={level.id}
                level={level}
                accent={accent}
                progress={solved[level.id]}
                unlocked={isUnlocked(level.id, solved)}
                x={pos[i].x}
                y={pos[i].y}
                labelOnRight={LANES[i % LANES.length] <= 0.5}
                trackWidth={width}
              />
            ))}
          </>
        ) : null}
      </View>
    </View>
  );
}

function MapNode({
  level,
  accent,
  progress,
  unlocked,
  x,
  y,
  labelOnRight,
  trackWidth,
}: {
  level: Level;
  accent: string;
  progress?: LevelProgress;
  unlocked: boolean;
  x: number;
  y: number;
  labelOnRight: boolean;
  trackWidth: number;
}) {
  const isCurrent = unlocked && !progress;
  const pulse = useState(() => new Animated.Value(0))[0];
  const shake = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (!isCurrent) return;
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [isCurrent, pulse]);

  function press() {
    if (!unlocked) {
      feedback.fail();
      Animated.sequence(
        [8, -8, 5, -5, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 50, useNativeDriver: true })),
      ).start();
      return;
    }
    feedback.tap();
    router.push(`/level/${level.id}`);
  }

  const color = progress ? accent : unlocked ? colors.cyan : colors.textFaint;
  const gap = NODE / 2 + 10;
  const labelWidth = Math.max(80, Math.min(170, labelOnRight ? trackWidth - x - gap : x - gap));

  return (
    <View style={[styles.nodeWrap, { left: x - NODE / 2, top: y - NODE / 2 }]}>
      {isCurrent ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: colors.cyan, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }] },
          ]}
        />
      ) : null}
      <Animated.View style={[styles.nodeBacking, { transform: [{ translateX: shake }] }]}>
        <Pressable
          onPress={press}
          accessibilityRole="button"
          accessibilityLabel={`${level.title}, ${unlocked ? (progress ? `cleared, ${progress.stars} stars` : 'available') : 'locked'}`}
          style={({ pressed }) => [
            styles.node,
            { borderColor: color, backgroundColor: alpha(color, progress ? 0.2 : unlocked ? 0.12 : 0.04) },
            unlocked && glow(color, progress ? 0.6 : 1),
            pressed && { transform: [{ scale: 0.94 }] },
          ]}
        >
          {unlocked ? (
            <Icon name={progress ? 'check-bold' : MECHANIC_ICON[level.mechanic]} size={26} color={color} />
          ) : (
            <Icon name="lock" size={22} color={colors.textFaint} />
          )}
        </Pressable>
      </Animated.View>
      <View
        style={[styles.nodeLabel, { width: labelWidth }, labelOnRight ? { left: NODE + 10 } : { right: NODE + 10, alignItems: 'flex-end' }]}
        pointerEvents="none"
      >
        <Text style={[styles.nodeTitle, !unlocked && { color: colors.textFaint }]} numberOfLines={1}>
          {level.title}
        </Text>
        <Text style={styles.nodeMech}>{MECHANIC_LABEL[level.mechanic]}</Text>
        {progress ? <Stars count={progress.stars} size={12} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brand: { fontFamily: fonts.mono, fontSize: 20, fontWeight: '900', color: colors.cyan, letterSpacing: 3 },
  rank: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, letterSpacing: 1 },
  hudStats: { flexDirection: 'row', gap: space.md },
  hudStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hudValue: { fontFamily: fonts.mono, fontWeight: '800', fontSize: 15 },
  hudLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textFaint },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  resume: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.cyan, backgroundColor: alpha(colors.cyan, 0.06) },
  resumeTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  worldCard: { backgroundColor: alpha(colors.panel, 0.92), borderWidth: 1, borderRadius: radius.md, padding: space.md },
  worldHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  worldNum: { fontFamily: fonts.mono, fontSize: 28, fontWeight: '900' },
  worldName: { fontFamily: fonts.mono, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  worldTitle: { color: colors.textDim, fontSize: 13 },
  worldStars: { fontFamily: fonts.mono, color: colors.amber, fontSize: 13, fontWeight: '700' },
  nodeWrap: { position: 'absolute', width: NODE, height: NODE },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panel },
  nodeBacking: { borderRadius: NODE / 2, backgroundColor: colors.bg },
  ring: { position: 'absolute', width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 2 },
  nodeLabel: { position: 'absolute', top: 6, gap: 2 },
  nodeTitle: { color: colors.text, fontWeight: '700', fontSize: 14 },
  nodeMech: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, color: colors.textDim },
});
