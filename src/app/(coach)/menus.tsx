import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { T, color, hairline } from '@/design-system';
import { CoachFrame } from '../../components/coach/Frames';
import { menuUsage } from '../../features/coach/aggregate';
import { useCoach } from '../../store/coachStore';

/** メニュー：コーチが作るひな形の一覧。生徒に送るとコピーが作られる */
export default function Menus() {
  const router = useRouter();
  const menus = useCoach((s) => s.menus);
  const students = useCoach((s) => s.students);
  const refresh = useCoach((s) => s.refreshCoach);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  return (
    <CoachFrame>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={18} w={700}>メニュー</T>
          <T size={12} c={color.sub}>生徒に送れるひな形</T>
        </View>
        <View style={{ marginHorizontal: 16, gap: 10 }}>
          {menus.map((m) => {
            const n = menuUsage(students, m.id);
            return (
              <Pressable key={m.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/menu/[id]', params: { id: m.id } })} style={{ backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T size={16} w={700}>{m.name}</T>
                  <T size={12} c={color.sub}>{n ? `${n}人に送信中` : '未送信'}</T>
                </View>
                <T size={13} c={color.badgeFg} style={{ lineHeight: 21 }}>{m.exercises.map((e) => e.name).join('・') || '種目なし'}</T>
              </Pressable>
            );
          })}
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/menu/[id]', params: { id: 'new' } })} style={{ height: 56, borderWidth: 1, borderStyle: 'dashed', borderColor: color.lineStrong, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <T size={15} w={700}>＋ メニューを作る</T>
          </Pressable>
        </View>
      </ScrollView>
    </CoachFrame>
  );
}
