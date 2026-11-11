import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PredictOutputLevel } from '../../content/types';
import { pythonEngine } from '../../engine/useEngine';
import type { RunResult } from '../../engine/types';
import { feedback } from '../../feedback/sfx';
import { alpha, colors, fonts, radius, space } from '../../theme';
import { CodeView } from '../code/CodeView';
import { ConsolePanel } from '../runner/ConsolePanel';
import { Icon, Label, NeonButton, Panel } from '../ui';

/**
 * Predict Output mechanic: read a snippet, pick the printed result.
 * Wrong picks are struck out (and count as failed attempts). After solving,
 * the player can execute the snippet for real to confirm.
 */
export function PredictOutput({
  level,
  solved,
  onAnswer,
}: {
  level: PredictOutputLevel;
  solved: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const [selected, setSelected] = useState<number | null>(solved ? level.answerIndex : null);
  const [wrong, setWrong] = useState<number[]>([]);
  const [trace, setTrace] = useState<RunResult | null>(null);
  const [tracing, setTracing] = useState(false);

  function lockIn() {
    if (selected === null) return;
    const correct = selected === level.answerIndex;
    if (!correct) setWrong((w) => [...w, selected]);
    onAnswer(correct);
    if (!correct) setSelected(null);
  }

  async function runForReal() {
    setTracing(true);
    setTrace(await pythonEngine.run({ code: level.snippet }));
    setTracing(false);
  }

  return (
    <View style={{ gap: space.md }}>
      <Panel title="Intercepted snippet" accent={colors.cyan}>
        <CodeView code={level.snippet} />
      </Panel>

      <Panel title="What does it print?" accent={colors.amber}>
        <View style={{ gap: space.sm }} accessibilityRole="radiogroup">
          {level.choices.map((choice, i) => {
            const isWrong = wrong.includes(i);
            const isRight = solved && i === level.answerIndex;
            const isSel = selected === i;
            const c = isRight ? colors.emerald : isWrong ? colors.red : isSel ? colors.amber : colors.border;
            return (
              <Pressable
                key={i}
                disabled={solved || isWrong}
                onPress={() => {
                  feedback.tap();
                  setSelected(i);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSel, disabled: solved || isWrong }}
                style={({ pressed }) => [
                  styles.choice,
                  { borderColor: c, backgroundColor: alpha(c, isSel || isRight ? 0.12 : 0.03) },
                  pressed && { transform: [{ scale: 0.99 }] },
                ]}
              >
                <Text style={[styles.letter, { color: c === colors.border ? colors.textDim : c }]}>{String.fromCharCode(65 + i)}</Text>
                <Text style={[styles.choiceText, isWrong && styles.struck]}>{choice}</Text>
                {isRight ? <Icon name="check-circle" size={20} color={colors.emerald} /> : null}
                {isWrong ? <Icon name="close-circle" size={20} color={colors.red} /> : null}
              </Pressable>
            );
          })}
        </View>
        {!solved ? (
          <NeonButton label="Lock in answer" icon="target" variant="amber" onPress={lockIn} disabled={selected === null} style={{ marginTop: space.md }} />
        ) : null}
        {wrong.length > 0 && !solved ? <Text style={styles.retry}>{"Not quite — that output can't happen. Trace the code line by line and try again."}</Text> : null}
      </Panel>

      {solved ? (
        <>
          <Panel title="Debrief" accent={colors.emerald}>
            <Text style={styles.explain}>{level.explanation}</Text>
          </Panel>
          {trace || tracing ? (
            <ConsolePanel result={trace} running={tracing} />
          ) : (
            <NeonButton label="Run it for real" icon="console" variant="cyan" onPress={runForReal} />
          )}
        </>
      ) : null}
      {!solved ? <Label color={colors.textFaint}>Tip: work it out on paper — the engine unlocks after you answer.</Label> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1.5, borderRadius: radius.sm, padding: space.md, minHeight: 50 },
  letter: { fontFamily: fonts.mono, fontWeight: '800', fontSize: 14, width: 18 },
  choiceText: { fontFamily: fonts.mono, color: colors.text, fontSize: 15, flex: 1 },
  struck: { textDecorationLine: 'line-through', color: colors.textFaint },
  retry: { color: colors.red, fontSize: 13, marginTop: space.sm },
  explain: { color: colors.text, fontSize: 15, lineHeight: 22 },
});
