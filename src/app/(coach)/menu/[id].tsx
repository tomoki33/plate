import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { N, PrimaryButton, T, color, font, hairline } from '@/design-system';
import { CoachFrame } from '../../../components/coach/Frames';
import { ExercisePicker } from '../../../components/ExercisePicker';
import * as api from '../../../features/coach/api';
import type { MenuExercise } from '../../../features/coach/types';
import { useCoach } from '../../../store/coachStore';
import { useStore } from '../../../store/store';

/** メニューの編集（コーチのひな形）。種目の選び方は、自分のメニュー編集と同じ */
export default function CoachMenuEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const existing = useCoach((s) => s.menus.find((m) => m.id === id));
  const coach = useCoach((s) => s.coach);
  const refresh = useCoach((s) => s.refreshCoach);
  const exercises = useStore((s) => s.exercises);
  const showToast = useStore((s) => s.showToast);
  const isNew = id === 'new';
  const [name, setName] = useState(existing?.name ?? '');
  const [dayType, setDayType] = useState<'high' | 'normal'>(existing?.defaultDayType === 'high' ? 'high' : 'normal');
  const [rows, setRows] = useState<MenuExercise[]>(existing?.exercises ?? []);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const setSets = (i: number, d: number) => setRows((r) => r.map((x, j) => (j === i ? { ...x, sets: Math.min(10, Math.max(1, x.sets + d)) } : x)));
  const up = (i: number) => setRows((r) => { if (i <= 0) return r; const c = r.slice(); [c[i - 1], c[i]] = [c[i], c[i - 1]]; return c; });

  const save = async () => {
    if (!coach || busy) return;
    setBusy(true);
    setErr(null);
    const r = await api.saveMenu(coach.id, { id: isNew ? undefined : id, name: name.trim(), defaultDayType: dayType, exercises: rows, sortOrder: existing?.sortOrder ?? 0 });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await refresh();
    showToast('メニューを保存しました');
    router.back();
  };
  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    const r = await api.deleteMenu(id);
    if (!r.ok) return setErr(r.error);
    await refresh();
    router.back();
  };

  return (
    <CoachFrame back={{ label: 'メニュー', onPress: () => router.back() }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        <TextInput value={name} onChangeText={setName} placeholder="メニューの名前（例：脚の日）" placeholderTextColor={color.faint} style={{ marginHorizontal: 16, marginTop: 12, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp700, fontSize: 18, color: color.text }} />
        <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', backgroundColor: color.track, borderRadius: 8, padding: 3 }}>
          {([['高い日', 'high'], ['通常の日', 'normal']] as const).map(([label, v]) => (
            <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: dayType === v }} onPress={() => setDayType(v)} style={{ flex: 1, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: dayType === v ? color.surface : 'transparent' }}>
              <T size={14} w={dayType === v ? 700 : 400}>{label}</T>
            </Pressable>
          ))}
        </View>
        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>種目（上から順に表示）</T>
        <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }}>
          {rows.map((r, i) => (
            <View key={`${r.exerciseId}-${i}`} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 14, paddingRight: 6, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${r.name}を1つ上へ`} onPress={() => up(i)} style={{ width: 28, height: 44, justifyContent: 'center' }}><N size={15} c={color.sub}>{i + 1}</N></Pressable>
              <T size={14} w={500} style={{ flex: 1 }} numberOfLines={1}>{r.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, height: 40 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="セットを減らす" onPress={() => setSets(i, -1)} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}><T size={16}>−</T></Pressable>
                <N size={14} style={{ minWidth: 46, textAlign: 'center' }}>{r.sets}セット</N>
                <Pressable accessibilityRole="button" accessibilityLabel="セットを増やす" onPress={() => setSets(i, 1)} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}><T size={16}>＋</T></Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`${r.name}を外す`} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={16} c={color.faint}>×</T></Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center' }}><T size={14} w={700}>＋ 種目を追加</T></Pressable>
        </View>
        {err ? <T size={12} c={color.brandText} style={{ paddingHorizontal: 20, paddingTop: 10 }}>{err}</T> : null}
        {!isNew && (
          <Pressable accessibilityRole="button" onPress={remove} style={{ marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13} w={confirmDelete ? 700 : 400} c={color.brandText}>{confirmDelete ? 'もう一度押すと削除（すでに送った生徒のメニューは残ります）' : 'このメニューを削除'}</T>
          </Pressable>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14 }}>
        <PrimaryButton label={busy ? '保存しています…' : '保存'} disabled={!name.trim() || rows.length === 0 || busy || !coach} onPress={save} style={{ borderRadius: 10 }} />
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} usedIds={rows.map((r) => r.exerciseId)} onPick={(e) => setRows((r) => [...r, { exerciseId: e.id, name: e.name, part: e.part, sets: 3, kg: 20, reps: 10 }])} />
      <View style={{ display: 'none' }}>{exercises.length}</View>
    </CoachFrame>
  );
}
