import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, MAX_WIDTH, space } from '../theme';
import { GridBackground } from './ui';

/** Screen shell: synth-grid backdrop, safe area, centred max-width scroll column. */
export function Screen({
  children,
  header,
  ...scrollProps
}: { children: ReactNode; header?: ReactNode } & ScrollViewProps) {
  return (
    <View style={styles.root}>
      <GridBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {header ? <View style={styles.headerWrap}><View style={styles.column}>{header}</View></View> : null}
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgDeep },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: 64 },
  column: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
});
