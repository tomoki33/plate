import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon, type TabIconName } from '../../components/TabIcons';
import { color, font, hairline } from '../../theme';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: '今日', icon: 'today' },
  { name: 'training', title: 'トレ', icon: 'train' },
  { name: 'review', title: 'レビュー', icon: 'review' },
  { name: 'settings', title: '設定', icon: 'settings' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.sub,
        tabBarStyle: { backgroundColor: '#fff', borderTopWidth: hairline, borderTopColor: color.line, height: 48 + insets.bottom, elevation: 0, shadowOpacity: 0 },
        tabBarItemStyle: { height: 48, paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: font.jp500 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ focused }) => <TabIcon name={t.icon} focused={focused} /> }} />
      ))}
    </Tabs>
  );
}
