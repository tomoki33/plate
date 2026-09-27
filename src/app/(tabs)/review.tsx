import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, N, Notice, T, color, hairline, radius } from '@/design-system';
import { WeightChartView } from '../../components/WeightChart';
import { useNow } from '../../components/useNow';
import { addDays, dateKey } from '../../domain/dates';
import { summarizeWeek } from '../../domain/review';
import type { DayType, Macro } from '../../domain/types';
import { buildWeightChart, signed1 } from '../../domain/weight';
import { templateName, useWeek, useWeightStats } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const MACROS: [Macro, string][] = [['P', color.P], ['F', color.F], ['C', color.C]];
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const DOW = ['月', '火', '水', '木', '金', '土', '日'];
const kgTimes = (kg: number) => (kg > 0 ? `${kg}kg × ` : '× ');

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
  const deleteSession = useStore((s) => s.deleteSession);
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  const limitWeeks = w.features.reviewWeeks; // null は全期間
  const [weekBack, setWeekBack] = useState(1); // 1=先週
  const [sel, setSel] = useState<string>(dateParam ?? w.todayKey);
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (dateParam) setSel(dateParam);
  }, [dateParam]);

  const monday = addDays(w.dates[0], -7 * weekBack);
  const locked = limitWeeks !== null && weekBack > limitWeeks;
  const canOlder = limitWeeks === null ? weekBack < 52 : weekBack < limitWeeks;
  const weekLabel = weekBack === 1 ? '先週' : weekBack === 2 ? '2週前' : `${weekBack}週前`;

  // 直近4週のカレンダー（7列×4週。今週の月曜から3週前まで）
  const calStart = addDays(w.dates[0], -21);
  const cells = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const d = addDays(calStart, i);
        const key = dateKey(d);
        const day = sessions.filter((x) => x.date === key);
        const type: DayType | null = day.length ? (day.some((x) => x.dayType === 'high') ? 'high' : 'normal') : null;
        return { key, d, day, type, future: key > w.todayKey, today: key === w.todayKey };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, w.todayKey],
  );
  const count = cells.filter((c) => !c.future).reduce((a, c) => a + c.day.length, 0);
  const selCell = cells.find((c) => c.key === sel);
  // カレンダーの外の日（履歴から開いた古い日）も出せる
  const selDay = selCell?.day ?? sessions.filter((x) => x.date === sel);
  const selDate = new Date(sel.replace(/-/g, '/'));
  const selFuture = sel > w.todayKey;
  const selLabel = `${selDate.getMonth() + 1}/${selDate.getDate()}（${WD[selDate.getDay()]}）${sel === w.todayKey ? ' 今日' : ''}`;
  const selPlanIdx = (selDate.getDay() + 6) % 7;

  const data = useMemo(() => {
    const targets = w.plan.days.map((d) => d.kcal);
    const sum = summarizeWeek(meals, monday, targets);
    const tgt = (k: 'P' | 'F' | 'C') => w.plan.days.reduce((a, d) => a + d[k], 0) / 7;
    return { sum, tgt };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.plan, meals, weekBack]);

  // 体重カードの小さなグラフ（直近28日）
  const cardW = Math.min(width - 32, 560) - 28;
  const mini = useMemo(() => buildWeightChart({ weights, today: now, days: 28, fut: 0, goal: null, pace: 0, W: cardW, H: 88, padL: 0 }), [weights, now, cardW]);

  const cellBg = (c: (typeof cells)[number]) => (c.type === 'high' ? color.brand : c.type === 'normal' ? color.brandPale2 : c.future ? 'transparent' : color.track);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}>
      {/* 見出し：先週と、その期間 */}
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T size={22} w={900}>{weekLabel}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="さらに前の週" disabled={!canOlder && !(limitWeeks !== null && weekBack === limitWeeks)} onPress={() => setWeekBack((n) => n + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: canOlder || (limitWeeks !== null && weekBack === limitWeeks) ? 1 : 0.3 }}>
            <T size={18} c={color.sub}>‹</T>
          </Pressable>
          <N size={12} w={500} c={color.sub}>{md(dateKey(monday))}〜{md(dateKey(addDays(monday, 6)))}</N>
          <Pressable accessibilityRole="button" accessibilityLabel="新しい週" disabled={weekBack <= 1} onPress={() => setWeekBack((n) => Math.max(1, n - 1))} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: weekBack <= 1 ? 0.3 : 1 }}>
            <T size={18} c={color.sub}>›</T>
          </Pressable>
        </View>
      </View>

      {/* トレーニング（直近4週）：回数と、カレンダー。マスは色だけ（高＝brand、通常＝薄い色、休み＝グレー、先の日は点線） */}
      <View style={{ paddingHorizontal: 20, paddingTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T size={11} c={color.sub}>トレーニング（直近4週）</T>
        <T size={13} c={color.badgeFg}><N size={22} w={600} c={color.text}>{count}</N> 回</T>
      </View>
      <View style={{ marginHorizontal: 20, marginTop: 8, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {DOW.map((d) => (
            <View key={d} style={{ flex: 1, alignItems: 'center' }}>
              <T size={10} w={700} c={color.sub}>{d}</T>
            </View>
          ))}
        </View>
        {[0, 1, 2, 3].map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 4 }}>
            {cells.slice(r * 7, r * 7 + 7).map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityLabel={`${md(c.key)}${c.type ? (c.type === 'high' ? ' 高い日のトレーニング' : ' 通常の日のトレーニング') : ''}`}
                onPress={() => { setSel(c.key); setConfirm(null); }}
                style={{ flex: 1, height: 36, borderRadius: 5, backgroundColor: cellBg(c), borderWidth: c.key === sel ? 2 : c.today ? 1.5 : c.future ? hairline : 0, borderColor: c.key === sel ? color.text : c.today ? color.sub : color.lineStrong, borderStyle: c.future && c.key !== sel && !c.today ? 'dashed' : 'solid' }}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', gap: 12 }}>
        {([['高い日', color.brand], ['通常の日', color.brandPale2]] as const).map(([label, c]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: c }} />
            <T size={10.5} c={color.sub}>{label}</T>
          </View>
        ))}
      </View>

      {/* その日のカード：日付・メニュー名・日タイプ・セット数と時間・種目ごとのセット */}
      <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, padding: 14, gap: 10 }}>
        {selDay.length === 0 ? (
          <>
            <View style={{ gap: 2 }}>
              <T size={12} c={color.sub}>{selLabel}</T>
              <T size={18} w={700}>{selFuture ? 'まだ先の日' : '休み'}</T>
            </View>
            <T size={13} c={color.sub}>{selFuture ? `予定：${templateName(w.templates, w.weekPlan[selPlanIdx])}` : 'トレーニングの記録はありません'}</T>
          </>
        ) : (
          selDay.map((x, si) => {
            const mins = Math.max(1, Math.round((x.endedAt - x.startedAt) / 60000));
            return (
              <View key={x.id} style={{ gap: 10, ...(si > 0 ? { borderTopWidth: hairline, borderTopColor: color.line, paddingTop: 12 } : null) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ gap: 2, flex: 1 }}>
                    <T size={12} c={color.sub}>{selLabel}</T>
                    <T size={18} w={700}>{x.name}</T>
                  </View>
                  <Badge high={x.dayType === 'high'}>{x.dayType === 'high' ? '高' : '通常'}</Badge>
                </View>
                <N size={14} w={500} c={color.badgeFg}>{x.doneSets}セット · {mins}分</N>
                <View style={{ borderTopWidth: hairline, borderTopColor: color.line }}>
                  {x.exercises.map((e, j) => {
                    const done = e.sets.filter((t) => t.done);
                    return (
                      <View key={e.exerciseId} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                        <N size={14} w={600} c={color.sub} style={{ width: 22 }}>{j + 1}</N>
                        <T size={14} numberOfLines={1} style={{ flex: 1 }}>{e.name}</T>
                        <N size={14} w={500}>{done.length ? `${kgTimes(done[0].kg)}${done.map((t) => t.reps).join('・')}` : ''}</N>
                      </View>
                    );
                  })}
                </View>
                {!!x.memo && <T size={12.5} c={color.badgeFg}>メモ：{x.memo}</T>}
                <Pressable accessibilityRole="button" onPress={() => (confirm === x.id ? (deleteSession(x.id), setConfirm(null)) : setConfirm(x.id))} style={{ minHeight: 40, justifyContent: 'center' }}>
                  <T size={12} w={confirm === x.id ? 700 : 400} c={confirm === x.id ? color.brandText : color.sub}>{confirm === x.id ? 'もう一度押すと、この記録を削除' : 'この記録を削除'}</T>
                </Pressable>
              </View>
            );
          })
        )}
      </View>

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

      {locked ? (
        <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
          <Notice>無料プランでは、直近{limitWeeks}週までふりかえれます。これより前は有料プランで見られます。</Notice>
          <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} w={700}>プランを見る ›</T>
          </Pressable>
        </View>
      ) : (
        /* 平均PFC（縦線が目標）。ペースの見直しと「先週は目標より+800kcal」の文は出さない（自己管理できる人が対象） */
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
                  <N size={15} w={600} style={{ minWidth: 64, textAlign: 'right' }}>{fmt(a)}/{fmt(t)}</N>
                </View>
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}
