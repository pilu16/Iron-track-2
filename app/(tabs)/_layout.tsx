import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BACKGROUND, ACCENT, TEXT_SECONDARY, BORDER } from '../../constants/colors';
import { FONT_MONO_BOLD } from '../../constants/fonts';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

const TAB_ICON: Record<string, IconName> = {
  index: 'lightning-bolt',
  journal: 'notebook-outline',
  stats: 'chart-bar',
  corps: 'human',
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BACKGROUND,
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: TEXT_SECONDARY,
        tabBarLabelStyle: {
          fontFamily: FONT_MONO_BOLD,
          fontSize: 9,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        },
        tabBarIcon: ({ color, size }) => (
          <MaterialCommunityIcons
            name={TAB_ICON[route.name] ?? 'circle'}
            color={color}
            size={size}
          />
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="journal" options={{ title: 'Journal' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="corps" options={{ title: 'Corps' }} />
    </Tabs>
  );
}
