import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { ConfirmDialog, EngineStatusPill, Icon, Label, NeonButton, Panel, ProgressBar } from '../../components/ui';
import { levels } from '../../content';
import { PYODIDE_VERSION } from '../../engine/workerSource';
import { BADGES } from '../../game/badges';
import { liveStreak, rankFor } from '../../game/progression';
import { useProgress } from '../../store/progress';
import { alpha, colors, fonts, radius, space } from '../../theme';

export default function Profile() {
  const { xp, streak, solved, badges, soundOn, hapticsOn, setSound, setHaptics, resetProgress } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const rank = rankFor(xp);
  const cleared = Object.keys(solved).length;
  const stars = Object.values(solved).reduce((n, p) => n + p.stars, 0);
  const perfect = Object.values(solved).filter((p) => p.stars === 3).length;
  const attempts = Object.values(solved).reduce((n, p) => n + p.attempts, 0);
  const accuracy = attempts ? Math.round((cleared / attempts) * 100) : 0;

  return (
    <Screen
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.h1, { flex: 1 }]}>OPERATOR PROFILE</Text>
          <EngineStatusPill />
        </View>
      }
    >
      <Panel accent={colors.cyan}>
        <View style={styles.idRow}>
          <View style={styles.avatar}>
            <Icon name="robot-happy-outline" size={36} color={colors.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <Label color={colors.cyan}>Rank {rank.level}</Label>
            <Text style={styles.rank}>{rank.title}</Text>
            <Text style={styles.xp}>{xp} XP</Text>
          </View>
        </View>
        <View style={{ marginTop: space.md, gap: 4 }}>
          <ProgressBar value={rank.progress} />
          <Text style={styles.small}>{rank.next ? `${rank.next - xp} XP to next rank` : 'Maximum rank reached'}</Text>
        </View>
      </Panel>

      <View style={styles.statGrid}>
        <Stat icon="fire" color={colors.amber} value={liveStreak(streak)} label="Day streak" sub={`best ${streak.best}`} />
        <Stat icon="flag-checkered" color={colors.emerald} value={`${cleared}/${levels.length}`} label="Missions" />
        <Stat icon="star" color={colors.amber} value={stars} label="Stars" sub={`${perfect} perfect`} />
        <Stat icon="target" color={colors.cyan} value={`${accuracy}%`} label="Accuracy" />
      </View>

      <Panel title={`Badges · ${Object.keys(badges).length}/${BADGES.length}`} accent={colors.violet} style={{ marginTop: space.lg }}>
        <View style={styles.badgeGrid}>
          {BADGES.map((b) => {
            const earned = !!badges[b.id];
            return (
              <View key={b.id} style={[styles.badge, earned && { borderColor: alpha(colors.violet, 0.6), backgroundColor: alpha(colors.violet, 0.08) }]} accessibilityLabel={`${b.name}: ${earned ? 'earned' : 'locked'}. ${b.description}`}>
                <Icon name={(earned ? b.icon : 'lock-outline') as never} size={26} color={earned ? colors.violet : colors.textFaint} />
                <Text style={[styles.badgeName, !earned && { color: colors.textDim }]} numberOfLines={2}>
                  {b.name}
                </Text>
                <Text style={styles.badgeDesc} numberOfLines={3}>
                  {b.description}
                </Text>
              </View>
            );
          })}
        </View>
      </Panel>

      <Panel title="Settings" style={{ marginTop: space.lg }}>
        <SettingRow label="Sound effects" value={soundOn} onChange={setSound} />
        <SettingRow label="Haptics (iOS / Android)" value={hapticsOn} onChange={setHaptics} />
        <Text style={[styles.small, { marginTop: space.md }]}>Python runtime: Pyodide {PYODIDE_VERSION} (WebAssembly, on-device)</Text>
      </Panel>

      <Panel title="Danger zone" accent={colors.red} style={{ marginTop: space.lg }}>
        <Text style={styles.small}>Wipes XP, stars, streak, badges and saved code on this device.</Text>
        <NeonButton label="Reset progress" icon="delete-forever" variant="danger" onPress={() => setConfirming(true)} style={{ marginTop: space.md }} />
      </Panel>

      <ConfirmDialog
        visible={confirming}
        title="Reset all progress?"
        message="This permanently erases your XP, stars, streak, badges and code drafts. It can't be undone."
        confirmLabel="Erase"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          resetProgress();
          setConfirming(false);
        }}
      />
    </Screen>
  );
}

function Stat({ icon, color, value, label, sub }: { icon: 'fire' | 'star' | 'flag-checkered' | 'target'; color: string; value: number | string; label: string; sub?: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.small}>{sub}</Text> : null}
    </View>
  );
}

function SettingRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.setting}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: alpha(colors.cyan, 0.6), false: colors.border }} thumbColor={value ? colors.cyan : colors.textDim} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.mono, fontWeight: '900', fontSize: 17, color: colors.cyan, letterSpacing: 2 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.cyan, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.08) },
  rank: { color: colors.text, fontSize: 22, fontWeight: '800' },
  xp: { fontFamily: fonts.mono, color: colors.cyan, fontSize: 14, fontWeight: '700' },
  small: { color: colors.textDim, fontSize: 12, fontFamily: fonts.mono },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: alpha(colors.panel, 0.92), borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.md, gap: 2 },
  statValue: { fontFamily: fonts.mono, fontSize: 24, fontWeight: '900' },
  statLabel: { color: colors.text, fontSize: 13 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: { flexGrow: 1, flexBasis: '30%', minWidth: 96, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.sm, alignItems: 'center', gap: 4 },
  badgeName: { color: colors.violet, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  badgeDesc: { color: colors.textFaint, fontSize: 10, textAlign: 'center', lineHeight: 13 },
  setting: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm },
  settingLabel: { color: colors.text, fontSize: 15 },
});
