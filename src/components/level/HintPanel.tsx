import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '../../theme';
import { NeonButton, Panel } from '../ui';

/** Hints reveal one at a time. Each reveal affects the star rating, so the cost is shown up front. */
export function HintPanel({
  hints,
  revealed,
  onReveal,
  nudge,
  disabled,
}: {
  hints: string[];
  revealed: number;
  onReveal: () => void;
  /** Highlight the button after repeated failures. */
  nudge?: boolean;
  disabled?: boolean;
}) {
  const remaining = hints.length - revealed;
  return (
    <Panel title={`Hints · ${revealed}/${hints.length}`} accent={colors.amber}>
      <View style={{ gap: space.sm }}>
        {hints.slice(0, revealed).map((h, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.num}>{i + 1}</Text>
            <Text style={styles.text}>{h}</Text>
          </View>
        ))}
        {remaining > 0 && !disabled ? (
          <>
            {nudge ? <Text style={styles.nudge}>Stuck? A hint might help.</Text> : null}
            <NeonButton
              label={revealed === 0 ? 'Decrypt a hint' : 'Next hint'}
              icon="key-variant"
              variant={nudge ? 'amber' : 'ghost'}
              compact
              onPress={onReveal}
            />
            <Text style={styles.cost}>Hints lower the max star rating for this run.</Text>
          </>
        ) : null}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  num: { fontFamily: fonts.mono, color: colors.amber, fontWeight: '800', width: 14 },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  nudge: { color: colors.amber, fontSize: 13 },
  cost: { color: colors.textFaint, fontSize: 11, fontFamily: fonts.mono },
});
