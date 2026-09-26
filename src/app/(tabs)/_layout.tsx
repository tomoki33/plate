import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon, type TabIconName } from '../../components/TabIcons';
import { color, font, hairline } from '@/design-system';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: '今日', icon: 'today' },
  { name: 'training', title: 'トレーニング', icon: 'train' },
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
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: hairline, borderTopColor: color.line, height: 62 + insets.bottom, paddingTop: 6, elevation: 0, shadowOpacity: 0 },
        tabBarItemStyle: { height: 52, paddingVertical: 0 },
        tabBarLabelStyle: { fontSize: 10.5, lineHeight: 14, marginTop: 0, marginBottom: 2, fontFamily: font.jp500 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ focused }) => <TabIcon name={t.icon} focused={focused} /> }} />
      ))}
    </Tabs>
  );
}
