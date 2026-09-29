import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { N, T, color, lightPalette } from '@/design-system';
import type { MealBar } from '../../features/coach/aggregate';

const WD = ['月', '火', '水', '木', '金', '土', '日'];
const typeBg = (t: MealBar['dayType']) => (t === 'high' ? lightPalette.brandPale2 : t === 'normal' ? lightPalette.badgeBg : lightPalette.off);
const typeJp = (t: MealBar['dayType']) => (t === 'high' ? '高' : t === 'off' ? 'オフ' : t === 'normal' ? '通' : '');

/** 7日の食事：棒の高さ = 摂取kcal ÷ (目標×1.25)。目標の位置に点線。棒の上にkcal、下に曜日・日タイプ・P */
export function MealBars({ bars, proteinG, selected, onSelect }: { bars: MealBar[]; proteinG: number; selected: string | null; onSelect: (d: string) => void }) {
  const H = 110;
  const target = bars.find((b) => b.targetKcal)?.targetKcal ?? null;
  const max = (target ?? Math.max(1500, ...bars.map((b) => b.kcal ?? 0))) * 1.25;
  return (
    <View>
      <View style={{ height: H + 18, flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
        {target ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 18 + (H * target) / max, borderTopWidth: 1, borderColor: color.sub, borderStyle: 'dashed' }} /> : null}
        {bars.map((b, i) => {
          const h = b.kcal ? Math.max(4, Math.round((H * b.kcal) / max)) : 0;
          const on = selected === b.date;
          return (
            <View key={b.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: H + 18 }} onTouchEnd={() => b.logged && onSelect(b.date)}>
              {b.kcal ? <N size={10.5} w={500} c={color.sub} style={{ marginBottom: 2 }}>{b.kcal.toLocaleString()}</N> : <View style={{ height: 14 }} />}
              <View style={{ width: '100%', height: h, backgroundColor: on ? lightPalette.text : '#D3C4B8', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6, paddingTop: 6 }}>
        {bars.map((b, i) => {
          const short = b.P !== null && proteinG > 0 && b.P < proteinG * 0.85;
          return (
            <View key={b.date} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <T size={11} c={color.sub}>{WD[i]}</T>
              <View style={{ height: 16, minWidth: 22, borderRadius: 4, backgroundColor: typeBg(b.dayType), alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}>
                <T size={9.5} w={700} c={lightPalette.badgeFg}>{typeJp(b.dayType)}</T>
              </View>
              {/* 記録なしの日も高さだけ確保して、行の高さを揃える */}
              <N size={11} w={500} c={short ? color.brandText : color.sub} style={{ minHeight: 14 }}>{b.P !== null ? `P${b.P}` : ''}</N>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 体重：7日平均の折れ線（2px）、目標の点線、最新の点は brand */
export function WeightLine({ points, target, width = 320, height = 150 }: { points: (number | null)[]; target: number | null; width?: number; height?: number }) {
  const vals = points.filter((v): v is number => v !== null);
  if (vals.length < 2) return <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}><T size={12} c={color.sub}>推移を出すには、体重の記録が2週分ほど必要です</T></View>;
  const all = target !== null ? [...vals, target] : vals;
  const lo = Math.min(...all) - 0.5;
  const hi = Math.max(...all) + 0.5;
  const pad = 10;
  const x = (i: number) => pad + ((width - pad * 2) * i) / (points.length - 1);
  const y = (v: number) => pad + (height - pad * 2) * (1 - (v - lo) / (hi - lo));
  const pts = points.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
  const lastIdx = points.map((v) => v !== null).lastIndexOf(true);
  return (
    <Svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', aspectRatio: width / height }}>
      {target !== null ? <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={lightPalette.sub} strokeDasharray="4 4" /> : null}
      <Polyline points={pts} fill="none" stroke={lightPalette.text} strokeWidth={2} />
      <Circle cx={x(lastIdx)} cy={y(points[lastIdx] as number)} r={5} fill={lightPalette.brand} />
    </Svg>
  );
}
