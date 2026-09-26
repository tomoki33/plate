import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ListRow, N, NumberStepper, SectionLabel, Segmented, StepButton, T, color, radius } from '@/design-system';
import { SPREAD_LIMITS, SPREAD_PRESETS, coefFromPercents, dailyProtein, matchSpreadPreset, spreadPercents, type SpreadPreset } from '../domain/nutrition';
import type { Coef, DayType } from '../domain/types';

const fmt = (n: number) => Math.round(n).toLocaleString();
const barColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const LABELS: Record<DayType, string> = { high: '高い日', normal: '通常の日', off: 'オフの日' };
const BAR_MAX = 64;

/**
 * 「日ごとの食べる量」。係数という言葉は使わず、3段階から選ぶだけにする。
 * 高い日・通常の日・オフの日の kcal を、棒の高さと数字で見せる。細かく変えたい人は「細かく調整」で % を動かす。
 * たんぱく質は「体重1kgあたり ◯g → 1日 ◯g」と見せる。
 */
export function DaySpread({
  coef,
  kcal,
  pk,
  weight,
  linked,
  onCoef,
  onPk,
}: {
  coef: Coef;
  /** 1日あたりの目安 kcal（日タイプごと） */
  kcal: Record<DayType, number>;
  pk: number;
  weight: number;
  linked: boolean;
  onCoef: (c: Coef) => void;
  onPk: (pk: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const preset = matchSpreadPreset(coef);
  const pct = spreadPercents(coef);
  const maxKcal = Math.max(kcal.high, kcal.normal, kcal.off, 1);

  return (
    <View>
      <View style={{ marginTop: 22 }}><SectionLabel>日ごとの食べる量</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented
          value={(preset ?? '') as SpreadPreset}
          onChange={(p: SpreadPreset) => onCoef({ high: SPREAD_PRESETS[p].high, normal: 1, off: SPREAD_PRESETS[p].off })}
          options={(Object.keys(SPREAD_PRESETS) as SpreadPreset[]).map((p) => ({ value: p, label: SPREAD_PRESETS[p].label }))}
        />
      </View>
      {!preset && <T size={11} c={color.sub} style={{ marginTop: 6 }}>細かく調整した値を使っています。</T>}

      {/* 高い日・通常の日・オフの日の kcal を、棒の高さと数字で */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', marginTop: 16, paddingHorizontal: 8 }}>
        {(['high', 'normal', 'off'] as const).map((t) => (
          <View key={t} style={{ alignItems: 'center', gap: 6 }}>
            <N size={18} w={600}>{fmt(kcal[t])}</N>
            <View style={{ width: 34, height: Math.max(8, Math.round((kcal[t] / maxKcal) * BAR_MAX)), borderRadius: radius.bar, backgroundColor: barColor(t) }} />
            <T size={12} c={color.sub}>{LABELS[t]}</T>
          </View>
        ))}
      </View>
      <T size={11} c={color.sub} style={{ marginTop: 8, textAlign: 'center' }}>1日あたり kcal（目安）。1週間の合計は変わりません。</T>
      {!linked && <T size={11} c={color.sub} style={{ marginTop: 4, textAlign: 'center' }}>日ごとの差は、有料プラン（体験中を含む）で目標に反映されます。</T>}

      <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ minHeight: 44, justifyContent: 'center', marginTop: 6 }}>
        <T size={13} w={700}>{open ? '細かく調整を閉じる ˄' : '細かく調整 ˅'}</T>
      </Pressable>
      {open && (
        <View>
          <PercentRow label="高い日" sign="+" value={pct.high} max={SPREAD_LIMITS.highMax} onChange={(v) => onCoef(coefFromPercents(v, pct.off))} />
          <PercentRow label="オフの日" sign="−" value={pct.off} max={SPREAD_LIMITS.offMax} onChange={(v) => onCoef(coefFromPercents(pct.high, v))} />
          <T size={11} c={color.sub} style={{ marginTop: 6 }}>通常の日を基準（±0%）にした増減です。</T>
        </View>
      )}

      <ListRow
        title="たんぱく質"
        dot={color.P}
        meta={`体重1kgあたり ${pk.toFixed(1)}g → 1日 ${dailyProtein(weight, pk)}g（毎日同じ）`}
        minHeight={64}
        style={{ marginTop: 10 }}
        right={<NumberStepper value={pk} onChange={onPk} step={0.1} min={1.6} max={3} decimals={1} width={44} accessibilityLabel="体重1kgあたりのたんぱく質" />}
      />
    </View>
  );
}

function PercentRow({ label, sign, value, max, onChange }: { label: string; sign: '+' | '−'; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <ListRow
      title={label}
      minHeight={56}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <StepButton label="−" onPress={() => onChange(Math.max(0, value - 1))} />
          <View style={{ minWidth: 64, alignItems: 'center' }}>
            <N size={20} w={600}>{value === 0 ? '±0%' : `${sign}${value}%`}</N>
          </View>
          <StepButton label="+" onPress={() => onChange(Math.min(max, value + 1))} />
        </View>
      }
    />
  );
}
