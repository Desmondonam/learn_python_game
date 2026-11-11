import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CodeRepairLevel, LiveConsoleLevel } from '../../content/types';
import { useEngineStatus, pythonEngine } from '../../engine/useEngine';
import { useProgress } from '../../store/progress';
import { alpha, colors, fonts, space } from '../../theme';
import { assembleTemplate, scenariosOf, validateSubmission, type ValidationReport } from '../../validator/validator';
import { BlankFiller } from '../code/BlankFiller';
import { CodeEditor } from '../code/CodeEditor';
import { NeonButton, Panel } from '../ui';
import { ConsolePanel } from './ConsolePanel';
import { TestPanel } from './TestPanel';

type RunnableLevel = LiveConsoleLevel | CodeRepairLevel;

function initialFills(level: CodeRepairLevel, draft?: string): Record<string, string> {
  if (draft) {
    try {
      return JSON.parse(draft);
    } catch {}
  }
  return Object.fromEntries(level.blanks.map((b) => [b.id, '']));
}

/**
 * The interactive code runner used by the Live Console and Code Repair mechanics.
 *
 *   input (editor | blank filler)
 *     → RUN & TEST
 *     → validateSubmission() → one Pyodide run per scenario (3 s hard limit each)
 *     → TestPanel + ConsolePanel (+ humanized error)
 *     → onResult(report) so the gameplay loop can award stars / count failures
 */
export function CodeRunner({
  level,
  solved,
  onResult,
}: {
  level: RunnableLevel;
  /** Freeze the input after a successful clear. */
  solved: boolean;
  onResult: (report: ValidationReport) => void;
}) {
  const draft = useProgress((s) => s.drafts[level.id]);
  const setDraft = useProgress((s) => s.setDraft);
  const status = useEngineStatus();

  const [code, setCode] = useState(() => (level.mechanic === 'live_console' ? (draft ?? level.starterCode) : ''));
  const [fills, setFills] = useState(() => (level.mechanic === 'code_repair' ? initialFills(level, draft) : {}));
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);
  const runToken = useRef(0);

  // Persist drafts (debounced) so leaving the level doesn't lose work.
  useEffect(() => {
    const t = setTimeout(() => {
      setDraft(level.id, level.mechanic === 'live_console' ? code : JSON.stringify(fills));
    }, 400);
    return () => clearTimeout(t);
  }, [code, fills, level.id, level.mechanic, setDraft]);

  const source = level.mechanic === 'live_console' ? code : assembleTemplate(level.template, fills);
  const missingBlanks = level.mechanic === 'code_repair' && source === null;

  async function run() {
    if (!source || running) return;
    const token = ++runToken.current;
    setRunning(true);
    const result = await validateSubmission(source, level, pythonEngine.runner);
    if (token !== runToken.current) return; // a newer run (or unmount) superseded this one
    setRunning(false);
    setReport(result);
    onResult(result);
  }

  useEffect(() => () => void runToken.current++, []);

  function reset() {
    setReport(null);
    if (level.mechanic === 'live_console') setCode(level.starterCode);
    else setFills(initialFills(level));
  }

  const shown = report?.crash ?? report?.runs[0] ?? null;
  const errorLine = shown?.result.error?.line ?? null;
  const scenarios = useMemo(() => scenariosOf(level), [level]);
  const hasInputs = scenarios.some((s) => Object.keys(s.inputs).length > 0);
  const engineBusy = status === 'booting' || status === 'restarting';

  return (
    <View style={{ gap: space.md }}>
      {hasInputs ? (
        <Panel title="Sensor inputs" accent={colors.violet}>
          <Text style={styles.inputsNote}>Pre-loaded as variables. Your code is tested against every set:</Text>
          {scenarios.map((s) => (
            <Text key={s.id} style={styles.inputsRow}>
              <Text style={{ color: colors.violet }}>◆ </Text>
              {Object.entries(s.inputs)
                .map(([k, v]) => `${k} = ${toPy(v)}`)
                .join(', ')}
            </Text>
          ))}
        </Panel>
      ) : null}

      <Panel title={level.mechanic === 'live_console' ? 'Live console · mission.py' : 'Code repair · mission.py'} accent={colors.cyan}>
        {level.mechanic === 'live_console' ? (
          <CodeEditor value={code} onChange={setCode} errorLine={errorLine} editable={!solved} />
        ) : (
          <BlankFiller level={level} fills={fills} onChange={setFills} errorLine={errorLine} locked={solved} />
        )}
      </Panel>

      <View style={styles.actions}>
        <NeonButton
          label={running ? 'Running…' : engineBusy ? 'Engine booting…' : 'Run & Test'}
          icon="play"
          variant="emerald"
          onPress={run}
          loading={running || engineBusy}
          disabled={solved || missingBlanks || !source?.trim()}
          style={{ flex: 1 }}
        />
        <NeonButton label="Reset" icon="restore" variant="ghost" onPress={reset} disabled={running || solved} />
      </View>
      {missingBlanks && !solved ? <Text style={styles.note}>Fill every blank to run the repair.</Text> : null}

      <TestPanel tests={level.tests} report={report} running={running} />
      <ConsolePanel result={shown?.result ?? null} scenarioLabel={shown?.scenario.id === 'default' ? undefined : shown?.scenario.label} running={running} />
    </View>
  );
}

/** Render a JSON input the way Python would print it. */
function toPy(v: unknown): string {
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (v === null) return 'None';
  if (Array.isArray(v)) return `[${v.map(toPy).join(', ')}]`;
  if (typeof v === 'object') return `{${Object.entries(v as object).map(([k, x]) => `${JSON.stringify(k)}: ${toPy(x)}`).join(', ')}}`;
  return JSON.stringify(v);
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  note: { color: colors.amber, fontSize: 12, fontFamily: fonts.mono, textAlign: 'center' },
  inputsNote: { color: colors.textDim, fontSize: 12, marginBottom: space.xs },
  inputsRow: { fontFamily: fonts.mono, fontSize: 12, color: colors.text, lineHeight: 19, backgroundColor: alpha(colors.violet, 0.05) },
});
