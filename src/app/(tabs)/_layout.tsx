import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon, type TabIconName } from '../../components/TabIcons';
import { color, font, hairline } from '@/design-system';
import { SelfHeader } from '../../components/coach/Frames';
import { useCoach } from '../../store/coachStore';

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: 'index', title: '今日', icon: 'today' },
  { name: 'training', title: 'トレーニング', icon: 'train' },
  { name: 'review', title: 'レビュー', icon: 'review' },
  { name: 'settings', title: '設定', icon: 'settings' },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const enabled = useCoach((s) => s.enabled);
  const mode = useCoach((s) => s.mode);
  // 最後にコーチで閉じたなら、コーチ画面で開く
  if (enabled && mode === 'coach') return <Redirect href="/students" />;
  return (
    <Tabs
      screenOptions={{
        // コーチをオンにした人だけ、ワードマーク（PLATE ▾）のヘッダーが付く。オフの人は今までどおり
        headerShown: enabled,
        header: () => <SelfHeader />,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.sub,
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: hairline, borderTopColor: color.line, height: 66 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom, elevation: 0, shadowOpacity: 0 },
        // 各タブの高さは58、アイコンは26（v2）
        tabBarItemStyle: { height: 58, paddingVertical: 0 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, marginTop: 2, marginBottom: 0, fontFamily: font.jp500 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title, tabBarIcon: ({ focused }) => <TabIcon name={t.icon} focused={focused} /> }} />
      ))}
    </Tabs>
  );
}
