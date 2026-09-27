import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, CardRow, InlineStepper, N, Segmented, T, color, hairline } from '@/design-system';
import { SPREAD_LIMITS, SPREAD_PRESETS, coefFromPercents, dailyProtein, matchSpreadPreset, spreadPercents, type SpreadPreset } from '../domain/nutrition';
import type { Coef, DayType } from '../domain/types';

const fmt = (n: number) => Math.round(n).toLocaleString();
const barColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const LABELS: Record<DayType, string> = { high: '高い日', normal: '通常の日', off: 'オフの日' };
const BAR_MAX = 64;
const pctText = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : '±'}${Math.abs(p)}%`;

/**
 * 日ごとの食べる量（画面に「係数」という言葉は出さない）。
 * 「差を小さく／標準／差を大きく」から選ぶ。その下に、高い日・通常の日・オフの日のkcalを棒の高さと数字で出し、
 * 「通常より +15%」と添える。「細かく調整」を開くと、高い日とオフの日を1%ずつ動かせる（内部の値は係数）。
 */
export function DaySpreadSection({ coef, kcal, linked, onCoef }: { coef: Coef; kcal: Record<DayType, number>; linked: boolean; onCoef: (c: Coef) => void }) {
  const [open, setOpen] = useState(false);
  const preset = matchSpreadPreset(coef);
  const pct = spreadPercents(coef);
  const maxKcal = Math.max(kcal.high, kcal.normal, kcal.off, 1);
  const diff = (t: DayType) => (t === 'normal' ? '基準' : `通常より ${pctText(t === 'high' ? pct.high : -pct.off)}`);

  return (
    <View>
      <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 }}>日ごとの食べる量</T>
      <T size={12} c={color.badgeFg} style={{ paddingHorizontal: 20, paddingBottom: 8, lineHeight: 19 }}>週の合計はそのままで、トレーニングの日に多く、休みの日に少なく配ります。</T>
      <Card style={{ paddingTop: 12, paddingHorizontal: 12, paddingBottom: 4 }}>
        <Segmented
          value={(preset ?? '') as SpreadPreset}
          onChange={(p: SpreadPreset) => onCoef({ high: SPREAD_PRESETS[p].high, normal: 1, off: SPREAD_PRESETS[p].off })}
          options={(Object.keys(SPREAD_PRESETS) as SpreadPreset[]).map((p) => ({ value: p, label: SPREAD_PRESETS[p].label }))}
        />
        {!preset && <T size={11} c={color.sub} style={{ marginTop: 6 }}>細かく調整した値を使っています。</T>}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, alignItems: 'flex-end' }}>
          {(['high', 'normal', 'off'] as const).map((t) => (
            <View key={t} style={{ flex: 1, gap: 5 }}>
              <View style={{ height: Math.max(8, Math.round((kcal[t] / maxKcal) * BAR_MAX)), backgroundColor: barColor(t), borderRadius: 3 }} />
              <T size={11} c={color.sub} style={{ marginTop: 3 }}>{LABELS[t]}</T>
              <N size={20} w={600} style={{ lineHeight: 21 }}>{fmt(kcal[t])}<T size={11} c={color.sub}> kcal</T></N>
              <T size={11} c={color.badgeFg}>{diff(t)}</T>
            </View>
          ))}
        </View>
        {!linked && <T size={11} c={color.sub} style={{ marginTop: 8 }}>日ごとの差は、有料プラン（体験中を含む）で目標に反映されます。</T>}

        <Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={{ height: 44, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: hairline, borderTopColor: color.line }}>
          <T size={13}>細かく調整</T>
          <T size={13} c={color.sub}>{open ? '閉じる' : '開く'}</T>
        </Pressable>
        {open && (
          <View style={{ marginHorizontal: -12 }}>
            <PercentRow t="high" value={pct.high} kcal={kcal.high} max={SPREAD_LIMITS.highMax} onChange={(v) => onCoef(coefFromPercents(v, pct.off))} sign={1} />
            <PercentRow t="off" value={pct.off} kcal={kcal.off} max={SPREAD_LIMITS.offMax} onChange={(v) => onCoef(coefFromPercents(pct.high, v))} sign={-1} />
          </View>
        )}
      </Card>
    </View>
  );
}

function PercentRow({ t, value, kcal, max, onChange, sign }: { t: DayType; value: number; kcal: number; max: number; onChange: (v: number) => void; sign: 1 | -1 }) {
  return (
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, borderTopWidth: hairline, borderTopColor: color.line }}>
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: barColor(t) }} />
          <T size={14}>{LABELS[t]}</T>
        </View>
        <T size={11} c={color.sub}>{fmt(kcal)} kcal/日</T>
      </View>
      <InlineStepper value={pctText(sign * value)} width={60} size={18} onDown={() => onChange(Math.max(0, value - 1))} onUp={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

/** たんぱく質（毎日同じ量）：「体重1kgあたり 2.2 g」「1日 158 g（7日平均の体重から計算）」 */
export function ProteinSection({ pk, weight, onPk }: { pk: number; weight: number; onPk: (pk: number) => void }) {
  return (
    <View>
      <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>たんぱく質（毎日同じ量）</T>
      <Card>
        <CardRow
          title={`体重1kgあたり ${pk.toFixed(1)} g`}
          meta={`1日 ${dailyProtein(weight, pk)} g（7日平均の体重から計算）`}
          minHeight={60}
          last
          right={<InlineStepper value="" width={0} onDown={() => onPk(Math.max(1.6, Math.round((pk - 0.1) * 10) / 10))} onUp={() => onPk(Math.min(3, Math.round((pk + 0.1) * 10) / 10))} />}
        />
      </Card>
    </View>
  );
}
