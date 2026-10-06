import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PrimaryButton, Sheet, StepBox, T, color } from '@/design-system';
import { addDays, dateKey } from '../domain/dates';
import { useStore } from '../store/store';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const HISTORY_DAYS = 119;

const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const label = (key: string, todayKey: string) => {
  const d = parse(key);
  return `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）${key === todayKey ? ' 今日' : ''}`;
};

/**
 * 体重入力シート。日付を「‹ 9/25（金） 今日 ›」で切り替えられる（未来には進めない）。
 * 入れ忘れた日も後から追加・修正できる。初期値はその日の記録、なければ直近の記録。
 * 記録済みの日には「この日の記録を削除」。記録も削除も、トーストで取消できる。
 */
export function WeightSheet({ open, onClose, initialDate, now }: { open: boolean; onClose: () => void; initialDate: string; now: Date }) {
  const weights = useStore((s) => s.weights);
  const setWeight = useStore((s) => s.setWeight);
  const deleteWeight = useStore((s) => s.deleteWeight);
  const todayKey = dateKey(now);

  const [date, setDate] = useState(initialDate);
  const [kg, setKg] = useState(70);

  const latestBefore = (key: string) => {
    const ks = Object.keys(weights).filter((k) => k <= key).sort();
    return ks.length ? weights[ks[ks.length - 1]] : Object.values(weights).slice(-1)[0] ?? 70;
  };

  // 開いたとき・日付を変えたときに、その日の値（なければ直近）にそろえる
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたとき・props が変わったときに、state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
    if (open) setDate(initialDate);
  }, [open, initialDate]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたとき・props が変わったときに、state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
    if (open) setKg(weights[date] ?? latestBefore(date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const has = weights[date] !== undefined;
  const isToday = date === todayKey;
  const step = (d: number) => setKg((x) => Math.round(Math.min(200, Math.max(30, x + d)) * 10) / 10);
  const move = (d: number) => {
    const next = dateKey(addDays(parse(date), d));
    if (next > todayKey) return;
    if (next < dateKey(addDays(now, -HISTORY_DAYS))) return;
    setDate(next);
  };

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingLeft: 18, paddingRight: 12, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={17} w={900}>体重</T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="前の日" onPress={() => move(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={20}>‹</T>
          </Pressable>
          <T size={14} w={700} style={{ minWidth: 110, textAlign: 'center' }}>{label(date, todayKey)}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="次の日" disabled={isToday} onPress={() => move(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={20} c={isToday ? color.off : color.text}>›</T>
          </Pressable>
        </View>
      </View>
      <View style={{ marginHorizontal: 18, marginTop: 12 }}>
        <StepBox value={kg.toFixed(1)} unit="kg" onDown={() => step(-0.1)} onUp={() => step(0.1)} height={80} buttonWidth={64} size={44} label="体重" />
      </View>
      <T size={12} c={color.sub} style={{ paddingHorizontal: 18, paddingTop: 10, lineHeight: 19 }}>
        {isToday ? '朝、トイレのあとに測るのがおすすめ。毎日の上下は気にせず、7日平均の傾きで判断します。' : `${label(date, todayKey)}の記録を${has ? '修正' : '追加'}します。入れ忘れた日も後から入れられます。`}
      </T>
      <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
        <PrimaryButton
          label="記録する"
          onPress={() => {
            setWeight(date, kg);
            onClose();
          }}
        />
      </View>
      {has && (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            deleteWeight(date);
            onClose();
          }}
          style={{ height: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center' }}
        >
          <T size={13} c={color.brandText}>この日の記録を削除</T>
        </Pressable>
      )}
    </Sheet>
  );
}
