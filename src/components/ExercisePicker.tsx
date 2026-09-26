import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Chip, Field, PrimaryButton, Sheet, T, color, hairline } from '@/design-system';
import { fold } from '../domain/foodSearch';
import type { Exercise } from '../domain/models';
import type { Part } from '../domain/training';
import { useStore } from '../store/store';

const PARTS: Part[] = ['脚', '背中', '胸', '肩', '腕', '腹'];

/** 種目の選択（検索・部位で絞り込み・自分の種目を作る） */
export function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const exercises = useStore((s) => s.exercises);
  const addCustom = useStore((s) => s.addCustomExercise);
  const [q, setQ] = useState('');
  const [part, setPart] = useState<Part | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPart, setNewPart] = useState<Part>('胸');

  const list = useMemo(() => {
    const fq = fold(q.trim());
    return exercises.filter((e) => (!part || e.part === part) && (!fq || fold(e.name).includes(fq)));
  }, [exercises, q, part]);

  const create = () => {
    const name = q.trim();
    if (!name) return;
    const id = addCustom(name, newPart);
    const created = useStore.getState().exercises.find((e) => e.id === id)!;
    setCreating(false);
    setQ('');
    onPick(created);
    onClose();
  };

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <T size={17} w={900}>種目を選ぶ</T>
        <Field value={q} onChangeText={setQ} placeholder="種目名で検索" style={{ marginTop: 10 }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
          <Chip label="すべて" selected={part === null} onPress={() => setPart(null)} />
          {PARTS.map((p) => (
            <Chip key={p} label={p} selected={part === p} onPress={() => setPart(part === p ? null : p)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {list.map((e) => (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => {
              onPick(e);
              onClose();
            }}
            style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: hairline, borderTopColor: color.line }}
          >
            <T size={14}>{e.name}</T>
            <T size={11} c={color.sub}>{e.part}{e.isCustom ? '・自作' : ''}</T>
          </Pressable>
        ))}
        {list.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>見つかりませんでした。</T>}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {!creating ? (
          <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={700}>＋ 種目をつくる{q.trim() ? `（「${q.trim()}」）` : ''}</T>
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <T size={12} c={color.sub}>「{q.trim() || '（上の欄に名前を入力）'}」の部位</T>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {PARTS.map((p) => (
                <Chip key={p} label={p} selected={newPart === p} onPress={() => setNewPart(p)} />
              ))}
            </View>
            <PrimaryButton label="この種目をつくる" disabled={!q.trim()} onPress={create} />
          </View>
        )}
      </View>
    </Sheet>
  );
}
