import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Celebration } from '../../components/level/Celebration';
import { HintPanel } from '../../components/level/HintPanel';
import { PredictOutput } from '../../components/level/PredictOutput';
import { CodeRunner } from '../../components/runner/CodeRunner';
import { Screen } from '../../components/Screen';
import { EngineStatusPill, Icon, Label, NeonButton, Panel, Stars, Tag } from '../../components/ui';
import { getLevel, getWorld, MECHANIC_LABEL, nextLevel } from '../../content';
import type { Level } from '../../content/types';
import { feedback } from '../../feedback/sfx';
import { isUnlocked, starsFor } from '../../game/progression';
import { useProgress, type CompletionOutcome } from '../../store/progress';
import { accentColor, alpha, colors, fonts, space } from '../../theme';
import type { ValidationReport } from '../../validator/validator';

export default function LevelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const level = getLevel(String(id));
  const solved = useProgress((s) => s.solved);

  if (!level) return <Blocked title="Unknown mission" message={`No mission with id "${id}".`} />;
  if (!isUnlocked(level.id, solved)) return <Blocked title="Node locked" message="Clear the previous mission on the map to unlock this one." />;
  // key: a fresh gameplay state whenever we move to another level.
  return <LevelPlay key={level.id} level={level} />;
}

function exitToMap() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * The gameplay loop:
 *
 *   briefing → attempt (run tests / lock in answer)
 *      ├─ fail → sound + haptic, failed-attempt counter ↑ (persisted), humanized tips, hint nudge
 *      └─ pass → completeLevel(): stars from attempts & hints, XP delta, streak, badges, unlock next
 *                 → celebration overlay → next mission / map / review
 */
