import { Tabs } from 'expo-router/js-tabs';
import { Icon, type IconName } from '../../components/ui';
import { colors, fonts } from '../../theme';

const tab = (title: string, icon: IconName) => ({
  title,
  tabBarIcon: ({ color, size }: { color: unknown; size: number }) => <Icon name={icon} color={color as string} size={size} />,
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.bgDeep, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={tab('MAP', 'map-marker-path')} />
      <Tabs.Screen name="codex" options={tab('CODEX', 'book-open-variant')} />
      <Tabs.Screen name="profile" options={tab('PROFILE', 'account-circle')} />
    </Tabs>
  );
}
