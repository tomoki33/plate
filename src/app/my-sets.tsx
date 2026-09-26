import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { N, T, color, hairline } from '@/design-system';
import { getFoodsByIds } from '../db/repo';
import { shortName } from '../domain/foodSearch';
import type { FoodItem } from '../domain/models';
import { useStore } from '../store/store';

/** マイセット（よく食べる組み合わせ）。食事の記録では、時間帯に合うものが上に、最近使った順に並ぶ */
export default function MySets() {
  const router = useRouter();
  const sets = useStore((s) => s.mealSets);
  const del = useStore((s) => s.deleteMealSet);
  const [foods, setFoods] = useState<Record<string, FoodItem>>({});
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    const ids = [...new Set(sets.flatMap((m) => m.items.map((i) => i.foodId)))];
    void getFoodsByIds(ids).then((fs) => setFoods(Object.fromEntries(fs.map((f) => [f.id, f]))));
  }, [sets]);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>マイセット</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>
        <T size={12} c={color.sub} style={{ marginTop: 2 }}>新しいセットは、文章入力の確認画面から登録できます。</T>
        {sets.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>まだありません。</T>}
        {sets.map((m) => (
          <View key={m.id} style={{ paddingVertical: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T size={14} w={700} style={{ flex: 1 }}>{m.name}</T>
              {m.slotHint ? <T size={11} c={color.sub}>{m.slotHint}</T> : null}
            </View>
            {m.items.map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                <T size={12} c={color.sub} style={{ flex: 1 }}>{foods[it.foodId] ? shortName(foods[it.foodId].name) : '（食品が見つかりません）'}</T>
                <N size={12} w={500} c={color.sub}>{it.g}g</N>
              </View>
            ))}
            <Pressable accessibilityRole="button" onPress={() => (confirm === m.id ? (del(m.id), setConfirm(null)) : setConfirm(m.id))} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={12} w={700} c={color.brandText}>{confirm === m.id ? 'もう一度押すと削除' : '削除'}</T>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
