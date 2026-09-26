import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { color, hairline, N, radius, SectionLabel, T } from '@/design-system';
import { useNow } from '../../components/useNow';
import { addDays, dateKey } from '../../domain/dates';
import type { Macro } from '../../domain/types';
import { sumMeals, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const BIG3 = ['スクワット', 'ベンチプレス', 'デッドリフト'];
const fmt = (n: number) => Math.round(n).toLocaleString();
const MACROS: [Macro, string][] = [['P', color.P], ['F', color.F], ['C', color.C]];

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const w = useWeek(now);
  const workouts = useStore((s) => s.workouts);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);

  const data = useMemo(() => {
    const thisMon = w.dates[0];
    const lastMon = addDays(thisMon, -7);
    const prevMon = addDays(thisMon, -14);
    const inRange = (d: string, a: Date, b: Date) => d >= dateKey(a) && d < dateKey(b);

    const rm = BIG3.map((name) => {
      const best = (a: Date, b: Date) => {
        const all: number[] = [];
        workouts.filter((x) => inRange(x.date, a, b)).forEach((x) => x.exercises.filter((e) => e.name === name).forEach((e) => e.sets.filter((s) => s.done).forEach((s) => all.push(s.kg * (1 + s.reps / 30)))));
        return all.length ? Math.max(...all) : null;
      };
      const cur = best(lastMon, thisMon);
      const prev = best(prevMon, lastMon);
      return { name, cur, diff: cur !== null && prev !== null ? cur - prev : null };
    });

    // 先週の平均PFCと目標
    const lastDays = Array.from({ length: 7 }, (_, i) => dateKey(addDays(lastMon, i)));
    const logged = lastDays.filter((d) => meals.some((m) => m.date === d));
    const perDay = logged.map((d) => sumMeals(meals.filter((m) => m.date === d)));
    const avg = (k: keyof ReturnType<typeof sumMeals>) => (perDay.length ? perDay.reduce((a, x) => a + x[k], 0) / perDay.length : 0);
    const tgt = (k: 'P' | 'F' | 'C' | 'kcal') => w.plan.days.reduce((a, d) => a + d[k], 0) / 7;
    const kcalDiff = perDay.reduce((a, x) => a + x.kcal, 0) - logged.reduce((a) => a + tgt('kcal'), 0);

    // 体重（14日）
    const days14 = Array.from({ length: 14 }, (_, i) => addDays(now, i - 13));
    const pts = days14.map((d) => weights[dateKey(d)] ?? null);
    const line = days14.map((_, i) => {
      const win = pts.slice(Math.max(0, i - 6), i + 1).filter((x): x is number => x !== null);
      return win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
    });
    return { rm, avg, tgt, hasPfc: perDay.length > 0, kcalDiff, pts, line };
  }, [w, workouts, meals, weights, now]);

  const vals = [...data.pts, ...data.line].filter((x): x is number => x !== null);
  const lo = vals.length ? Math.min(...vals) - 0.5 : 0;
  const hi = vals.length ? Math.max(...vals) + 0.5 : 1;
  const CW = 300, CH = 100;
  const X = (i: number) => 6 + (i / 13) * (CW - 12);
  const Y = (v: number) => CH - 6 - ((v - lo) / (hi - lo || 1)) * (CH - 12);
  const linePts = data.line.map((v, i) => (v === null ? null : `${X(i)},${Y(v)}`)).filter(Boolean).join(' ');

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
      <T size={22} w={900}>レビュー</T>
      <T size={12} c={color.sub} style={{ marginTop: 2 }}>先週のふりかえり（数字は目安）</T>

      <View style={{ marginTop: 20 }}><SectionLabel>推定1RM（先週）</SectionLabel></View>
      {data.rm.map((r) => (
        <View key={r.name} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
          <T size={14} style={{ flex: 1 }}>{r.name}</T>
          <N size={20} w={600}>{r.cur === null ? '—' : r.cur.toFixed(1)}</N>
          <N size={13} w={500} c={r.diff !== null && r.diff > 0 ? color.text : color.sub} style={{ width: 60, textAlign: 'right' }}>
            {r.diff === null ? '' : r.diff === 0 ? '±0' : `${r.diff > 0 ? '+' : '−'}${Math.abs(r.diff).toFixed(1)}`}
          </N>
        </View>
      ))}

      <View style={{ marginTop: 22 }}><SectionLabel>体重（点＝毎日、線＝7日平均）</SectionLabel></View>
      <View style={{ marginTop: 8, backgroundColor: '#fff', borderRadius: radius.card, borderWidth: hairline, borderColor: color.line, padding: 10 }}>
        {vals.length === 0 ? (
          <T size={13} c={color.sub} style={{ padding: 12 }}>体重を記録すると、ここに出ます。</T>
        ) : (
          <>
            <Svg width="100%" height={CH} viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none">
              <Line x1={0} x2={CW} y1={CH - 1} y2={CH - 1} stroke={color.line} strokeWidth={1} />
              {linePts && <Polyline points={linePts} fill="none" stroke={color.text} strokeWidth={1.6} />}
              {data.pts.map((v, i) => v !== null && <Circle key={i} cx={X(i)} cy={Y(v)} r={2.4} fill={color.brand} />)}
            </Svg>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <N size={11} w={500} c={color.sub}>{hi.toFixed(1)}</N>
              <N size={11} w={500} c={color.sub}>{lo.toFixed(1)} kg</N>
            </View>
          </>
        )}
      </View>

      <View style={{ marginTop: 22 }}><SectionLabel>平均PFC（黒い縦線が目標）</SectionLabel></View>
      {!data.hasPfc ? (
        <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>先週の食事の記録がありません。</T>
      ) : (
        MACROS.map(([k, c]) => {
          const a = data.avg(k);
          const t = data.tgt(k);
          const scale = t * 1.25;
          return (
            <View key={k} style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                <T size={12} w={700} c={c}>{k}</T>
                <N size={16} w={600}>{fmt(a)}<T size={12} c={color.sub}>/{fmt(t)} g</T></N>
              </View>
              <View style={{ height: 8, backgroundColor: color.track, borderRadius: radius.bar }}>
                <View style={{ width: `${Math.min(100, (a / scale) * 100)}%`, height: 8, backgroundColor: c, borderRadius: radius.bar }} />
                <View style={{ position: 'absolute', left: '80%', top: -3, width: 2, height: 14, backgroundColor: color.text }} />
              </View>
            </View>
          );
        })
      )}

      <View style={{ marginTop: 24, padding: 14, borderRadius: radius.card, backgroundColor: color.brandPale }}>
        <T size={13} style={{ lineHeight: 21 }}>
          {data.hasPfc
            ? `先週は目標より${data.kcalDiff >= 0 ? '+' : '−'}${fmt(Math.abs(data.kcalDiff))}kcal（目安）。${data.kcalDiff > 0 ? '取り返そうとせず、今週はそのまま進めます。' : '今週もこのペースで進めます。'}`
            : '記録がたまると、先週との差をここに出します。'}
        </T>
      </View>
    </ScrollView>
  );
}
