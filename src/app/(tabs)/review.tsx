import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, N, Notice, SectionLabel, T, color, hairline, radius } from '@/design-system';
import { WeightChartView } from '../../components/WeightChart';
import { useNow } from '../../components/useNow';
import { addDays, dateKey } from '../../domain/dates';
import { e1rmSeries, summarizeWeek, weekBestE1rm } from '../../domain/review';
import type { Macro } from '../../domain/types';
import { buildWeightChart, signed1 } from '../../domain/weight';
import { useWeek, useWeightStats } from '../../store/selectors';
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
  const stats = useWeightStats(now);
  const sessions = useStore((s) => s.sessions);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);
  const exercises = useStore((s) => s.exercises);
  const answerPaceSuggestion = useStore((s) => s.answerPaceSuggestion);

  const limitWeeks = w.features.reviewWeeks; // null は全期間
  const [weekBack, setWeekBack] = useState(1); // 1=先週
  const chartW = Math.min(width - 44 - 40, 520);

  const monday = addDays(w.dates[0], -7 * weekBack);
  const locked = limitWeeks !== null && weekBack > limitWeeks;
  const canOlder = limitWeeks === null ? weekBack < 52 : weekBack < limitWeeks;
  const weekLabel = weekBack === 1 ? '先週' : weekBack === 2 ? '2週前' : `${weekBack}週前`;

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

  // 体重カードの小さなグラフ（直近28日）
  const cardW = Math.min(width - 32, 560) - 28;
  const mini = useMemo(() => buildWeightChart({ weights, today: now, days: 28, fut: 0, goal: null, pace: 0, W: cardW, H: 88, padL: 0 }), [weights, now, cardW]);

  const e1Vals = series.map((p) => p.e1rm);
  const e1Lo = e1Vals.length ? Math.floor(Math.min(...e1Vals) - 5) : 0;
  const e1Hi = e1Vals.length ? e1Lo + Math.ceil((Math.max(...e1Vals) + 5 - e1Lo) / 4) * 4 : 1;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}>
      {/* 見出し：先週と、その期間 */}
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={22} w={900}>{weekLabel}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="さらに前の週" disabled={!canOlder && !(limitWeeks !== null && weekBack === limitWeeks)} onPress={() => setWeekBack((n) => n + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canOlder || (limitWeeks !== null && weekBack === limitWeeks) ? 1 : 0.3 }}>
            <T size={18} c={color.sub}>‹</T>
          </Pressable>
          <T size={12} c={color.sub}>{md(dateKey(monday))}〜{md(dateKey(addDays(monday, 6)))}</T>
          <Pressable accessibilityRole="button" accessibilityLabel="新しい週" disabled={weekBack <= 1} onPress={() => setWeekBack((n) => Math.max(1, n - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: weekBack <= 1 ? 0.3 : 1 }}>
            <T size={18} c={color.sub}>›</T>
          </Pressable>
        </View>
      </View>

      {locked ? (
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Notice>無料プランでは、直近{limitWeeks}週までふりかえれます。これより前は有料プランで見られます。</Notice>
          <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={700}>プランを見る ›</T>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <T size={11} c={color.sub} style={{ marginBottom: 2 }}>推定1RM</T>
          {data.rm.map((r) => (
            <View key={r.name} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 9, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={14}>{r.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <N size={22} w={600}>{r.cur === null ? '—' : r.cur.toFixed(1)}</N>
                <T size={11} c={color.sub}> kg</T>
                <N size={14} w={600} c={r.diff !== null && r.diff > 0.04 ? color.text : color.sub} style={{ width: 56, textAlign: 'right' }}>
                  {r.diff === null ? '' : Math.abs(r.diff) < 0.05 ? '±0' : signed1(r.diff)}
                </N>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 体重カード：押すと体重の詳細へ */}
      <Pressable accessibilityRole="button" onPress={() => router.push('/weight')} style={{ marginHorizontal: 16, marginTop: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, paddingVertical: 12, paddingHorizontal: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={11} c={color.sub}>体重　7日平均</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <N size={24} w={600}>{stats.avg !== null ? stats.avg.toFixed(1) : '—'}</N>
            <T size={11} c={color.sub}> kg</T>
            {stats.weekDiff !== null && <N size={14} w={600} style={{ marginLeft: 8 }}>{signed1(stats.weekDiff)}</N>}
          </View>
        </View>
        <View style={{ marginTop: 6 }}>
          {mini.empty ? <T size={12} c={color.sub} style={{ paddingVertical: 24 }}>体重を記録すると、ここに出ます。</T> : <WeightChartView chart={mini} width={cardW} height={80} padL={0} />}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
          <T size={11} c={color.sub}>{stats.paceLine ?? ''}</T>
          <T size={11} w={700}>推移と目標 ›</T>
        </View>
      </Pressable>

      {/* ペースの見直し：勝手には変えない。答えは週ごとに1回 */}
      {stats.suggestion && (
        <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: radius.card, backgroundColor: color.brandPale, gap: 10 }}>
          <T size={12.5} style={{ lineHeight: 20 }}>
            <T size={12.5} w={700} c={color.brandText}>ペースの見直し</T>　{stats.suggestion.message}
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => answerPaceSuggestion(stats.weekKey, stats.suggestion!.deltaKcal, 'dismissed')} style={{ flex: 1, height: 44, borderRadius: radius.button, borderWidth: 1, borderColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
              <T size={13} w={700}>そのまま</T>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const d = stats.suggestion!.deltaKcal;
                answerPaceSuggestion(stats.weekKey, d, 'accepted', `週の合計を ${fmt(w.weekKcal + d)}kcal に変更`);
              }}
              style={{ flex: 1.4, height: 44, borderRadius: radius.button, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}
            >
              <T size={13} w={700} c={color.onText}>週 {stats.suggestion.deltaKcal > 0 ? '+' : '−'}{Math.abs(stats.suggestion.deltaKcal)}kcal にする</T>
            </Pressable>
          </View>
        </View>
      )}

      {!locked && (
        <>
          {/* 平均PFC（縦線が目標） */}
          <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 10 }}>
            <T size={11} c={color.sub}>平均PFC（縦線が目標）</T>
            {data.sum.loggedDays === 0 ? (
              <T size={13} c={color.sub} style={{ paddingVertical: 8 }}>{weekLabel}の食事の記録がありません。</T>
            ) : (
              MACROS.map(([k, c]) => {
                const a = data.sum.avg[k];
                const t = data.tgt(k);
                return (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T size={12} w={700} c={c} style={{ width: 22 }}>{k}</T>
                    <View style={{ flex: 1, height: 6, backgroundColor: color.track, borderRadius: radius.bar }}>
                      <View style={{ width: `${Math.max(0, Math.min(100, (a / (t * 1.2)) * 100))}%`, height: 6, backgroundColor: c, borderRadius: radius.bar }} />
                      <View style={{ position: 'absolute', left: '83.3%', top: -3, bottom: -3, width: 1, backgroundColor: color.text }} />
                    </View>
                    <N size={15} w={600} style={{ width: 64, textAlign: 'right' }}>{fmt(a)}/{fmt(t)}</N>
                  </View>
                );
              })
            )}
          </View>

          <View style={{ marginHorizontal: 20, marginTop: 14, paddingVertical: 10, borderTopWidth: hairline, borderTopColor: color.line }}>
            {data.sum.loggedDays > 0 ? (
              <T size={12} c={color.badgeFg} style={{ lineHeight: 19 }}>
                {weekLabel}は目標より <T size={12} w={700} c={color.badgeFg}>{data.sum.kcalDiff >= 0 ? '+' : '−'}{fmt(Math.abs(data.sum.kcalDiff))}kcal</T>
                。{data.sum.kcalDiff > 0 ? '取り返そうとせず、今週はそのまま進めます。' : '今週もこのペースで進めます。'}
              </T>
            ) : (
              <T size={12} c={color.badgeFg}>記録がたまると、目標との差をここに出します。</T>
            )}
          </View>
        </>
      )}

      {/* 種目別の推定1RMの推移 */}
      <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
        <SectionLabel>推定1RMの推移{limitWeeks !== null ? `（直近${limitWeeks}週）` : ''}</SectionLabel>
        {performed.length === 0 ? (
          <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>トレーニングを記録すると、種目ごとの推移が出ます。</T>
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
                  yAxisLabelTexts={Array.from({ length: 5 }, (_, i) => String(Math.round(e1Lo + (i * (e1Hi - e1Lo)) / 4)))}
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
      </View>
    </ScrollView>
  );
}
