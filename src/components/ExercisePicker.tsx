import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Sheet, T, color, font, hairline, radius } from '@/design-system';
import { fold } from '../domain/foodSearch';
import type { Exercise } from '../domain/models';
import type { Part } from '../domain/training';
import { useStore } from '../store/store';

const PARTS: Part[] = ['胸', '背中', '脚', '肩', '腕', '腹'];

/**
 * 種目を追加する下のシート（メニュー編集と、トレーニング中の「＋」の両方から開く）。
 * 検索欄と部位の絞り込み。よく使う呼び方（BSS・RDL・OHP など）でも引ける。
 * すでに入っている種目は「追加済」。検索した名前が一覧にないときは、「新しい種目として作る」を一番上に出す。
 */
export function ExercisePicker({ open, onClose, onPick, usedIds = [] }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void; usedIds?: string[] }) {
  const exercises = useStore((s) => s.exercises);
  const addCustom = useStore((s) => s.addCustomExercise);
  const [q, setQ] = useState('');
  const [part, setPart] = useState<Part | null>(null);
  const [choosePart, setChoosePart] = useState(false);

  const list = useMemo(() => {
    const fq = fold(q.trim());
    return exercises
      .filter((e) => (!part || e.part === part) && (!fq || fold(e.name).includes(fq) || fold(e.aliases ?? '').includes(fq)))
      .slice(0, 60);
  }, [exercises, q, part]);
  const name = q.trim();
  // 名前か別名がぴったり一致する種目があるときは、「新しい種目として作る」を出さない
  const fname = fold(name);
  const exact = !!name && exercises.some((e) => fold(e.name) === fname || fold(e.aliases ?? '').split(/\s+/).includes(fname));

  const close = () => {
    setQ('');
    setChoosePart(false);
    onClose();
  };
  const pick = (e: Exercise) => {
    onPick(e);
    close();
  };
  const create = (p: Part) => {
    const id = addCustom(name, p);
    const created = useStore.getState().exercises.find((e) => e.id === id)!;
    pick(created);
  };

  return (
    <Sheet visible={open} onClose={close}>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={18} w={900}>種目を追加</T>
        <Pressable accessibilityRole="button" onPress={close} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <T size={14} c={color.sub}>閉じる</T>
        </Pressable>
      </View>
      <TextInput
        value={q}
        onChangeText={(v) => { setQ(v); setChoosePart(false); }}
        placeholder="種目名で検索（例：ベンチ、RDL）"
        placeholderTextColor={color.faint}
        style={{ marginHorizontal: 16, marginTop: 6, height: 48, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp, fontSize: 15, color: color.text }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 16, paddingTop: 10 }}>
        {(['すべて', ...PARTS] as const).map((c) => {
          const on = c === 'すべて' ? part === null : part === c;
          return (
            <Pressable key={c} accessibilityRole="button" onPress={() => setPart(c === 'すべて' ? null : c)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: hairline, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.text : color.surface }}>
              <T size={13} c={on ? color.onText : color.text}>{c}</T>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ height: 380, marginTop: 6 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {!!name && !exact && (
          <View style={{ borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <Pressable accessibilityRole="button" onPress={() => (part ? create(part) : setChoosePart(true))} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: radius.button, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
                <T size={18} c={color.onText}>＋</T>
              </View>
              <T size={14} w={700} style={{ flex: 1 }}>「{name}」を新しい種目として作る</T>
            </Pressable>
            {choosePart && (
              <View style={{ paddingBottom: 10, gap: 8 }}>
                <T size={12} c={color.sub}>部位を選んでください</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {PARTS.map((p) => (
                    <Pressable key={p} accessibilityRole="button" onPress={() => create(p)} style={{ height: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: hairline, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                      <T size={13}>{p}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        {list.map((e) => {
          const used = usedIds.includes(e.id);
          const alias = (e.aliases ?? '').trim();
          return (
            <Pressable key={e.id} accessibilityRole="button" disabled={used} onPress={() => pick(e)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <T size={15}>{e.name}</T>
                <T size={11.5} c={color.sub} numberOfLines={1}>{e.part}{alias ? `・${alias}` : ''}</T>
              </View>
              <T size={13} w={700} c={used ? color.sub : color.text} style={{ minWidth: 44, textAlign: 'center', flexShrink: 0 }}>{used ? '追加済' : '＋'}</T>
            </Pressable>
          );
        })}
        {list.length === 0 && !name && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>該当する種目がありません。</T>}
      </ScrollView>
    </Sheet>
  );
}
