import { StyleSheet, Text, View } from 'react-native';
import type { TestCase } from '../../content/types';
import { alpha, colors, fonts, space } from '../../theme';
import type { ValidationReport } from '../../validator/validator';
import { Icon, Panel, ProgressBar } from '../ui';

/** Pass/fail checklist. Before the first run it lists the checks as pending. */
export function TestPanel({ tests, report, running }: { tests: TestCase[]; report: ValidationReport | null; running?: boolean }) {
  const outcomes = new Map(report?.outcomes.map((o) => [o.id, o]));
  const passed = report?.passedCount ?? 0;

  return (
    <Panel
      title="Test Suite"
      accent={colors.cyan}
      right={<Text style={styles.count}>{report ? `${passed}/${report.total} passing` : `${tests.length} checks`}</Text>}
    >
      {report ? <ProgressBar value={passed / report.total} color={report.passed ? colors.emerald : colors.cyan} /> : null}
      <View style={{ marginTop: space.sm, gap: 2 }}>
        {tests.map((t) => {
          const o = outcomes.get(t.id);
          const state = running ? 'running' : !o ? 'pending' : o.passed ? 'pass' : 'fail';
          const hiddenLocked = t.hidden && state !== 'pass';
          const color = state === 'pass' ? colors.emerald : state === 'fail' ? colors.red : colors.textFaint;
          return (
            <View key={t.id} style={[styles.row, state === 'fail' && { backgroundColor: alpha(colors.red, 0.06) }]}>
              <Icon
                name={state === 'pass' ? 'check-circle' : state === 'fail' ? 'close-circle' : state === 'running' ? 'progress-clock' : 'circle-outline'}
                size={18}
                color={color}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, state === 'pass' && { color: colors.text }]}>
                  {hiddenLocked ? 'Hidden check' : t.label}
                  {hiddenLocked ? <Text style={styles.hiddenTag}>  ◆ edge case</Text> : null}
                </Text>
                {o && !o.passed && !running ? (
                  <>
                    {!hiddenLocked ? <Text style={styles.detail}>{o.detail}</Text> : null}
                    {o.failHint ? <Text style={styles.hint}>↳ {o.failHint}</Text> : null}
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.textDim },
  row: { flexDirection: 'row', gap: space.sm, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4 },
  label: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  hiddenTag: { fontFamily: fonts.mono, fontSize: 10, color: colors.violet },
  detail: { fontFamily: fonts.mono, color: colors.red, fontSize: 12, lineHeight: 17, marginTop: 2 },
  hint: { color: colors.amber, fontSize: 12, lineHeight: 17, marginTop: 2 },
});
