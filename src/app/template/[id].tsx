import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Field, ListRow, N, OutlineButton, PrimaryButton, SectionLabel, Segmented, StepButton, T, color, hairline } from '@/design-system';
import { ExercisePicker } from '../../components/ExercisePicker';
import type { TemplateExercise, WorkoutTemplate } from '../../domain/models';
import { uuid } from '../../lib/id';
import { useStore } from '../../store/store';

/** 分割テンプレートの編集（名前・既定の日タイプ・種目とセット数・重量・回数） */
export default function TemplateEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const existing = useStore((s) => s.templates.find((t) => t.id === id));
  const exercises = useStore((s) => s.exercises);
  const saveTemplate = useStore((s) => s.saveTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const isNew = id === 'new';

  const [name, setName] = useState(existing?.name ?? '');
  const [dayType, setDayType] = useState<'high' | 'normal'>(existing?.defaultDayType === 'high' ? 'high' : 'normal');
  const [rows, setRows] = useState<TemplateExercise[]>(existing?.exercises ?? []);
  const [picker, setPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exName = (exId: string) => exercises.find((e) => e.id === exId)?.name ?? '種目';

  const upd = (i: number, patch: Partial<TemplateExercise>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const c = r.slice();
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const save = () => {
    const t: WorkoutTemplate = { id: isNew ? uuid() : id, name: name.trim(), defaultDayType: dayType, exercises: rows, sortOrder: existing?.sortOrder ?? 99 };
    saveTemplate(t);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>{isNew ? 'テンプレートをつくる' : 'テンプレートを編集'}</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>
        <View style={{ marginTop: 14 }}>
          <Field label="名前" value={name} onChangeText={setName} placeholder="例：脚の日" />
        </View>
        <View style={{ marginTop: 16 }}><SectionLabel>既定の日タイプ</SectionLabel></View>
        <View style={{ marginTop: 6 }}>
          <Segmented value={dayType} onChange={setDayType} options={[{ value: 'high', label: '高（脚の日など）' }, { value: 'normal', label: '通常' }]} />
        </View>
        <T size={11} c={color.sub} style={{ marginTop: 6 }}>「通常」でも、ボリュームが普段の1.3倍以上なら、その日は「高」に変わります。</T>

        <View style={{ marginTop: 20 }}><SectionLabel>種目</SectionLabel></View>
        {rows.map((r, i) => (
          <View key={`${r.exerciseId}-${i}`} style={{ borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 10, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={14} w={700} style={{ flex: 1 }}>{exName(r.exerciseId)}</T>
              <Pressable accessibilityRole="button" accessibilityLabel="上へ" onPress={() => move(i, -1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={15} c={color.sub}>↑</T></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="下へ" onPress={() => move(i, 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={15} c={color.sub}>↓</T></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="外す" onPress={() => setRows((x) => x.filter((_, j) => j !== i))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><T size={16} c={color.sub}>×</T></Pressable>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Mini label="セット" value={String(r.sets)} onDown={() => upd(i, { sets: Math.max(1, r.sets - 1) })} onUp={() => upd(i, { sets: Math.min(10, r.sets + 1) })} />
              <Mini label="kg" value={String(r.kg)} onDown={() => upd(i, { kg: Math.max(0, Math.round((r.kg - 2.5) * 10) / 10) })} onUp={() => upd(i, { kg: Math.round((r.kg + 2.5) * 10) / 10 })} />
              <Mini label="回" value={String(r.reps)} onDown={() => upd(i, { reps: Math.max(1, r.reps - 1) })} onUp={() => upd(i, { reps: r.reps + 1 })} />
            </View>
          </View>
        ))}
        {rows.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 12 }}>まだ種目がありません。</T>}
        <ListRow title="＋ 種目を追加" onPress={() => setPicker(true)} />
        <T size={11} c={color.sub} style={{ marginTop: 6 }}>重さと回数は初期値です。一度記録すると、前回の値に置き換わります。</T>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 8 }}>
        <PrimaryButton label="保存" disabled={!name.trim() || rows.length === 0} onPress={save} />
        {!isNew && (
          <OutlineButton
            label={confirmDelete ? 'もう一度押すと削除（週間スケジュールからも外れます）' : 'このテンプレートを削除'}
            onPress={() => {
              if (!confirmDelete) return setConfirmDelete(true);
              deleteTemplate(id);
              router.back();
            }}
          />
        )}
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => setRows((r) => [...r, { exerciseId: e.id, sets: 3, kg: 20, reps: 10 }])} />
    </View>
  );
}

function Mini({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <T size={11} c={color.sub}>{label}</T>
      <StepButton label="−" onPress={onDown} />
      <N size={16} w={600} style={{ minWidth: 34, textAlign: 'center' }}>{value}</N>
      <StepButton label="+" onPress={onUp} />
    </View>
  );
}
