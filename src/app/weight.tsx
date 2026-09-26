import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { N, Segmented, T, color, hairline } from '@/design-system';
import { WeightChartView } from '../components/WeightChart';
import { WeightSheet } from '../components/WeightSheet';
import { useNow } from '../components/useNow';
import { addDays, dateKey } from '../domain/dates';
import { buildWeightChart, signed1 } from '../domain/weight';
import { useWeightStats } from '../store/selectors';
import { useStore } from '../store/store';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const dayLabel = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}（${WD[d.getDay()]}）`;
type Range = 30 | 90 | 0;

/** 体重の詳細（レビューから進む全画面）＝ README 5-2 */
export default function WeightDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const now = useNow();
  const stats = useWeightStats(now);
  const weights = useStore((s) => s.weights);
  const [range, setRange] = useState<Range>(30);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  const first = useMemo(() => Object.keys(weights).sort()[0], [weights]);
  const allDays = first ? Math.min(365, Math.max(30, Math.round((now.getTime() - new Date(first).getTime()) / 86400000) + 1)) : 30;
  const days = range === 0 ? allDays : range;
  const W = Math.min(width - 44, 520);
  const chart = useMemo(
    () => buildWeightChart({ weights, today: now, days, fut: Math.round(days * 0.3), goal: stats.goal, pace: stats.pace ?? 0, W, H: 190, padL: 26 }),
    [weights, now, days, stats.goal, stats.pace, W],
  );

  // 記録の一覧（直近30日）。値と、その前の記録との差
  const records = useMemo(() => {
    const keys = Object.keys(weights).sort();
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(now, -i);
      const key = dateKey(d);
      const v = weights[key];
      const prevKey = [...keys].reverse().find((k) => k < key);
      return { key, d, i, v, diff: v !== undefined && prevKey ? v - weights[prevKey] : null };
    });
  }, [weights, now]);

  const todayKey = dateKey(now);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 44 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <T size={14} c={color.sub}>‹ レビュー</T>
        </Pressable>
        <T size={15} w={700}>体重</T>
        <Pressable accessibilityRole="button" onPress={() => setSheetDate(todayKey)} style={{ height: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <T size={14} w={700}>＋ 入力</T>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <T size={12} c={color.sub}>7日平均</T>
            <N size={48} w={600} style={{ lineHeight: 50 }}>
              {stats.avg !== null ? stats.avg.toFixed(1) : '—'}
              <T size={16} c={color.sub}> kg</T>
            </N>
            <T size={12} c={color.badgeFg} style={{ marginTop: 6 }}>{stats.weekDiff !== null ? `先週より ${signed1(stats.weekDiff)} kg` : '先週との比較は、記録がたまると出ます'}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T size={12} c={color.sub}>目標</T>
            <N size={24} w={600}>
              {stats.goal !== null ? stats.goal.toFixed(1) : '—'}
              <T size={12} c={color.sub}> kg</T>
            </N>
            <T size={12} c={color.badgeFg} style={{ marginTop: 2 }}>{stats.left === null ? '設定で目標体重を入れる' : stats.left > 0.04 ? `あと ${stats.left.toFixed(1)} kg` : '達成'}</T>
          </View>
        </View>

        <View style={{ marginHorizontal: 22, marginTop: 16 }}>
          <Segmented value={range} onChange={setRange} options={[{ value: 30 as Range, label: '1か月' }, { value: 90 as Range, label: '3か月' }, { value: 0 as Range, label: '全期間' }]} />
        </View>

        <View style={{ marginHorizontal: 22, marginTop: 14 }}>
          {chart.empty ? (
            <T size={13} c={color.sub} style={{ paddingVertical: 40, textAlign: 'center' }}>体重を記録すると、推移が出ます。</T>
          ) : (
            <WeightChartView chart={chart} width={W} height={190} padL={26} goal={stats.goal} big />
          )}
        </View>

        <View style={{ paddingHorizontal: 22, paddingTop: 10, flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
          <Legend><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color.lineStrong }} />毎日の値</Legend>
          <Legend><View style={{ width: 14, height: 2, backgroundColor: color.text }} />7日平均</Legend>
          <Legend><View style={{ width: 14, borderTopWidth: 1.5, borderStyle: 'dotted', borderColor: color.sub }} />今のペースの見込み</Legend>
        </View>

        <View style={{ marginHorizontal: 22, marginTop: 14, borderTopWidth: hairline, borderBottomWidth: hairline, borderColor: color.line, paddingVertical: 10, gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <T size={13} c={color.sub}>今のペース {stats.pace !== null ? `${signed1(stats.pace)}kg/週` : '—'}</T>
            <T size={13} w={700}>{stats.etaActual ?? '—'}</T>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <T size={13} c={color.sub}>予定ペース {signed1(stats.planned)}kg/週</T>
            <T size={13}>{stats.etaPlanned ?? '—'}</T>
          </View>
        </View>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 4 }}>記録（直近30日・押すと修正）</T>
        <View style={{ paddingHorizontal: 22 }}>
          {records.map((r) => (
            <Pressable key={r.key} accessibilityRole="button" onPress={() => setSheetDate(r.key)} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={13} c={r.i === 0 ? color.text : color.badgeFg} style={{ flex: 1 }}>{dayLabel(r.d)}{r.i === 0 ? ' 今日' : ''}</T>
              <N size={17} w={600} c={r.v !== undefined ? color.text : color.faint}>{r.v !== undefined ? r.v.toFixed(1) : '記録なし'}</N>
              <N size={13} w={500} c={color.sub} style={{ width: 60, textAlign: 'right' }}>{r.diff !== null ? signed1(r.diff) : ''}</N>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <WeightSheet open={sheetDate !== null} onClose={() => setSheetDate(null)} initialDate={sheetDate ?? todayKey} now={now} />
    </View>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>{React.Children.map(children, (c) => (typeof c === 'string' ? <T size={10.5} c={color.sub}>{c}</T> : c))}</View>;
}
