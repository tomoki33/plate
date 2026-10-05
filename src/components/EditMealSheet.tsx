import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, N, NumberStepper, OutlineButton, PrimaryButton, Sheet, T, color, hairline } from '@/design-system';
import { shortName } from '../domain/foodSearch';
import { scaleMealEntry } from '../domain/meals';
import type { MealEntry, Slot } from '../domain/models';
import type { MealGroup } from '../store/selectors';
import { useStore } from '../store/store';

const SLOTS: Slot[] = ['朝', '昼', '間食', '夜'];

/** 食事の編集：時間帯と量（g）を直す、または削除する。日付は変えない（別の日に入れ直すときは、削除して追加する） */
export function EditMealSheet({ group, onClose }: { group: MealGroup | null; onClose: () => void }) {
  const update = useStore((s) => s.updateMealGroup);
  const remove = useStore((s) => s.removeMealGroup);
  const [slot, setSlot] = useState<Slot>('昼');
  const [grams, setGrams] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!group) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたとき・props が変わったときに、state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
    setSlot(group.slot);
    setGrams(Object.fromEntries(group.items.filter((i) => i.grams !== null).map((i) => [i.id, i.grams as number])));
  }, [group]);

  if (!group) return <Sheet visible={false} onClose={onClose}><View /></Sheet>;

  const preview = (m: MealEntry): MealEntry => (grams[m.id] !== undefined ? scaleMealEntry(m, grams[m.id]) : m);
  const items = group.items.map(preview);
  const total = items.reduce((a, m) => ({ kcal: a.kcal + m.kcal, P: a.P + m.P, F: a.F + m.F, C: a.C + m.C }), { kcal: 0, P: 0, F: 0, C: 0 });
  const changed = slot !== group.slot || group.items.some((m) => grams[m.id] !== undefined && grams[m.id] !== m.grams);

  return (
    <Sheet visible onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <T size={17} w={900} numberOfLines={1}>{group.name}</T>
        <T size={12} c={color.sub} style={{ marginTop: 2 }}>時間帯と量を直せます。</T>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          {SLOTS.map((s) => (
            <Chip key={s} label={s} selected={slot === s} onPress={() => setSlot(s)} />
          ))}
        </View>
      </View>
      <ScrollView style={{ maxHeight: 320, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        {group.items.map((m, i) => (
          <View key={m.id} style={{ paddingVertical: 10, borderTopWidth: hairline, borderTopColor: color.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <T size={14} w={500}>{shortName(m.name)}</T>
              <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>P{Math.round(items[i].P)} F{Math.round(items[i].F)} C{Math.round(items[i].C)}・{items[i].kcal}kcal</N>
            </View>
            {m.grams !== null ? (
              <NumberStepper value={grams[m.id] ?? m.grams} onChange={(g) => setGrams((x) => ({ ...x, [m.id]: g }))} step={10} min={1} max={5000} unit="g" size={16} width={52} accessibilityLabel={`${m.name}のグラム`} />
            ) : (
              <T size={12} c={color.sub}>量なし</T>
            )}
          </View>
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
        <N size={13} w={500} c={color.sub}>合計 {total.kcal}kcal・P{Math.round(total.P)} F{Math.round(total.F)} C{Math.round(total.C)}（目安）</N>
        <PrimaryButton
          label="保存"
          disabled={!changed}
          onPress={() => {
            update(group.groupId, { slot, grams });
            onClose();
          }}
        />
        <OutlineButton
          label="この食事を削除"
          onPress={() => {
            remove(group.groupId);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
