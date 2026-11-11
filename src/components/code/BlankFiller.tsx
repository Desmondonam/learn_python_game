import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { CodeRepairLevel } from '../../content/types';
import { feedback } from '../../feedback/sfx';
import { alpha, colors, fonts, radius, space } from '../../theme';
import { Label } from '../ui';
import { codeStyles, HighlightedLine } from './CodeView';

type Segment = { kind: 'code'; text: string } | { kind: 'blank'; id: string };

function parseTemplate(template: string): Segment[][] {
  return template
    .replace(/\n$/, '')
    .split('\n')
    .map((line) => {
      const segs: Segment[] = [];
      let last = 0;
      for (const m of line.matchAll(/\{\{(\w+)\}\}/g)) {
        if (m.index! > last) segs.push({ kind: 'code', text: line.slice(last, m.index) });
        segs.push({ kind: 'blank', id: m[1] });
        last = m.index! + m[0].length;
      }
      if (last < line.length || segs.length === 0) segs.push({ kind: 'code', text: line.slice(last) || ' ' });
      return segs;
    });
}

/**
 * Code Repair mechanic: broken code with inline slots.
 * Tap a slot to select it, then tap a token chip — or type directly into the slot.
 */
export function BlankFiller({
  level,
  fills,
  onChange,
  errorLine,
  locked,
}: {
  level: CodeRepairLevel;
  fills: Record<string, string>;
  onChange: (fills: Record<string, string>) => void;
  errorLine?: number | null;
  locked?: boolean;
}) {
  const lines = useMemo(() => parseTemplate(level.template), [level.template]);
  const order = useMemo(() => level.blanks.map((b) => b.id), [level.blanks]);
  const [active, setActive] = useState<string>(order[0]);

  function setFill(id: string, value: string, advance: boolean) {
    const next = { ...fills, [id]: value };
    onChange(next);
    if (advance) {
      const empty = order.find((b) => !next[b]?.trim());
      if (empty) setActive(empty);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <ScrollView horizontal style={styles.codeBox} contentContainerStyle={{ paddingVertical: space.sm, paddingRight: space.lg }} keyboardShouldPersistTaps="handled">
        <View>
          {lines.map((segs, i) => (
            <View key={i} style={[styles.line, errorLine === i + 1 && styles.errLine]}>
              <Text style={[codeStyles.gutter, errorLine === i + 1 && { color: colors.red }]}>{i + 1}</Text>
              {segs.map((s, j) =>
                s.kind === 'code' ? (
                  <Text key={j} style={codeStyles.code}>
                    <HighlightedLine line={s.text} />
                  </Text>
                ) : (
                  <TextInput
                    key={j}
                    value={fills[s.id] ?? ''}
                    editable={!locked}
                    onFocus={() => setActive(s.id)}
                    onChangeText={(t) => setFill(s.id, t, false)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    placeholder="____"
                    placeholderTextColor={alpha(colors.amber, 0.5)}
                    accessibilityLabel={`Blank ${order.indexOf(s.id) + 1}`}
                    style={[
                      styles.slot,
                      { width: Math.max(4, (fills[s.id] ?? '').length + 1) * 8.6 + 14 },
                      active === s.id && !locked && styles.slotActive,
                      Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
                    ]}
                  />
                ),
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      {!locked ? (
        <View style={{ gap: space.sm }}>
          <Label>Token bank · tap to fill blank {order.indexOf(active) + 1}</Label>
          <View style={styles.bank}>
            {level.tokenBank.map((tok) => {
              const used = Object.values(fills).includes(tok);
              return (
                <Pressable
                  key={tok}
                  onPress={() => {
                    feedback.tap();
                    setFill(active, tok, true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Token ${tok}`}
                  style={({ pressed }) => [styles.chip, used && styles.chipUsed, pressed && { transform: [{ scale: 0.95 }] }]}
                >
                  <Text style={[styles.chipText, used && { color: colors.textDim }]}>{tok}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  codeBox: { backgroundColor: colors.bgDeep, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  line: { flexDirection: 'row', alignItems: 'center', minHeight: 30 },
  errLine: { backgroundColor: alpha(colors.red, 0.12) },
  slot: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.amber,
    borderBottomWidth: 2,
    borderColor: alpha(colors.amber, 0.5),
    backgroundColor: alpha(colors.amber, 0.08),
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginHorizontal: 2,
    borderRadius: 3,
    textAlign: 'center',
    height: 26,
  },
  slotActive: { borderColor: colors.amber, backgroundColor: alpha(colors.amber, 0.18) },
  bank: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderColor: alpha(colors.cyan, 0.6), backgroundColor: alpha(colors.cyan, 0.08), borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 8 },
  chipUsed: { borderColor: colors.border, backgroundColor: colors.panelAlt },
  chipText: { fontFamily: fonts.mono, color: colors.cyan, fontSize: 14, fontWeight: '700' },
});
