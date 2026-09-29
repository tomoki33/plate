import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { N, PrimaryButton, T, color, font, hairline } from '@/design-system';
import { ExercisePicker } from '../../components/ExercisePicker';
import type { TemplateExercise, WorkoutTemplate } from '../../domain/models';
import { uuid } from '../../lib/id';
import { useStore } from '../../store/store';

/**
 * メニュー（分割テンプレート）の編集。v2：
 * 名前・日タイプ（高い日／通常の日）・種目の行（番号を押すと1つ上へ、セット数±、×で削除）・＋ 種目を追加・保存。
 */
export default function MenuEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const existing = useStore((s) => s.templates.find((t) => t.id === id));
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const saveTemplate = useStore((s) => s.saveTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const showToast = useStore((s) => s.showToast);
  const isNew = id === 'new';

  const [name, setName] = useState(existing?.name ?? '');
  const [dayType, setDayType] = useState<'high' | 'normal'>(existing?.defaultDayType === 'high' ? 'high' : 'normal');
  const [rows, setRows] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exName = (exId: string) => exercises.find((e) => e.id === exId)?.name ?? '種目';

  /** 重さと回数は、前回の記録から自動で入る（記録がなければ、メニューの初期値） */
  const meta = (r: TemplateExercise) => {
    let kg = r.kg;
    let reps = r.reps;
    for (let i = sessions.length - 1; i >= 0; i--) {
      const done = sessions[i].exercises.find((e) => e.exerciseId === r.exerciseId)?.sets.filter((x) => x.done);
      if (done?.length) {
        kg = done[done.length - 1].kg;
        reps = done[done.length - 1].reps;
        break;
      }
    }
    return `${kg > 0 ? `${kg}kg × ` : '× '}${reps}回`;
  };

  const setSets = (i: number, d: number) => setRows((r) => r.map((x, j) => (j === i ? { ...x, sets: Math.min(10, Math.max(1, x.sets + d)) } : x)));
  const up = (i: number) =>
    setRows((r) => {
      if (i <= 0) return r;
      const c = r.slice();
      [c[i - 1], c[i]] = [c[i], c[i - 1]];
      return c;
    });

  const save = () => {
    const t: WorkoutTemplate = { id: isNew ? uuid() : id, name: name.trim(), defaultDayType: dayType, exercises: rows, sortOrder: existing?.sortOrder ?? 99 };
    saveTemplate(t);
    showToast('メニューを保存しました');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: 'center' }}>
          <T size={14} c={color.sub}>‹ 戻る</T>
        </Pressable>
        <T size={15} w={700}>メニュー</T>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="メニューの名前（例：脚の日）"
          placeholderTextColor={color.faint}
          style={{ marginHorizontal: 16, marginTop: 8, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp700, fontSize: 18, color: color.text }}
        />
        <View style={{ marginHorizontal: 16, marginTop: 12, flexDirection: 'row', backgroundColor: color.track, borderRadius: 8, padding: 3 }}>
          {([['高い日', 'high'], ['通常の日', 'normal']] as const).map(([label, v]) => (
            <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: dayType === v }} onPress={() => setDayType(v)} style={{ flex: 1, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: dayType === v ? color.surface : 'transparent' }}>
              <T size={14} w={dayType === v ? 700 : 400}>{label}</T>
            </Pressable>
          ))}
        </View>
        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>種目（上から順に表示）</T>
        <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }}>
          {rows.length === 0 && (
            <View style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={13} c={color.sub}>まだ種目がありません</T>
            </View>
          )}
          {rows.map((r, i) => (
            <View key={`${r.exerciseId}-${i}`} style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingLeft: 14, paddingRight: 6, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${exName(r.exerciseId)}を1つ上へ`} onPress={() => up(i)} style={{ width: 28, height: 44, justifyContent: 'center' }}>
                <N size={15} w={600} c={color.sub}>{i + 1}</N>
              </Pressable>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T size={14} w={500}>{exName(r.exerciseId)}</T>
                <N size={13} w={500} c={color.sub}>{meta(r)}</N>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, height: 40 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="セットを減らす" onPress={() => setSets(i, -1)} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}><T size={16}>−</T></Pressable>
                <N size={14} w={600} style={{ minWidth: 46, textAlign: 'center' }}>{r.sets}セット</N>
                <Pressable accessibilityRole="button" accessibilityLabel="セットを増やす" onPress={() => setSets(i, 1)} style={{ width: 36, height: 40, alignItems: 'center', justifyContent: 'center' }}><T size={16}>＋</T></Pressable>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`${exName(r.exerciseId)}を外す`} onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T size={16} c={color.faint}>×</T>
              </Pressable>
            </View>
          ))}
          <Pressable accessibilityRole="button" onPress={() => setPicker(true)} style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} w={700}>＋ 種目を追加</T>
          </Pressable>
        </View>
        <T size={12} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 10, lineHeight: 19 }}>番号を押すと1つ上へ移動。重さと回数は、前回の記録から自動で入ります。一覧にない種目は、検索した名前でそのまま作れます。</T>
        {!isNew && (
          <Pressable accessibilityRole="button" onPress={() => { if (!confirmDelete) return setConfirmDelete(true); deleteTemplate(id); router.back(); }} style={{ marginTop: 8, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13} w={confirmDelete ? 700 : 400} c={color.brandText}>{confirmDelete ? 'もう一度押すと削除（週間スケジュールからも外れます）' : 'このメニューを削除'}</T>
          </Pressable>
        )}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
        <PrimaryButton label="保存" disabled={!name.trim() || rows.length === 0} onPress={save} style={{ borderRadius: 10 }} />
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} usedIds={rows.map((r) => r.exerciseId)} onPick={(e) => setRows((r) => [...r, { exerciseId: e.id, sets: 3, kg: 20, reps: 10 }])} />
    </View>
  );
}