function LevelPlay({ level }: { level: Level }) {
  const world = getWorld(level.world)!;
  const accent = accentColor(world.accent);
  const best = useProgress((s) => s.solved[level.id]);
  const pending = useProgress((s) => s.pendingAttempts[level.id] ?? 0);
  const completeLevel = useProgress((s) => s.completeLevel);
  const recordFailedAttempt = useProgress((s) => s.recordFailedAttempt);

  // Replays start from a clean slate; first-time attempts resume the persisted failure count.
  const [failed, setFailed] = useState(best ? 0 : pending);
  const [hints, setHints] = useState(0);
  const [cleared, setCleared] = useState(false);
  const [outcome, setOutcome] = useState<CompletionOutcome | null>(null);
  const next = nextLevel(level.id);

  function registerFailure() {
    feedback.fail();
    setFailed((n) => n + 1);
    if (!best) recordFailedAttempt(level.id);
  }

  function registerSuccess() {
    feedback.success();
    const result = completeLevel(level.id, { failedAttempts: failed, hintsUsed: hints });
    setCleared(true);
    setOutcome(result);
    if (result.unlockedLevelId || result.newBadges.length) setTimeout(feedback.unlock, 900);
  }

  function onRunnerResult(report: ValidationReport) {
    if (report.passed) return registerSuccess();
    // Engine problems (offline, failed boot) are not the player's fault.
    if (report.crash?.result.error?.type === 'EngineError') return;
    registerFailure();
  }

  function revealHint() {
    feedback.hint();
    setHints((h) => Math.min(h + 1, level.hints.length));
  }

  function goNext() {
    setOutcome(null);
    if (next) router.replace(`/level/${next.id}`);
  }

  const maxStars = starsFor(failed, hints);

  return (
    <>
      <Screen
        header={
          <View style={styles.header}>
            <Pressable onPress={exitToMap} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to mission map">
              <Icon name="chevron-left" size={28} color={colors.cyan} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.worldName, { color: accent }]} numberOfLines={1}>
                W{world.id} · {world.codename}
              </Text>
              <Text style={styles.title} numberOfLines={1}>
                {level.title}
              </Text>
            </View>
            <EngineStatusPill />
          </View>
        }
      >
        <View style={{ gap: space.md }}>
          <View style={styles.metaRow}>
            <Tag text={MECHANIC_LABEL[level.mechanic]} color={accent} />
            <Tag text={level.concept} color={colors.textDim} />
            <View style={{ flex: 1 }} />
            <Text style={styles.xp}>{level.xp} XP</Text>
          </View>

          <Panel title="Mission briefing" accent={accent}>
            <Text style={styles.briefing}>{level.briefing}</Text>
            <View style={styles.objective}>
              <Icon name="target" size={18} color={colors.cyan} />
              <Text style={styles.objectiveText}>{level.objective}</Text>
            </View>
          </Panel>

          <View style={styles.runStatus}>
            <View style={styles.runStatusItem}>
              <Label>{cleared ? 'Cleared' : 'Run rating'}</Label>
              <Stars count={maxStars} size={16} />
            </View>
            <View style={styles.runStatusItem}>
              <Label>Failed</Label>
              <Text style={[styles.counter, failed > 0 && { color: colors.red }]}>{failed}</Text>
            </View>
            {best ? (
              <View style={styles.runStatusItem}>
                <Label>Best</Label>
                <Stars count={best.stars} size={16} />
              </View>
            ) : null}
          </View>

          {level.mechanic === 'predict_output' ? (
            <PredictOutput level={level} solved={cleared} onAnswer={(ok) => (ok ? registerSuccess() : registerFailure())} />
          ) : (
            <CodeRunner level={level} solved={cleared} onResult={onRunnerResult} />
          )}

          <HintPanel hints={level.hints} revealed={hints} onReveal={revealHint} nudge={failed >= 2 && hints < level.hints.length} disabled={cleared} />

          {cleared && !outcome ? (
            <View style={[styles.clearedBar, { borderColor: alpha(colors.emerald, 0.6) }]}>
              <Text style={styles.clearedText}>✓ Mission cleared</Text>
              {next ? <NeonButton label="Next mission" icon="arrow-right-bold" variant="emerald" onPress={goNext} compact /> : null}
              <NeonButton label="Map" icon="map-marker-path" variant="ghost" onPress={exitToMap} compact />
            </View>
          ) : null}
        </View>
      </Screen>

      <Celebration
        outcome={outcome}
        hasNext={!!next}
        onNext={goNext}
        onMap={() => {
          setOutcome(null);
          exitToMap();
        }}
        onStay={() => setOutcome(null)}
      />
    </>
  );
}

function Blocked({ title, message }: { title: string; message: string }) {
  return (
    <Screen>
      <Panel title={title} accent={colors.amber} style={{ marginTop: space.xxl }}>
        <Text style={styles.briefing}>{message}</Text>
        <NeonButton label="Mission map" icon="map-marker-path" onPress={() => router.replace('/')} style={{ marginTop: space.lg }} />
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  worldName: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 2, fontWeight: '800' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  xp: { fontFamily: fonts.mono, color: colors.cyan, fontSize: 12, fontWeight: '700' },
  briefing: { color: colors.text, fontSize: 15, lineHeight: 22 },
  objective: { flexDirection: 'row', gap: space.sm, marginTop: space.md, padding: space.sm, borderRadius: 6, backgroundColor: alpha(colors.cyan, 0.07), borderLeftWidth: 3, borderLeftColor: colors.cyan },
  objectiveText: { color: colors.cyan, fontSize: 14, lineHeight: 20, flex: 1, fontWeight: '600' },
  runStatus: { flexDirection: 'row', gap: space.xl, paddingHorizontal: space.xs },
  runStatusItem: { gap: 4 },
  counter: { fontFamily: fonts.mono, color: colors.textDim, fontSize: 16, fontWeight: '800' },
  clearedBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderRadius: 10, padding: space.md, backgroundColor: alpha(colors.emerald, 0.06), flexWrap: 'wrap' },
  clearedText: { flex: 1, color: colors.emerald, fontFamily: fonts.mono, fontWeight: '800', minWidth: 140 },
});
