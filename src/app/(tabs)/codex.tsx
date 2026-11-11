import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Icon, Label, Panel, ProgressBar, type IconName } from '../../components/ui';
import { levels, levelsInWorld, worlds } from '../../content';
import type { Career } from '../../content/types';
import { useProgress } from '../../store/progress';
import { accentColor, alpha, colors, fonts, radius, space } from '../../theme';

const CAREERS: { id: Career; name: string; short: string; icon: IconName; color: string }[] = [
  { id: 'dataScience', name: 'Data Science', short: 'DATA', icon: 'chart-scatter-plot', color: colors.emerald },
  { id: 'softwareEngineering', name: 'Software Engineering', short: 'SWE', icon: 'server', color: colors.cyan },
  { id: 'webDevelopment', name: 'Web Development', short: 'WEB', icon: 'web', color: colors.amber },
];

type Filter = Career | 'all';

/** Career Path Codex: every solved concept, mapped onto DS / SWE / Web. */
export default function Codex() {
  const solved = useProgress((s) => s.solved);
  const [filter, setFilter] = useState<Filter>('all');
  const decrypted = levels.filter((l) => solved[l.id]).length;
  const shown = filter === 'all' ? CAREERS : CAREERS.filter((c) => c.id === filter);

  return (
    <Screen
      header={
        <View>
          <Text style={styles.h1}>CAREER PATH CODEX</Text>
          <Text style={styles.sub}>{"Each concept you clear decrypts how it's used on the job."}</Text>
        </View>
      }
    >
      <Panel title="Decryption progress" accent={colors.violet}>
        <Text style={styles.big}>
          {decrypted}
          <Text style={styles.bigDim}> / {levels.length} concepts</Text>
        </Text>
        <ProgressBar value={decrypted / levels.length} color={colors.violet} />
        <Text style={[styles.sub, { marginTop: space.sm }]}>
          Every concept in PyQuest is foundational to all three tracks — the difference is in how it gets applied.
        </Text>
      </Panel>

      <View style={styles.filters} accessibilityRole="tablist">
        {[{ id: 'all' as const, short: 'ALL', color: colors.violet, icon: 'all-inclusive' as IconName }, ...CAREERS].map((c) => {
          const active = filter === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setFilter(c.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.filter, { borderColor: active ? c.color : colors.border, backgroundColor: active ? alpha(c.color, 0.14) : 'transparent' }]}
            >
              <Icon name={c.icon} size={14} color={active ? c.color : colors.textDim} />
              <Text style={[styles.filterText, { color: active ? c.color : colors.textDim }]}>{c.short}</Text>
            </Pressable>
          );
        })}
      </View>

      {worlds.map((w) => {
        const accent = accentColor(w.accent);
        return (
          <View key={w.id} style={{ marginTop: space.xl, gap: space.sm }}>
            <Label color={accent}>
              W{w.id} · {w.codename} — {w.title}
            </Label>
            {levelsInWorld(w.id).map((l) => {
              const open = !!solved[l.id];
              return (
                <View key={l.id} style={[styles.card, { borderColor: open ? alpha(accent, 0.45) : colors.border }]}>
                  <View style={styles.cardHead}>
                    <Icon name={open ? 'lock-open-variant' : 'lock'} size={16} color={open ? accent : colors.textFaint} />
                    <Text style={[styles.concept, !open && { color: colors.textFaint }]}>{l.concept}</Text>
                  </View>
                  {open ? (
                    <View style={{ gap: space.sm, marginTop: space.sm }}>
                      {shown.map((c) => (
                        <View key={c.id} style={[styles.career, { borderLeftColor: c.color }]}>
                          <View style={styles.careerHead}>
                            <Icon name={c.icon} size={14} color={c.color} />
                            <Text style={[styles.careerName, { color: c.color }]}>{c.name}</Text>
                          </View>
                          <RichText text={l.careers[c.id]} />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.locked}>▒▒▒▒▒▒▒▒ Clear “{l.title}” to decrypt ▒▒▒▒▒▒▒▒</Text>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}
    </Screen>
  );
}

/** Renders `inline code` spans in monospace. */
function RichText({ text }: { text: string }) {
  return (
    <Text style={styles.careerText}>
      {text.split('`').map((part, i) =>
        i % 2 ? (
          <Text key={i} style={styles.inlineCode}>
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: fonts.mono, fontWeight: '900', fontSize: 17, color: colors.violet, letterSpacing: 2 },
  sub: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  big: { fontFamily: fonts.mono, fontSize: 30, fontWeight: '900', color: colors.violet, marginBottom: space.sm },
  bigDim: { fontSize: 14, color: colors.textDim, fontWeight: '600' },
  filters: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, flexWrap: 'wrap' },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  filterText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  card: { backgroundColor: alpha(colors.panel, 0.92), borderWidth: 1, borderRadius: radius.md, padding: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  concept: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  career: { borderLeftWidth: 3, paddingLeft: space.sm, gap: 2 },
  careerHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  careerName: { fontFamily: fonts.mono, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  careerText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  inlineCode: { fontFamily: fonts.mono, fontSize: 13, color: colors.cyan, backgroundColor: colors.bgDeep },
  locked: { fontFamily: fonts.mono, color: colors.textFaint, fontSize: 12, marginTop: space.sm },
});
