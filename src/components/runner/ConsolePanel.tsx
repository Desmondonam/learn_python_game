import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { humanizeError } from '../../engine/humanizeError';
import type { RunResult } from '../../engine/types';
import { alpha, colors, fonts, radius, space } from '../../theme';
import { Icon, Label, Panel } from '../ui';

/** Terminal-style output: stdout, plus a plain-English error card instead of a traceback. */
export function ConsolePanel({ result, scenarioLabel, running }: { result: RunResult | null; scenarioLabel?: string; running?: boolean }) {
  const [showRaw, setShowRaw] = useState(false);
  const friendly = result?.error ? humanizeError(result.error) : null;

  return (
    <Panel
      title="Console"
      accent={colors.emerald}
      right={result ? <Text style={styles.meta}>{result.timedOut ? 'killed' : `${Math.round(result.durationMs)} ms`}</Text> : null}
    >
      {scenarioLabel ? <Text style={styles.scenario}>▸ inputs: {scenarioLabel}</Text> : null}
      <View style={styles.term} accessibilityLiveRegion="polite">
        {running ? (
          <Text style={styles.prompt}>$ python mission.py <Text style={{ color: colors.cyan }}>▌</Text></Text>
        ) : !result ? (
          <Text style={styles.placeholder}>$ awaiting execution…</Text>
        ) : (
          <>
            <Text style={styles.prompt}>$ python mission.py</Text>
            {result.stdout ? <Text style={styles.out} selectable>{result.stdout.replace(/\n$/, '')}</Text> : null}
            {!result.stdout && !result.error ? <Text style={styles.placeholder}>(no output)</Text> : null}
            {result.outputTruncated ? <Text style={styles.warn}>… output truncated at 10,000 characters</Text> : null}
          </>
        )}
      </View>

      {friendly && !running ? (
        <View style={styles.errorCard} accessibilityRole="alert">
          <View style={styles.errorHead}>
            <Icon name="alert-octagon" size={18} color={colors.red} />
            <Text style={styles.errorTitle}>{friendly.title}</Text>
            {friendly.line ? <Text style={styles.errorLine}>line {friendly.line}</Text> : null}
          </View>
          {friendly.lineText ? <Text style={styles.lineText}>{friendly.lineText.trim()}</Text> : null}
          <Text style={styles.errorBody}>{friendly.explanation}</Text>
          <View style={styles.tipRow}>
            <Icon name="lightbulb-on-outline" size={16} color={colors.amber} />
            <Text style={styles.tip}>{friendly.tip}</Text>
          </View>
          <Pressable onPress={() => setShowRaw((v) => !v)} accessibilityRole="button" hitSlop={8}>
            <Label color={colors.textFaint} style={{ marginTop: space.sm }}>
              {showRaw ? '▾ hide' : '▸ show'} raw python error
            </Label>
          </Pressable>
          {showRaw ? <Text style={styles.raw} selectable>{friendly.raw}</Text> : null}
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  meta: { fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint },
  scenario: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim, marginBottom: space.xs },
  term: { backgroundColor: colors.bgDeep, borderRadius: radius.sm, padding: space.md, minHeight: 64, borderWidth: 1, borderColor: colors.border },
  prompt: { fontFamily: fonts.mono, color: colors.textFaint, fontSize: 13, marginBottom: 4 },
  out: { fontFamily: fonts.mono, color: colors.emerald, fontSize: 14, lineHeight: 20 },
  placeholder: { fontFamily: fonts.mono, color: colors.textFaint, fontSize: 13 },
  warn: { fontFamily: fonts.mono, color: colors.amber, fontSize: 12, marginTop: 4 },
  errorCard: { marginTop: space.md, borderWidth: 1, borderColor: alpha(colors.red, 0.5), backgroundColor: alpha(colors.red, 0.07), borderRadius: radius.sm, padding: space.md, gap: 6 },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  errorTitle: { color: colors.red, fontWeight: '800', fontSize: 15, flex: 1 },
  errorLine: { fontFamily: fonts.mono, color: colors.red, fontSize: 12 },
  lineText: { fontFamily: fonts.mono, color: colors.text, fontSize: 13, backgroundColor: colors.bgDeep, padding: 6, borderRadius: 4 },
  errorBody: { color: colors.text, fontSize: 14, lineHeight: 20 },
  tipRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  tip: { color: colors.amber, fontSize: 13, lineHeight: 19, flex: 1 },
  raw: { fontFamily: fonts.mono, color: colors.textDim, fontSize: 12 },
});
