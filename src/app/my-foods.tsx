import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Field, ListRow, N, PrimaryButton, T, color } from '@/design-system';
import type { FoodItem } from '../domain/models';
import { useStore } from '../store/store';

const num = (s: string) => {
  const v = parseFloat(s.replace(/,/g, '.'));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

/** マイ食品（成分表にないもの・よく食べる市販品）。100gあたりで持つ */
export default function MyFoods() {
  const router = useRouter();
  const foods = useStore((s) => s.myFoods);
  const save = useStore((s) => s.saveMyFood);
  const del = useStore((s) => s.deleteMyFood);
  const [edit, setEdit] = useState<FoodItem | 'new' | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>マイ食品</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>
        <T size={12} c={color.sub} style={{ marginTop: 2 }}>数値は100gあたりです。食事の検索で、いちばん上に出ます。</T>

        {edit ? (
          <FoodForm
            initial={edit === 'new' ? null : edit}
            onCancel={() => setEdit(null)}
            onSave={(f) => {
              save(f);
              setEdit(null);
            }}
            onDelete={edit !== 'new' ? () => (del(edit.id), setEdit(null)) : undefined}
          />
        ) : (
          <>
            <View style={{ marginTop: 12 }}>
              {foods.map((f) => (
                <ListRow key={f.id} title={f.name} meta={`100gあたり P${f.p} F${f.f} C${f.c}・${f.kcal}kcal`} right={<T size={12} c={color.sub}>編集 ›</T>} onPress={() => setEdit(f)} minHeight={60} />
              ))}
              {foods.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>まだありません。</T>}
              <ListRow title="＋ マイ食品をつくる" onPress={() => setEdit('new')} />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function FoodForm({ initial, onSave, onCancel, onDelete }: { initial: FoodItem | null; onSave: (f: { id?: string; name: string; kcal: number; p: number; f: number; c: number; defaultG: number; unitG: number | null }) => void; onCancel: () => void; onDelete?: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kcal, setKcal] = useState(initial ? String(initial.kcal) : '');
  const [p, setP] = useState(initial ? String(initial.p) : '');
  const [f, setF] = useState(initial ? String(initial.f) : '');
  const [c, setC] = useState(initial ? String(initial.c) : '');
  const [g, setG] = useState(String(initial?.defaultG ?? 100));
  const [confirm, setConfirm] = useState(false);
  const valid = name.trim().length > 0 && num(kcal) > 0;
  return (
    <View style={{ marginTop: 14, gap: 10 }}>
      <Field label="名前" value={name} onChangeText={setName} placeholder="例：プロテイン（ホエイ）" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="kcal" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="P g" value={p} onChangeText={setP} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="F g" value={f} onChangeText={setF} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="C g" value={c} onChangeText={setC} keyboardType="decimal-pad" /></View>
      </View>
      <Field label="いつもの量（g）" value={g} onChangeText={setG} keyboardType="decimal-pad" />
      <N size={12} w={500} c={color.sub}>{Math.round((num(kcal) * num(g)) / 100)}kcal（いつもの量のとき）</N>
      <PrimaryButton label="保存" disabled={!valid} onPress={() => onSave({ id: initial?.id, name: name.trim(), kcal: num(kcal), p: num(p), f: num(f), c: num(c), defaultG: Math.max(1, num(g)), unitG: initial?.unitG ?? null })} />
      <Pressable accessibilityRole="button" onPress={onCancel} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
        <T size={13} c={color.sub}>キャンセル</T>
      </Pressable>
      {onDelete && (
        <Pressable accessibilityRole="button" onPress={() => (confirm ? onDelete() : setConfirm(true))} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} w={700} c={color.brandText}>{confirm ? 'もう一度押すと削除（過去の記録は変わりません）' : '削除'}</T>
        </Pressable>
      )}
    </View>
  );
}
