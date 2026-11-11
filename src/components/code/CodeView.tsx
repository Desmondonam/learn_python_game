import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { alpha, colors, fonts, radius, space } from '../../theme';
import { tokenize, type TokenKind } from './highlight';

export const TOKEN_COLOR: Record<TokenKind, string> = {
  keyword: colors.codeKeyword,
  builtin: colors.codeBuiltin,
  string: colors.codeString,
  number: colors.codeNumber,
  comment: colors.codeComment,
  operator: colors.textDim,
  plain: colors.text,
};

export function HighlightedLine({ line }: { line: string }) {
  return (
    <>
      {tokenize(line).map((t, i) => (
        <Text key={i} style={{ color: TOKEN_COLOR[t.kind], fontStyle: t.kind === 'comment' ? 'italic' : 'normal' }}>
          {t.text}
        </Text>
      ))}
    </>
  );
}

/** Read-only, syntax-highlighted code with a line-number gutter. */
export function CodeView({ code, errorLine }: { code: string; errorLine?: number | null }) {
  const lines = code.replace(/\n$/, '').split('\n');
  return (
    <ScrollView horizontal style={styles.box} contentContainerStyle={styles.content} showsHorizontalScrollIndicator={false}>
      <View>
        {lines.map((line, i) => {
          const isErr = errorLine === i + 1;
          return (
            <View key={i} style={[styles.row, isErr && styles.errRow]}>
              <Text style={[styles.gutter, isErr && { color: colors.red }]}>{i + 1}</Text>
              <Text style={styles.code}>
                <HighlightedLine line={line || ' '} />
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export const codeStyles = StyleSheet.create({
  code: { fontFamily: fonts.mono, fontSize: 14, lineHeight: 22, color: colors.text },
  gutter: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 22, color: colors.textFaint, width: 26, textAlign: 'right', marginRight: space.md },
});

const styles = StyleSheet.create({
  box: { backgroundColor: colors.bgDeep, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  content: { paddingVertical: space.sm, paddingRight: space.lg },
  row: { flexDirection: 'row' },
  errRow: { backgroundColor: alpha(colors.red, 0.12) },
  ...codeStyles,
});
