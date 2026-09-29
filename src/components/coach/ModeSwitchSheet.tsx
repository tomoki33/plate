import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { N, Sheet, T, color, hairline, radius } from '@/design-system';
import { aggregateForSwitch } from '../../features/coach/switchInfo';
import { useCoach } from '../../store/coachStore';
import { useStore } from '../../store/store';
import { ModeIcon } from './CoachBits';

/** 「自分」と「コーチ」を切り替える下からのシート（ワードマークを押すと出る）。コーチがオンの人だけ */
export function ModeSwitchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const mode = useCoach((s) => s.mode);
  const setMode = useCoach((s) => s.setMode);
  const students = useCoach((s) => s.students);
  const showToast = useStore((s) => s.showToast);
  const refresh = useCoach((s) => s.refreshCoach);
  // 開いたときに、生徒の人数と「声かけを」の人数を最新にする
  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);
  const info = aggregateForSwitch(students);
  const selfDesc = '自分の記録・目標・メニュー';

  const pick = (m: 'self' | 'coach') => {
    onClose();
    if (m === mode) return;
    setMode(m);
    router.replace(m === 'coach' ? '/students' : '/');
    showToast(m === 'coach' ? 'コーチに切り替えました' : '自分に切り替えました');
  };

  const row = (m: 'self' | 'coach', title: string, desc: string) => {
    const on = mode === m;
    return (
      <Pressable
        key={m}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => pick(m)}
        style={{ minHeight: 72, paddingHorizontal: 16, backgroundColor: color.surface, borderWidth: on ? 1.5 : hairline, borderColor: on ? color.text : color.line, borderRadius: radius.card + 2, flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <ModeIcon inverted={m === 'coach'} />
        <View style={{ flex: 1, gap: 3 }}>
          <T size={15} w={700}>{title}</T>
          <T size={12} c={color.sub} numberOfLines={1}>{desc}</T>
        </View>
        <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: on ? color.text : color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: on ? color.text : 'transparent' }} />
        </View>
      </Pressable>
    );
  };

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        {row('self', '自分', selfDesc)}
        {row('coach', 'コーチ', info)}
        <N size={11} w={500} c={color.sub} style={{ textAlign: 'center', paddingTop: 4 }}>ワードマークを押すと、いつでも切り替えられます</N>
      </View>
    </Sheet>
  );
}
