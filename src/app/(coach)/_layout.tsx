import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, font, hairline } from '@/design-system';
import { CoachTabIcon } from '../../components/coach/CoachBits';
import { useCoach } from '../../store/coachStore';

/**
 * コーチモード：タブは 生徒 / メニュー / 設定 の3つ。
 * ルート名は、自分側の (tabs) と重ならないようにしてある（/students・/menus・/coach-settings）。
 * 生徒の詳細と目標の編集は、タブに出さない隠し画面。目標の編集中はタブバーも隠す。
 */
export default function CoachLayout() {
  const insets = useSafeAreaInsets();
  const enabled = useCoach((s) => s.enabled);
  const mode = useCoach((s) => s.mode);
  if (!enabled || mode !== 'coach') return <Redirect href="/" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.sub,
        tabBarStyle: { backgroundColor: color.surface, borderTopWidth: hairline, borderTopColor: color.line, height: 66 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom, elevation: 0, shadowOpacity: 0 },
        tabBarItemStyle: { height: 58, paddingVertical: 0 },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, marginTop: 2, marginBottom: 0, fontFamily: font.jp500 },
      }}
    >
      <Tabs.Screen name="students" options={{ title: '生徒', tabBarIcon: ({ focused }) => <CoachTabIcon name="people" focused={focused} /> }} />
      <Tabs.Screen name="menus" options={{ title: 'メニュー', tabBarIcon: ({ focused }) => <CoachTabIcon name="menu" focused={focused} /> }} />
      <Tabs.Screen name="coach-settings" options={{ title: '設定', tabBarIcon: ({ focused }) => <CoachTabIcon name="settings" focused={focused} /> }} />
      <Tabs.Screen name="student/[id]" options={{ href: null }} />
      <Tabs.Screen name="goal/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="menu/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}
