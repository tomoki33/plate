import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Bar, N, PrimaryButton, T, color, hairline, radius } from '@/design-system';
import { MealFlow } from '../../components/MealFlow';
import { WeightSheet } from '../../components/WeightSheet';
import { useNow } from '../../components/useNow';
import { formatJpDate, dateKey, slotOf } from '../../domain/dates';
import { DAY_LABELS, DAY_TYPE_JP, type DayType, type Macro } from '../../domain/types';
import { groupMeals, sumMeals, templateName, weightAverage7, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
/** 日タイプの色（配色が変わっても読み直せるよう関数にする） */
const typeColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const MACROS: [string, Macro, string][] = [
  ['P たんぱく質', 'P', color.P],
  ['F 脂質', 'F', color.F],
  ['C 炭水化物', 'C', color.C],
];
const sign = (n: number) => (n >= 0 ? '+' : '−');

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);
  const removeMealGroup = useStore((s) => s.removeMealGroup);
  const setWeight = useStore((s) => s.setWeight);
  const maybeUpdateTdee = useStore((s) => s.maybeUpdateTdee);
  const recordTarget = useStore((s) => s.recordTarget);
  const [viewDay, setViewDay] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'meal' | 'weight'>(null);
  const [mode, setMode] = useState<0 | 1 | 2>(0);
  const { meal } = useLocalSearchParams<{ meal?: string }>();

  useEffect(() => {
    if (meal) {
      setViewDay(null);
      setMode(0);
      setSheet('meal');
      router.setParams({ meal: undefined });
    }
  }, [meal, router]);

  // 週が変わったら、実データで維持カロリーを補正する
  const weekKey = dateKey(w.dates[0]);
  useEffect(() => {
    maybeUpdateTdee(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  // 今日の目標が変わったら履歴に残す（再配分の理由つき）
  const t = w.today;
  useEffect(() => {
    const reason = w.changed ? (w.todayWorkout ? 'workout' : 'day-type') : Math.abs(t.kcal - w.plan.days[w.ti].kcal) > 1 ? 'intake' : 'plan';
    recordTarget(w.todayKey, { dayType: t.type, kcal: t.kcal, P: t.P, F: t.F, C: t.C }, reason);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.todayKey, t.type, t.kcal, t.P, t.F, t.C]);

  const vd = viewDay ?? w.ti;
  const isToday = vd === w.ti;
  const dd = w.eng.days[vd];
  const maxK = Math.max(...w.eng.days.map((d) => d.kcal));
  const viewKey = dateKey(w.dates[vd]);
  const viewEaten = useMemo(() => sumMeals(meals.filter((m) => m.date === viewKey)), [meals, viewKey]);
  const past = vd < w.ti;
  const linked = w.features.linkedTargets;

  const menuOf = (i: number) => (i === w.ti && w.todayWorkout ? w.todayWorkout.name : i === w.ti && dd && w.eng.days[i].type === 'off' && w.changed ? 'オフ' : templateName(w.templates, w.weekPlan[i]));
  const badgeText = (i: number) => (w.eng.days[i].type === 'off' ? 'オフ' : `${menuOf(i)}・${DAY_TYPE_JP[w.eng.days[i].type]}`);

  const dC = w.today.C - w.plan.days[w.ti].C;
  let lineL = '';
  let lineR = '';
  let lineC: string = color.badgeFg;
  if (isToday) {
    if (w.todayWorkout) {
      const tm = new Date(w.todayWorkout.endedAt);
      lineL = `${String(tm.getHours()).padStart(2, '0')}:${String(tm.getMinutes()).padStart(2, '0')} ${w.todayWorkout.name} 完了`;
      lineR = w.changed ? `目標変更 C${sign(dC)}${Math.abs(dC)}g` : '予定どおり・目標そのまま';
      lineC = color.brandText;
    } else if (w.changed) {
      lineL = w.today.type === 'off' ? '今日は休み' : `今日は${DAY_TYPE_JP[w.today.type]}に変更`;
      lineR = `目標変更 C${sign(dC)}${Math.abs(dC)}g`;
      lineC = color.brandText;
    } else if (w.today.type === 'off') {
      lineL = 'トレなし';
      lineR = linked ? 'Pは維持、Cを減らす' : '';
    } else {
      lineL = `${templateName(w.templates, w.todayTemplateId)}の予定`;
      lineR = 'トレ前';
    }
  } else if (past) {
    lineL = '記録済み';
    lineR = viewEaten.kcal ? `実績 ${fmt(viewEaten.kcal)} kcal` : '記録なし';
  } else {
    lineL = dd.type === 'off' ? 'トレなし' : `予定：${templateName(w.templates, w.weekPlan[vd])}`;
    lineR = linked ? (dd.type === 'off' ? 'Pは維持、Cを減らす' : '予定を変えたら残りの日に配り直し') : '';
  }

  const rem = w.remaining;
  const kcalLabel = isToday ? (rem.kcal >= 0 ? '残り（目安）' : '超過（目安）') : past ? '実績' : '目標（目安）';
  const kcalBig = isToday ? Math.abs(rem.kcal) : past ? viewEaten.kcal : dd.kcal;
  const kcalSub = isToday || past ? `/ 目標 ${fmt(dd.kcal)} kcal` : 'kcal';
  const avg7 = weightAverage7(weights, now);
  const groups = useMemo(() => groupMeals(w.todayMeals), [w.todayMeals]);
  const openMeal = (m: 0 | 1 | 2 = 0) => {
    setMode(m);
    setSheet('meal');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 110 }}>
        <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <T size={13} c={color.sub}>{formatJpDate(w.dates[vd])}</T>
          <Badge high={dd.type === 'high'}>{badgeText(vd)}</Badge>
        </View>

        {/* 週バー */}
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginTop: 12 }}>
          {w.eng.days.map((d, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_LABELS[i]}曜日を表示`}
              onPress={() => setViewDay(i)}
              style={{ flex: 1, height: 56, borderRadius: radius.button, backgroundColor: i === vd ? color.surface : 'transparent', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
            >
              <View style={{ width: 18, height: Math.round((d.kcal / maxK) * 34), backgroundColor: typeColor(d.type), borderRadius: radius.bar }} />
              <T size={11} w={i === vd ? 700 : 400} c={i === vd ? color.text : i === w.ti ? color.brandText : color.sub} style={{ marginTop: 4 }}>
                {DAY_LABELS[i]}
              </T>
            </Pressable>
          ))}
        </View>

        {/* 残りkcal */}
        <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
          <T size={11} c={color.sub}>{kcalLabel}</T>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <N size={60} w={600} c={isToday && rem.kcal < 0 ? color.brandText : color.text} style={{ lineHeight: 60, letterSpacing: -1 }}>
              {fmt(kcalBig)}
            </N>
            <T size={13} c={color.sub}>{kcalSub}</T>
          </View>
        </View>

        {/* PFC */}
        <View style={{ paddingHorizontal: 22, marginTop: 16, gap: 12 }}>
          {MACROS.map(([name, k, c]) => {
            const eaten = isToday ? w.eaten[k] : past ? viewEaten[k] : 0;
            const over = isToday && rem[k] < 0;
            return (
              <View key={k}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <T size={12} w={700} c={c}>{name}</T>
                  {isToday ? (
                    <N size={20} w={600} c={over ? color.brandText : color.text}>
                      {over ? `+${Math.round(-rem[k])}` : `あと ${Math.round(rem[k])}`}
                      <T size={12} c={color.sub}> g / {dd[k]}</T>
                    </N>
                  ) : (
                    <N size={20} w={600}>
                      {past ? Math.round(viewEaten[k]) : dd[k]}
                      <T size={12} c={color.sub}> g{past ? ` / ${dd[k]}` : ''}</T>
                    </N>
                  )}
                </View>
                <Bar pct={dd[k] ? (eaten / dd[k]) * 100 : 0} fill={c} />
              </View>
            );
          })}
        </View>

        {/* 状態の行 */}
        <View style={{ marginTop: 16, marginHorizontal: 22, borderTopWidth: hairline, borderBottomWidth: hairline, borderColor: color.line, minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <T size={13} c={color.badgeFg}>{lineL}</T>
          <T size={13} w={700} c={lineC}>{lineR}</T>
        </View>

        {!linked && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ marginHorizontal: 22, minHeight: 44, justifyContent: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <T size={12} c={color.sub}>目標は毎日同じです。トレに合わせて変わる「日タイプ連動」は有料プランで使えます。 <T size={12} w={700}>プランを見る ›</T></T>
          </Pressable>
        )}

        {isToday && (
          <>
            {/* 体重 */}
            <Pressable accessibilityRole="button" onPress={() => setSheet('weight')} style={{ marginHorizontal: 22, minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={13} c={color.badgeFg}>
                {w.weightLogged ? (
                  <>
                    <N size={15} w={600}>{w.weight.toFixed(1)}</N> kg{avg7 ? `・7日平均 ${avg7.toFixed(1)}` : ''}
                  </>
                ) : (
                  '今朝はまだ'
                )}
              </T>
              <T size={13} w={700} c={w.weightLogged ? color.sub : color.text}>{w.weightLogged ? '変更' : '入力'}</T>
            </Pressable>

            {/* 食事リスト */}
            <View style={{ marginTop: 14, paddingHorizontal: 22 }}>
              <T size={11} c={color.sub}>食事 {groups.length}件</T>
              {groups.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>まだ記録がありません。</T>}
              {groups.map((g) => (
                <View key={g.groupId} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
                  <T size={12} c={color.sub} style={{ width: 36 }}>{g.slot}</T>
                  <T size={14} style={{ flex: 1 }} numberOfLines={1}>{g.name}</T>
                  {g.ai && <Badge high>AI</Badge>}
                  <N size={15} w={500} style={{ marginLeft: 8, minWidth: 40, textAlign: 'right' }}>{fmt(g.kcal)}</N>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${g.name}を削除`} onPress={() => removeMealGroup(g.groupId)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={16} c={color.sub}>×</T>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* 固定の主ボタン */}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 12 }}>
        <PrimaryButton label={isToday ? '食事を記録' : '今日に戻る'} onPress={() => (isToday ? openMeal(0) : setViewDay(null))} />
      </View>

      <MealFlow open={sheet === 'meal'} initialMode={mode} onClose={() => setSheet(null)} remaining={rem} todayKey={w.todayKey} slot={slotOf(now)} postWorkout={!!w.todayWorkout} aiLimit={w.features.aiLimit} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} initial={w.weight} onSave={(kg) => setWeight(w.todayKey, kg)} />
    </View>
  );
}
