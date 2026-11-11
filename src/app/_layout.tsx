import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { PythonEngineHost } from '../engine/PythonEngineHost';
import { useHydrated } from '../store/progress';
import { colors } from '../theme';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.panel,
    border: colors.border,
    primary: colors.cyan,
    text: colors.text,
  },
};

export default function RootLayout() {
  const hydrated = useHydrated();

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      {/* Boots Pyodide in the background as soon as the app starts. */}
      <PythonEngineHost />
      {hydrated ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="level/[id]" />
        </Stack>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.cyan} />
        </View>
      )}
    </ThemeProvider>
  );
}
