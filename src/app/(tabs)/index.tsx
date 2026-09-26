import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Bar, N, OutlineButton, PrimaryButton, T, color, hairline, radius } from '@/design-system';
import { CameraIcon } from '../../components/AuthIcons';
import { EditMealSheet } from '../../components/EditMealSheet';
import { MealFlow, PhotoThumb } from '../../components/MealFlow';
import { WeightSheet } from '../../components/WeightSheet';
import { useNow } from '../../components/useNow';
import { pickPhoto, type PickedPhoto } from '../../services/photos';
import { addDays, dateKey, formatJpDate, slotOf } from '../../domain/dates';
import { DAY_LABELS, DAY_TYPE_JP, type DayType, type Macro } from '../../domain/types';
import { groupMeals, sumMeals, templateName, weightAverage7, useWeek, type MealGroup } from '../../store/selectors';
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
  const sessions = useStore((s) => s.sessions);
  const weights = useStore((s) => s.weights);
  const removeMealGroup = useStore((s) => s.removeMealGroup);
  const maybeUpdateTdee = useStore((s) => s.maybeUpdateTdee);
  const recordTarget = useStore((s) => s.recordTarget);
  // 見ている日。null は今日。week は「何週前か」（0＝今週）、day は月曜=0
  const [sel, setSel] = useState<{ week: number; day: number } | null>(null);
  const [editing, setEditing] = useState<MealGroup | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [weightDate, setWeightDate] = useState<string | null>(null);
  const showToast = useStore((s) => s.showToast);
  const [sheet, setSheet] = useState<null | 'meal'>(null);
  const [mode, setMode] = useState<0 | 1 | 2>(0);
  const { meal } = useLocalSearchParams<{ meal?: string }>();

  useEffect(() => {
    if (meal) {
      setSel(null);
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

  const weekBack = sel?.week ?? 0;
  const vd = sel?.day ?? w.ti;
  const dates = useMemo(() => w.dates.map((d) => addDays(d, -7 * weekBack)), [w.dates, weekBack]);
  const viewDate = dates[vd];
  const viewKey = dateKey(viewDate);
  const isToday = viewKey === w.todayKey;
  const isPast = viewKey < w.todayKey;
  // 今週は再配分後の目標。前の週は、いまの予定をもとにした基準の目標（その週の再配分は残していない）
  const bars = weekBack === 0 ? w.eng.days : w.plan.days;
  const dd = bars[vd];
  const maxK = Math.max(...bars.map((d) => d.kcal));
  const viewMeals = useMemo(() => meals.filter((m) => m.date === viewKey), [meals, viewKey]);
  const viewEaten = useMemo(() => sumMeals(viewMeals), [viewMeals]);
  const viewGroups = useMemo(() => groupMeals(viewMeals), [viewMeals]);
  const viewWorkouts = useMemo(() => sessions.filter((x) => x.date === viewKey), [sessions, viewKey]);
  const viewWeight = weights[viewKey];
  const past = isPast;
  const linked = w.features.linkedTargets;
  const canRecord = isToday || isPast;
  const viewRemaining = isToday ? w.remaining : { kcal: dd.kcal - viewEaten.kcal, P: dd.P - viewEaten.P, F: dd.F - viewEaten.F, C: dd.C - viewEaten.C };
  const dayLabel = `${viewDate.getMonth() + 1}/${viewDate.getDate()}（${DAY_LABELS[vd]}）`;
  const go = (week: number, day = vd) => setSel(week === 0 && day === w.ti ? null : { week, day });

  const menuOf = (i: number) => (i === w.ti && w.todayWorkout ? w.todayWorkout.name : i === w.ti && w.eng.days[i].type === 'off' && w.changed ? 'オフ' : templateName(w.templates, w.weekPlan[i]));
  const badgeText = (i: number) => (bars[i].type === 'off' ? 'オフ' : `${weekBack === 0 ? menuOf(i) : templateName(w.templates, w.weekPlan[i])}・${DAY_TYPE_JP[bars[i].type]}`);

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
      lineL = 'トレーニングなし';
      lineR = linked ? 'Pは維持、Cを減らす' : '';
    } else {
      lineL = `${templateName(w.templates, w.todayTemplateId)}の予定`;
      lineR = 'トレーニング前';
    }
  } else if (past) {
    lineL = viewEaten.kcal ? '記録済み' : '記録なし';
    lineR = viewEaten.kcal ? `目標より ${sign(viewEaten.kcal - dd.kcal)}${fmt(Math.abs(viewEaten.kcal - dd.kcal))}kcal` : '下から追加できます';
  } else {
    lineL = dd.type === 'off' ? 'トレーニングなし' : `予定：${templateName(w.templates, w.weekPlan[vd])}`;
    lineR = linked ? (dd.type === 'off' ? 'Pは維持、Cを減らす' : '予定を変えたら残りの日に配り直し') : '';
  }

  const rem = viewRemaining;
  const kcalLabel = isToday ? (rem.kcal >= 0 ? '残り（目安）' : '超過（目安）') : past ? '実績' : '目標（目安）';
  const kcalBig = isToday ? Math.abs(rem.kcal) : past ? viewEaten.kcal : dd.kcal;
  const kcalSub = isToday || past ? `/ 目標 ${fmt(dd.kcal)} kcal` : 'kcal';
  const avg7 = weightAverage7(weights, viewDate);
  const openMeal = (m: 0 | 1 | 2 = 0) => {
    setMode(m);
    setSheet('meal');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 4, paddingBottom: 110 }}>
        <View style={{ paddingLeft: 10, paddingRight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable accessibilityRole="button" accessibilityLabel="前の週" disabled={weekBack >= 52} onPress={() => go(weekBack + 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: weekBack >= 52 ? 0.3 : 1 }}>
              <T size={18} c={color.sub}>‹</T>
            </Pressable>
            <T size={13} c={color.sub}>{formatJpDate(viewDate)}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="次の週" disabled={weekBack === 0} onPress={() => go(weekBack - 1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: weekBack === 0 ? 0.3 : 1 }}>
              <T size={18} c={color.sub}>›</T>
            </Pressable>
          </View>
          <Badge high={dd.type === 'high'}>{badgeText(vd)}</Badge>
        </View>

        {/* 週バー */}
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 16, marginTop: 4 }}>
          {bars.map((d, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`${DAY_LABELS[i]}曜日を表示`}
              onPress={() => go(weekBack, i)}
              style={{ flex: 1, height: 56, borderRadius: radius.button, backgroundColor: i === vd ? color.surface : 'transparent', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 }}
            >
              <View style={{ width: 18, height: Math.round((d.kcal / maxK) * 34), backgroundColor: typeColor(d.type), borderRadius: radius.bar }} />
              <T size={11} w={i === vd ? 700 : 400} c={i === vd ? color.text : weekBack === 0 && i === w.ti ? color.brandText : color.sub} style={{ marginTop: 4 }}>
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

        {!linked && isToday && (
          <Pressable accessibilityRole="button" onPress={() => router.push('/paywall')} style={{ marginHorizontal: 22, minHeight: 44, justifyContent: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <T size={12} c={color.sub}>目標は毎日同じです。トレーニングに合わせて変わる「日タイプ連動」は有料プランで使えます。 <T size={12} w={700}>プランを見る ›</T></T>
          </Pressable>
        )}

        {canRecord && (
          <>
            {/* 体重（高さ52）。未入力は「今朝の体重」を太字に、前回の値と黒い「入力」ボタン。入力済みは枠だけの「変更」 */}
            <Pressable accessibilityRole="button" onPress={() => setWeightDate(viewKey)} style={{ marginHorizontal: 22, minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={13} w={viewWeight !== undefined ? 400 : 700} c={viewWeight !== undefined ? color.sub : color.text}>{viewWeight !== undefined ? '体重' : isToday ? '今朝の体重' : `${dayLabel}の体重`}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T size={13} c={color.badgeFg}>
                  {viewWeight !== undefined ? (
                    <>
                      <N size={15} w={600}>{viewWeight.toFixed(1)}</N> kg{avg7 ? `・7日平均 ${avg7.toFixed(1)}` : ''}
                    </>
                  ) : (
                    `前回 ${w.latestWeight.toFixed(1)}`
                  )}
                </T>
                <View style={{ height: 32, paddingHorizontal: 12, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', backgroundColor: viewWeight !== undefined ? 'transparent' : color.text, borderWidth: hairline, borderColor: viewWeight !== undefined ? color.lineStrong : color.text }}>
                  <T size={12} w={700} c={viewWeight !== undefined ? color.badgeFg : color.onText}>{viewWeight !== undefined ? '変更' : '入力'}</T>
                </View>
              </View>
            </Pressable>

            {/* その日のトレーニング（記録があれば） */}
            {!isToday && viewWorkouts.map((x) => (
              <View key={x.id} style={{ marginHorizontal: 22, minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
                <T size={13} c={color.badgeFg}>トレーニング：{x.name}</T>
                <T size={12} c={color.sub}>{x.doneSets}セット</T>
              </View>
            ))}

            {/* 食事リスト（タップで編集） */}
            <View style={{ marginTop: 14, paddingHorizontal: 22 }}>
              <T size={11} c={color.sub}>食事 {viewGroups.length}件</T>
              {viewGroups.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>まだ記録がありません。</T>}
              {viewGroups.map((g) => (
                <View key={g.groupId} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${g.name}を編集`} onPress={() => setEditing(g)} style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
                    <T size={12} c={color.sub} style={{ width: 36 }}>{g.slot}</T>
                    {g.photoUri ? <View style={{ marginRight: 8 }}><PhotoThumb photo={{ uri: g.photoUri }} size={28} /></View> : null}
                    <T size={13.5} style={{ flex: 1 }} numberOfLines={1}>{g.name}</T>
                    {g.ai && !g.photoUri && <Badge high>AI</Badge>}
                    <N size={15} w={500} style={{ marginLeft: 8, minWidth: 40, textAlign: 'right' }}>{fmt(g.kcal)}</N>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${g.name}を削除`} onPress={() => removeMealGroup(g.groupId)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={16} c={color.sub}>×</T>
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* 固定のボタン。今日は［カメラ］［食事を記録］。他の日を見ているときはカメラを隠し、「今日に戻る」を出す */}
      <View style={{ position: 'absolute', left: 22, right: 22, bottom: 12, flexDirection: 'row', gap: 8 }}>
        {isToday && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="写真で記録"
            onPress={async () => {
              const r = await pickPhoto('camera');
              if (r.error) return showToast(r.error);
              if (!r.photo) return;
              setPhoto(r.photo);
              openMeal(2);
            }}
            style={{ width: 52, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}
          >
            <CameraIcon size={24} />
          </Pressable>
        )}
        {!isToday && <OutlineButton label="今日に戻る" onPress={() => setSel(null)} style={{ flex: 1 }} />}
        {canRecord && <PrimaryButton label={isToday ? '食事を記録' : `${dayLabel}に記録`} onPress={() => openMeal(0)} style={{ flex: isToday ? 1 : 1.5 }} />}
      </View>

      <MealFlow
        open={sheet === 'meal'}
        initialMode={mode}
        onClose={() => setSheet(null)}
        remaining={rem}
        todayKey={w.todayKey}
        date={viewKey}
        dateLabel={isToday ? null : dayLabel}
        slot={isToday ? slotOf(now) : '昼'}
        postWorkout={isToday && !!w.todayWorkout}
        aiLimit={w.features.aiLimit}
        photo={photo}
        onPhoto={setPhoto}
      />
      <WeightSheet open={weightDate !== null} onClose={() => setWeightDate(null)} initialDate={weightDate ?? viewKey} now={now} />
      <EditMealSheet group={editing} onClose={() => setEditing(null)} />
    </View>
  );
}
