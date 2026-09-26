import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MealFlow } from '../../components/MealFlow';
import { Bar, Badge, N, PrimaryButton, T } from '../../components/ui';
import { WeightSheet } from '../../components/WeightSheet';
import { useNow } from '../../components/useNow';
import { DAY_LABELS, DAY_TYPE_JP, type DayType, type Macro } from '../../domain/types';
import { formatJpDate, dateKey } from '../../domain/dates';
import { planMenuOf, sumMeals, weightAverage7, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';
import { color, hairline, radius } from '../../theme';

const fmt = (n: number) => Math.round(n).toLocaleString();
const TYPE_COLOR: Record<DayType, string> = { high: color.brand, normal: color.brandPale2, off: color.off };
const MACROS: [string, Macro, string][] = [
  ['P たんぱく質', 'P', color.P],
  ['F 脂質', 'F', color.F],
  ['C 炭水化物', 'C', color.C],
];
const sign = (n: number) => (n >= 0 ? '+' : '−');

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const w = useWeek(now);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);
  const removeMeal = useStore((s) => s.removeMeal);
  const setWeight = useStore((s) => s.setWeight);
  const [viewDay, setViewDay] = useState<number | null>(null);
  const [sheet, setSheet] = useState<null | 'meal' | 'weight'>(null);
  const [mode, setMode] = useState<0 | 1 | 2>(0);
  const router = useRouter();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  useEffect(() => {
    if (meal) {
      setViewDay(null);
      setMode(0);
      setSheet('meal');
      router.setParams({ meal: undefined });
    }
  }, [meal, router]);

  const vd = viewDay ?? w.ti;
  const isToday = vd === w.ti;
  const dd = w.eng.days[vd];
  const maxK = Math.max(...w.eng.days.map((d) => d.kcal));
  const viewKey = dateKey(w.dates[vd]);
  const viewEaten = sumMeals(meals.filter((m) => m.date === viewKey));
  const past = vd < w.ti;

  const menuOf = (i: number) => (i === w.ti && w.todayWorkout ? w.todayWorkout.name : i === w.ti && w.eng.days[i].type === 'off' ? 'オフ' : planMenuOf(w.settings.plan[i]));
  const badgeText = (i: number) => (w.eng.days[i].type === 'off' ? 'オフ' : `${menuOf(i)}・${DAY_TYPE_JP[w.eng.days[i].type]}`);

  const dC = w.today.C - w.plan.days[w.ti].C;

  // 状態の行
  let lineL = '';
  let lineR = '';
  let lineC: string = color.badgeFg;
  if (isToday) {
    if (w.todayWorkout) {
      const t = new Date(w.todayWorkout.finishedAt);
      lineL = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} ${w.todayWorkout.name} 完了`;
      lineR = w.changed ? `目標変更 C${sign(dC)}${Math.abs(dC)}g` : '予定どおり・目標そのまま';
      lineC = color.brandText;
    } else if (w.changed) {
      lineL = w.today.type === 'off' ? '今日は休み' : `今日は${DAY_TYPE_JP[w.today.type]}に変更`;
      lineR = `目標変更 C${sign(dC)}${Math.abs(dC)}g`;
      lineC = color.brandText;
    } else if (w.today.type === 'off') {
      lineL = 'トレなし';
      lineR = 'Pは維持、Cを減らす';
    } else {
      lineL = `${planMenuOf(w.settings.plan[w.ti])}の予定`;
      lineR = 'トレ前';
    }
  } else if (past) {
    lineL = '記録済み';
    lineR = viewEaten.kcal ? `実績 ${fmt(viewEaten.kcal)} kcal` : '記録なし';
  } else {
    lineL = dd.type === 'off' ? 'トレなし' : `予定：${planMenuOf(w.settings.plan[vd])}`;
    lineR = dd.type === 'off' ? 'Pは維持、Cを減らす' : '予定を変えたら残りの日に配り直し';
  }

  const rem = w.remaining;
  const kcalLabel = isToday ? (rem.kcal >= 0 ? '残り（目安）' : '超過（目安）') : past ? '実績' : '目標（目安）';
  const kcalBig = isToday ? Math.abs(rem.kcal) : past ? viewEaten.kcal : dd.kcal;
  const kcalSub = isToday ? `/ 目標 ${fmt(dd.kcal)} kcal` : past ? `/ 目標 ${fmt(dd.kcal)} kcal` : 'kcal';
  const avg7 = weightAverage7(weights, now);
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
              style={{ flex: 1, height: 56, borderRadius: radius.button, backgroundColor: i === vd ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
            >
              <View style={{ width: 18, height: Math.round((d.kcal / maxK) * 34), backgroundColor: TYPE_COLOR[d.type], borderRadius: radius.bar }} />
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
            const eaten = isToday || past ? (isToday ? w.eaten[k] : viewEaten[k]) : 0;
            const over = isToday && rem[k] < 0;
            return (
              <View key={k}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
                  <T size={12} w={700} c={c}>{name}</T>
                  {isToday ? (
                    <N size={20} w={600} c={over ? color.brandText : color.text}>
                      {over ? `+${-rem[k]}` : `あと ${rem[k]}`}
                      <T size={12} c={color.sub}> g / {dd[k]}</T>
                    </N>
                  ) : (
                    <N size={20} w={600}>
                      {past ? viewEaten[k] : dd[k]}
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
              <T size={11} c={color.sub}>食事 {w.todayMeals.length}件</T>
              {w.todayMeals.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>まだ記録がありません。</T>}
              {w.todayMeals.map((m) => (
                <View key={m.id} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
                  <T size={12} c={color.sub} style={{ width: 36 }}>{m.slot}</T>
                  <T size={14} style={{ flex: 1 }} numberOfLines={1}>{m.name}</T>
                  {m.ai && <Badge high>AI</Badge>}
                  <N size={15} w={500} style={{ marginLeft: 8, minWidth: 40, textAlign: 'right' }}>{fmt(m.kcal)}</N>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${m.name}を削除`} onPress={() => removeMeal(m.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
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

      <MealFlow open={sheet === 'meal'} initialMode={mode} onClose={() => setSheet(null)} remaining={rem} todayKey={w.todayKey} postWorkout={!!w.todayWorkout} />
      <WeightSheet open={sheet === 'weight'} onClose={() => setSheet(null)} initial={w.weight} onSave={(kg) => setWeight(w.todayKey, kg)} />
    </View>
  );
}
