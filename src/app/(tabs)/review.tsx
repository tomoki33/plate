import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, N, Notice, SectionLabel, Segmented, T, color, hairline, radius } from '@/design-system';
import { useNow } from '../../components/useNow';
import { addDays, dateKey } from '../../domain/dates';
import { e1rmSeries, movingAverage, summarizeWeek, weekBestE1rm } from '../../domain/review';
import type { Macro } from '../../domain/types';
import { useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const BIG3 = ['スクワット', 'ベンチプレス', 'デッドリフト'];
const fmt = (n: number) => Math.round(n).toLocaleString();
const MACROS: [Macro, string][] = [['P', color.P], ['F', color.F], ['C', color.C]];
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const now = useNow();
  const w = useWeek(now);
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);
  const exercises = useStore((s) => s.exercises);

  const limitWeeks = w.features.reviewWeeks; // null は全期間
  const [weekBack, setWeekBack] = useState(1); // 1=先週
  const [range, setRange] = useState<14 | 56 | 365>(14);
  const chartW = Math.min(width - 44 - 40, 520);

  const monday = addDays(w.dates[0], -7 * weekBack);
  const locked = limitWeeks !== null && weekBack > limitWeeks;
  const canOlder = limitWeeks === null ? weekBack < 52 : weekBack < limitWeeks;
  const weekLabel = weekBack === 1 ? '先週' : weekBack === 2 ? '2週前' : `${weekBack}週前`;

  // 種目の選択：BIG3のうち記録のあるもの、なければ記録のある種目
  const performed = useMemo(() => {
    const ids = new Set<string>();
    sessions.forEach((s) => s.exercises.forEach((e) => ids.add(e.exerciseId)));
    return exercises.filter((e) => ids.has(e.id));
  }, [sessions, exercises]);
  const big3 = BIG3.map((n) => exercises.find((e) => e.name === n)).filter((e): e is NonNullable<typeof e> => !!e);
  const [exId, setExId] = useState<string | null>(null);
  const chartEx = performed.find((e) => e.id === exId) ?? performed.find((e) => BIG3.includes(e.name)) ?? performed[0] ?? null;

  const sinceE1rm = limitWeeks === null ? undefined : dateKey(addDays(now, -7 * limitWeeks));
  const series = chartEx ? e1rmSeries(sessions, chartEx.id, sinceE1rm) : [];

  const data = useMemo(() => {
    const prevMon = addDays(monday, -7);
    const targets = w.plan.days.map((d) => d.kcal);
    const sum = summarizeWeek(meals, monday, targets);
    const tgt = (k: 'P' | 'F' | 'C') => w.plan.days.reduce((a, d) => a + d[k], 0) / 7;
    const rm = big3.map((e) => {
      const cur = weekBestE1rm(sessions, e.id, monday);
      const prev = weekBestE1rm(sessions, e.id, prevMon);
      return { name: e.name, cur, diff: cur !== null && prev !== null ? cur - prev : null };
    });
    return { sum, tgt, rm };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.plan, meals, sessions, weekBack, exercises]);

  // 体重（点＝毎日、線＝7日平均）。最初の記録の日からを描く
  const days = useMemo(() => Array.from({ length: range }, (_, i) => addDays(now, i - range + 1)), [now, range]);
  const wc = useMemo(() => {
    const pts = days.map((d) => weights[dateKey(d)] ?? null);
    const first = pts.findIndex((v) => v !== null);
    if (first < 0) return { count: 0, line: [], dots: [], lo: 0, hi: 1, from: null as Date | null, to: null as Date | null };
    const ds = days.slice(first);
    const ps = pts.slice(first);
    const avg = movingAverage(weights, ds).map((v, i) => v ?? null);
    // 平均が出せない最初の数日は、その日までの記録の平均で埋める（線を途切れさせない）
    let prev = ps[0] as number;
    const line = ds.map((_, i) => {
      const seen = ps.slice(0, i + 1).filter((x): x is number => x !== null);
      const v = avg[i] ?? (seen.length ? seen.reduce((a, b) => a + b, 0) / seen.length : prev);
      prev = v;
      return v;
    });
    const dots = ds.map((_, i) => (ps[i] !== null ? { value: ps[i] as number } : { value: line[i], hideDataPoint: true }));
    const all = [...line, ...ps.filter((x): x is number => x !== null)];
    const lo = Math.floor((Math.min(...all) - 0.5) * 2) / 2;
    // 目盛りが 0.5 刻みのきれいな数字になるよう、幅を2kgの倍数にする（4分割）
    const hi = lo + Math.max(2, Math.ceil((Math.max(...all) + 0.5 - lo) / 2) * 2);
    return { count: ps.filter((x) => x !== null).length, line: line.map((v) => ({ value: v })), dots, lo, hi, from: ds[0], to: ds[ds.length - 1] };
  }, [days, weights]);
  const wSpacing = wc.line.length > 1 ? (chartW - 44) / (wc.line.length - 1) : 10;

  const e1Vals = series.map((p) => p.e1rm);
  const e1Lo = e1Vals.length ? Math.floor(Math.min(...e1Vals) - 5) : 0;
  // 目盛りが整数のきれいな刻みになるよう、幅を4の倍数にする（4分割）
  const e1Hi = e1Vals.length ? e1Lo + Math.ceil((Math.max(...e1Vals) + 5 - e1Lo) / 4) * 4 : 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
      <T size={22} w={900}>レビュー</T>

      {/* 週の切替 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="さらに前の週" disabled={!canOlder && !(limitWeeks !== null && weekBack === limitWeeks)} onPress={() => setWeekBack((n) => n + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canOlder || (limitWeeks !== null && weekBack === limitWeeks) ? 1 : 0.3 }}>
          <T size={18}>‹</T>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <T size={15} w={700}>{weekLabel}</T>
          <T size={11} c={color.sub}>{md(dateKey(monday))} 〜 {md(dateKey(addDays(monday, 6)))}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="新しい週" disabled={weekBack <= 1} onPress={() => setWeekBack((n) => Math.max(1, n - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: weekBack <= 1 ? 0.3 : 1 }}>
          <T size={18}>›</T>
        </Pressable>
      </View>

      {locked ? (
        <View style={{ marginTop: 12 }}>
          <Notice>無料プランでは、直近{limitWeeks}週までふりかえれます。これより前は有料プランで見られます。</Notice>
          <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={700}>プランを見る ›</T>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 14 }}><SectionLabel>推定1RM（週の最大）</SectionLabel></View>
          {data.rm.map((r) => (
            <View key={r.name} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={14} style={{ flex: 1 }}>{r.name}</T>
              <N size={20} w={600}>{r.cur === null ? '—' : r.cur.toFixed(1)}</N>
              <N size={13} w={500} c={r.diff !== null && r.diff > 0 ? color.text : color.sub} style={{ width: 60, textAlign: 'right' }}>
                {r.diff === null ? '' : Math.abs(r.diff) < 0.05 ? '±0' : `${r.diff > 0 ? '+' : '−'}${Math.abs(r.diff).toFixed(1)}`}
              </N>
            </View>
          ))}

          <View style={{ marginTop: 22 }}><SectionLabel>平均PFC（黒い縦線が目標）</SectionLabel></View>
          {data.sum.loggedDays === 0 ? (
            <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>{weekLabel}の食事の記録がありません。</T>
          ) : (
            MACROS.map(([k, c]) => {
              const a = data.sum.avg[k];
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

          <View style={{ marginTop: 22 }}>
            <Notice>
              {data.sum.loggedDays > 0
                ? `${weekLabel}は目標より${data.sum.kcalDiff >= 0 ? '+' : '−'}${fmt(Math.abs(data.sum.kcalDiff))}kcal（目安・記録した${data.sum.loggedDays}日分）。${data.sum.kcalDiff > 0 ? '取り返そうとせず、今週はそのまま進めます。' : '今週もこのペースで進めます。'}`
                : '記録がたまると、目標との差をここに出します。'}
            </Notice>
          </View>
        </>
      )}

      {/* 種目別の推定1RM推移 */}
      <View style={{ marginTop: 26 }}><SectionLabel>推定1RMの推移{limitWeeks !== null ? `（直近${limitWeeks}週）` : ''}</SectionLabel></View>
      {performed.length === 0 ? (
        <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>トレを記録すると、種目ごとの推移が出ます。</T>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
            {performed.map((e) => (
              <Chip key={e.id} label={e.name} selected={chartEx?.id === e.id} onPress={() => setExId(e.id)} />
            ))}
          </ScrollView>
          <View style={{ backgroundColor: color.surface, borderRadius: radius.card, borderWidth: hairline, borderColor: color.line, padding: 10, overflow: 'hidden' }}>
            {series.length < 2 ? (
              <T size={13} c={color.sub} style={{ padding: 12 }}>{series.length === 1 ? `いまは ${series[0].e1rm.toFixed(1)}kg。2回以上記録すると、線で見えます。` : 'この期間の記録がありません。'}</T>
            ) : (
              <LineChart
                data={series.map((p) => ({ value: p.e1rm, label: md(p.date) }))}
                width={chartW}
                height={140}
                color={color.text}
                thickness={2}
                dataPointsColor={color.brand}
                dataPointsRadius={3}
                yAxisOffset={e1Lo}
                maxValue={e1Hi - e1Lo}
                noOfSections={4}
                hideRules
                yAxisThickness={0}
                xAxisColor={color.line}
                yAxisTextStyle={{ color: color.sub, fontSize: 10 }}
                xAxisLabelTextStyle={{ color: color.sub, fontSize: 10 }}
                spacing={Math.max(28, Math.min(70, chartW / Math.max(series.length, 2)))}
                initialSpacing={12}
                endSpacing={12}
                adjustToWidth={series.length > 6}
                disableScroll
                isAnimated={false}
              />
            )}
          </View>
        </>
      )}

      {/* 体重 */}
      <View style={{ marginTop: 26 }}><SectionLabel>体重（点＝毎日、線＝7日平均）</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented value={range} onChange={setRange} options={[{ value: 14 as const, label: '2週' }, { value: 56 as const, label: '8週' }, { value: 365 as const, label: '1年' }]} />
      </View>
      <View style={{ marginTop: 8, backgroundColor: color.surface, borderRadius: radius.card, borderWidth: hairline, borderColor: color.line, padding: 10, overflow: 'hidden' }}>
        {wc.count < 2 ? (
          <T size={13} c={color.sub} style={{ padding: 12 }}>{wc.count === 1 ? '体重を2日以上記録すると、推移が線で出ます。' : '体重を記録すると、ここに出ます。'}</T>
        ) : (
          <>
            <LineChart
              data={wc.line}
              data2={wc.dots}
              width={chartW - 30}
              height={140}
              color1={color.text}
              color2="transparent"
              thickness1={2}
              thickness2={0}
              hideDataPoints1
              dataPointsColor2={color.brand}
              dataPointsRadius2={3}
              yAxisOffset={wc.lo}
              maxValue={wc.hi - wc.lo}
              noOfSections={4}
              hideRules
              yAxisThickness={0}
              xAxisColor={color.line}
              yAxisTextStyle={{ color: color.sub, fontSize: 10 }}
              yAxisLabelWidth={34}
              spacing={wSpacing}
              initialSpacing={6}
              endSpacing={6}
              disableScroll
              isAnimated={false}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 40, paddingTop: 4 }}>
              <N size={11} w={500} c={color.sub}>{md(dateKey(wc.from!))}</N>
              <N size={11} w={500} c={color.sub}>{md(dateKey(wc.to!))}</N>
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
