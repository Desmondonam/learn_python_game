import { useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
} from 'react-native';
import { alpha, colors, fonts, radius, space } from '../../theme';
import { codeStyles } from './CodeView';

const INDENT = '    ';

/** Keys that are painful to reach on phone keyboards. */
const SYMBOL_KEYS: { label: string; insert: string; caretBack?: number }[] = [
  { label: '⇥', insert: INDENT },
  { label: ':', insert: ':' },
  { label: '( )', insert: '()', caretBack: 1 },
  { label: '[ ]', insert: '[]', caretBack: 1 },
  { label: '{ }', insert: '{}', caretBack: 1 },
  { label: '" "', insert: '""', caretBack: 1 },
  { label: '=', insert: '=' },
  { label: '==', insert: ' == ' },
  { label: '+=', insert: ' += ' },
  { label: '_', insert: '_' },
  { label: ',', insert: ', ' },
  { label: '#', insert: '# ' },
];

interface Selection {
  start: number;
  end: number;
}

/**
 * Mini code editor for the Live Console mechanic.
 *
 * - Monospace, no autocorrect or autocapitalisation.
 * - Auto-indent: Enter keeps the current indentation (+4 after a trailing ':').
 * - Tab inserts 4 spaces on hardware keyboards (web).
 * - A symbol bar inserts Python punctuation at the caret (mobile).
 */
export function CodeEditor({
  value,
  onChange,
  errorLine,
  editable = true,
}: {
  value: string;
  onChange: (code: string) => void;
  errorLine?: number | null;
  editable?: boolean;
}) {
  const selection = useRef<Selection>({ start: value.length, end: value.length });
  // Only set when we move the caret programmatically; otherwise the input owns its selection.
  const [forced, setForced] = useState<Selection | undefined>(undefined);
  const input = useRef<TextInputInstance>(null);

  const lineCount = Math.max(value.split('\n').length, 6);

  function replaceSelection(text: string, caretBack = 0) {
    const { start, end } = selection.current;
    const next = value.slice(0, start) + text + value.slice(end);
    const caret = start + text.length - caretBack;
    onChange(next);
    selection.current = { start: caret, end: caret };
    setForced({ start: caret, end: caret });
    input.current?.focus();
  }

  function handleChange(next: string) {
    const prev = value;
    const pos = selection.current.start;
    // Detect a single newline typed at the caret, then auto-indent.
    if (
      next.length === prev.length + 1 &&
      next[pos] === '\n' &&
      next.slice(0, pos) === prev.slice(0, pos) &&
      next.slice(pos + 1) === prev.slice(selection.current.end)
    ) {
      const lineStart = prev.lastIndexOf('\n', pos - 1) + 1;
      const line = prev.slice(lineStart, pos);
      let indent = line.match(/^ */)?.[0] ?? '';
      if (/:\s*(#.*)?$/.test(line)) indent += INDENT;
      if (indent) {
        const withIndent = next.slice(0, pos + 1) + indent + next.slice(pos + 1);
        const caret = pos + 1 + indent.length;
        onChange(withIndent);
        selection.current = { start: caret, end: caret };
        setForced({ start: caret, end: caret });
        return;
      }
    }
    onChange(next);
  }

  function handleKeyPress(e: TextInputKeyPressEvent) {
    if (Platform.OS === 'web' && e.nativeEvent.key === 'Tab') {
      e.preventDefault();
      replaceSelection(INDENT);
    }
  }

  function handleSelection(e: TextInputSelectionChangeEvent) {
    selection.current = e.nativeEvent.selection;
    if (forced) setForced(undefined);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.editorRow}>
        <View style={styles.gutterCol} accessibilityElementsHidden importantForAccessibility="no">
          {Array.from({ length: lineCount }, (_, i) => (
            <Text key={i} style={[codeStyles.gutter, styles.gutterText, errorLine === i + 1 && { color: colors.red }]}>
              {i + 1}
            </Text>
          ))}
        </View>
        <TextInput
          ref={input}
          value={value}
          onChangeText={handleChange}
          onSelectionChange={handleSelection}
          onKeyPress={handleKeyPress}
          selection={forced}
          editable={editable}
          multiline
          scrollEnabled={false}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'default'}
          textAlignVertical="top"
          accessibilityLabel="Python code editor"
          style={[codeStyles.code, styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]}
          placeholder="# write your code here"
          placeholderTextColor={colors.textFaint}
        />
      </View>
      {editable ? (
        <ScrollView horizontal keyboardShouldPersistTaps="always" showsHorizontalScrollIndicator={false} style={styles.keybar} contentContainerStyle={{ gap: 6, padding: 6 }}>
          {SYMBOL_KEYS.map((k) => (
            <Pressable
              key={k.label}
              onPress={() => replaceSelection(k.insert, k.caretBack)}
              accessibilityLabel={`Insert ${k.insert.trim() || 'indent'}`}
              style={({ pressed }) => [styles.key, pressed && { backgroundColor: alpha(colors.cyan, 0.2) }]}
            >
              <Text style={styles.keyText}>{k.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bgDeep, borderRadius: radius.sm, borderWidth: 1, borderColor: alpha(colors.cyan, 0.35), overflow: 'hidden' },
  editorRow: { flexDirection: 'row', paddingTop: space.sm, paddingBottom: space.md },
  gutterCol: { paddingTop: Platform.OS === 'android' ? 2 : 0 },
  gutterText: {},
  input: { flex: 1, padding: 0, paddingRight: space.md, minHeight: 6 * 22, ...(Platform.OS === 'android' ? { paddingTop: 2 } : null) },
  keybar: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.panel, flexGrow: 0 },
  key: { minWidth: 40, height: 34, paddingHorizontal: 8, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.panelAlt },
  keyText: { fontFamily: fonts.mono, color: colors.cyan, fontSize: 14, fontWeight: '700' },
});
