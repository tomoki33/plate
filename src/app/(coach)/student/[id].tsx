import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GOAL_JP } from '../../../domain/nutrition';
import { N, T, color, hairline, lightPalette, radius } from '@/design-system';
import { Avatar } from '../../../components/coach/CoachBits';
import { MealBars, WeightLine } from '../../../components/coach/Charts';
import { CoachFrame } from '../../../components/coach/Frames';
import { NoteSheet } from '../../../components/coach/NoteSheet';
import { kpisOf, mealBars, recentMealDay, trainingHistory, weightAvg7, weightSeries } from '../../../features/coach/aggregate';
import { addKey, shortMd, todayIn, weekStartKey } from '../../../features/coach/dateKeys';
import { currentWeightOf } from '../../../features/coach/plan';
import { useCoach } from '../../../store/coachStore';

type Tab = 'sum' | 'meal' | 'wt' | 'tre';
const TABS: { v: Tab; t: string }[] = [{ v: 'sum', t: '概要' }, { v: 'meal', t: '食事' }, { v: 'wt', t: '体重' }, { v: 'tre', t: 'トレ' }];
const INPUT_JP: Record<string, string> = { set: 'マイセット', search: '検索', text: '文章', photo: '写真から', rough: 'ざっくり' };
const SLOT_SHORT: Record<string, string> = { 朝: '朝', 昼: '昼', 間食: '間', 夜: '夜' };
const card = { marginHorizontal: 16, marginTop: 12, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12 } as const;

/** 生徒の詳細：概要 / 食事 / 体重 / トレ。写真は出さない。共有を切った項目は「非公開」 */
export default function StudentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const row = useCoach((s) => s.students.find((x) => x.userId === id));
  const [tab, setTab] = useState<Tab>('sum');
  const [note, setNote] = useState(false);
  const [sel, setSel] = useState<string | null>(null);

  const s = row?.payload ?? null;
  const today = useMemo(() => todayIn(s?.tz || 'Asia/Tokyo'), [s?.tz]);
  const ws = weekStartKey(today);
  const back = { label: '生徒', onPress: () => (router.canGoBack() ? router.back() : router.replace('/students')) };

  if (!row) {
    return (
      <CoachFrame back={back}>
        <View style={{ padding: 28 }}><T size={14} c={color.sub}>この生徒は見つかりませんでした。</T></View>
      </CoachFrame>
    );
  }

  const paused = row.status === 'paused' || !s;
  const goalLabel = (() => {
    const p = row.plan;
    if (p) return `${GOAL_JP[Number(p.pace_per_week) < 0 ? 'cut' : Number(p.pace_per_week) > 0 ? 'bulk' : 'maintain']} → ${Number(p.target_weight).toFixed(1)}kg`;
    if (s?.profile.goalWeightKg) return `${GOAL_JP[s.profile.goal]} → ${s.profile.goalWeightKg.toFixed(1)}kg`;
    return s ? GOAL_JP[s.profile.goal] : '';
  })();

  const body = () => {
    if (paused) {
      return (
        <View style={{ ...card, padding: 18, gap: 6 }}>
          <T size={14} w={700}>ひとりで使用中（一時停止）</T>
          <T size={12} c={color.sub} style={{ lineHeight: 19 }}>{row.studentName}さんは、いま自分の目標で使っています。共有が再開されると、ここに記録が表示されます。目標は送れませんが、ひとことは送れます。</T>
        </View>
      );
    }
    if (tab === 'sum') {
      const kpis = kpisOf(s!, ws, today);
      const plan = row.plan;
      return (
        <>
          <View style={{ ...card, flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' }}>
            {kpis.map((k, i) => (
              <View key={k.key} style={{ width: '50%', padding: 14, gap: 5, borderBottomWidth: i < 2 ? hairline : 0, borderRightWidth: i % 2 === 0 ? hairline : 0, borderColor: color.line }}>
                <T size={11.5} c={color.sub}>{k.label}</T>
                {k.hidden ? (
                  <T size={16} w={700} c={color.sub}>非公開</T>
                ) : (
                  <N size={30} c={k.low ? color.brand : color.text}>
                    {k.value}
                    <T size={12} c={color.sub}> {k.unit}</T>
                  </N>
                )}
                {k.note ? <T size={11} w={k.low ? 700 : 400} c={k.low ? color.brandText : color.sub}>{k.note}</T> : null}
              </View>
            ))}
          </View>
          <View style={{ ...card, paddingHorizontal: 14, paddingVertical: 4 }}>
            <View style={{ minHeight: 40, justifyContent: 'center' }}><T size={12} c={color.sub}>いま送っている目標</T></View>
            {plan ? (
              [
                ['目標体重・ペース', `${Number(plan.target_weight).toFixed(1)}kg・${Number(plan.pace_per_week) === 0 ? '維持' : `${Number(plan.pace_per_week) > 0 ? '+' : '−'}${Math.abs(Number(plan.pace_per_week)).toFixed(2)}kg/週`}`],
                ['P', `${plan.protein_g}g`],
                ['F', `${plan.fat_pct}%`],
                ['メニュー', plan.menus.length ? plan.menus.map((m) => m.name).join('・') : '未設定'],
              ].map(([k, v]) => (
                <View key={k} style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: hairline, borderTopColor: color.line, gap: 12 }}>
                  <T size={14}>{k}</T>
                  <N size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{v}</N>
                </View>
              ))
            ) : (
              <View style={{ minHeight: 44, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line }}>
                <T size={13} c={color.sub}>まだ送っていません。「目標を変える」から送れます。</T>
              </View>
            )}
          </View>
        </>
      );
    }
    if (tab === 'meal') {
      if (!s!.meals) return <Hidden label="食事" />;
      const bars = mealBars(s!, ws);
      const day = recentMealDay(s!, today);
      const dayKey = sel ?? day?.date ?? null;
      const meals = (s!.meals.recent ?? []).filter((m) => m.date === dayKey);
      return (
        <>
          <View style={{ ...card, padding: 14, gap: 10 }}>
            <T size={13} w={700}>7日のkcal</T>
            <MealBars bars={bars} proteinG={s!.profile.proteinG} selected={dayKey} onSelect={setSel} />
          </View>
          <View style={{ ...card, paddingHorizontal: 14, paddingVertical: 4 }}>
            <View style={{ minHeight: 40, justifyContent: 'center' }}><T size={12} c={color.sub}>{dayKey ? `${shortMd(dayKey)} の食事` : '食事'}</T></View>
            {meals.length ? (
              meals.map((m, i) => (
                <View key={i} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: hairline, borderTopColor: color.line }}>
                  <T size={12} c={color.sub} style={{ width: 24 }}>{SLOT_SHORT[m.slot] ?? m.slot}</T>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T size={13} numberOfLines={1}>{m.name}</T>
                    <N size={11} w={500} c={color.sub}>P{m.P} F{m.F} C{m.C}・{INPUT_JP[m.input] ?? m.input}</N>
                  </View>
                  <N size={15}>{m.kcal.toLocaleString()}</N>
                </View>
              ))
            ) : (
              <View style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line }}>
                <T size={12} c={color.sub}>記録なし</T>
              </View>
            )}
          </View>
        </>
      );
    }
    if (tab === 'wt') {
      if (!s!.weight) return <Hidden label="体重" />;
      const series = weightSeries(s!, today, 8);
      const now = weightAvg7(s!, today);
      const prev = weightAvg7(s!, addKey(today, -7));
      const diff = now !== null && prev !== null ? Math.round((now - prev) * 10) / 10 : null;
      const target = row.plan ? Number(row.plan.target_weight) : s!.profile.goalWeightKg;
      return (
        <View style={{ ...card, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={13} w={700}>7日平均・8週</T>
            {target ? <T size={12} c={color.sub}>目標 {target.toFixed(1)}kg</T> : null}
          </View>
          <WeightLine points={series} target={target ?? null} />
          <N size={32}>
            {now !== null ? now.toFixed(1) : currentWeightOf(s).toFixed(1)}
            <T size={13} c={color.sub}> kg{diff !== null ? `　先週比 ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toFixed(1)}` : ''}</T>
          </N>
        </View>
      );
    }
    if (!s!.training) return <Hidden label="トレーニング" />;
    const hist = trainingHistory(s!, 20);
    return (
      <View style={{ ...card, overflow: 'hidden' }}>
        {hist.length === 0 && <View style={{ padding: 20 }}><T size={12} c={color.sub}>まだトレーニングの記録がありません</T></View>}
        {hist.map((h, i) => (
          <View key={i} style={{ padding: 14, gap: 4, borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexShrink: 1 }}>
                <N size={15}>{shortMd(h.date)}</N>
                <T size={14} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>{h.name}</T>
              </View>
              {h.best ? (
                <N size={13} c={h.best.pr ? color.brand : color.sub}>{h.best.pr ? '更新 ' : ''}{h.best.name} {h.best.e1rm}</N>
              ) : null}
            </View>
            <T size={12.5} c={color.badgeFg} numberOfLines={2}>{h.exercises.map((e) => `${e.name} ${e.sets.map((x) => `${x.kg}×${x.reps}`).join('・')}`).join(' / ') || '—'}</T>
          </View>
        ))}
      </View>
    );
  };

  return (
    <CoachFrame back={back}>
      <ScrollView contentContainerStyle={{ paddingTop: 6, paddingBottom: 12 }}>
        <View style={{ paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={row.studentName} size={48} invert />
          <View style={{ gap: 5, flexShrink: 1 }}>
            <T size={20} w={900} numberOfLines={1}>{row.studentName || '（名前なし）'}</T>
            {goalLabel ? (
              <View style={{ alignSelf: 'flex-start', backgroundColor: color.brandPale, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.badge }}>
                <T size={11.5} w={700} c={color.brandText}>{goalLabel}</T>
              </View>
            ) : null}
          </View>
        </View>
        {!paused && (
          <View style={{ marginHorizontal: 16, marginTop: 14, flexDirection: 'row', backgroundColor: color.track, borderRadius: 10, padding: 3 }}>
            {TABS.map((t) => (
              <Pressable key={t.v} accessibilityRole="tab" accessibilityState={{ selected: tab === t.v }} onPress={() => setTab(t.v)} style={{ flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === t.v ? color.surface : 'transparent' }}>
                <T size={13} w={tab === t.v ? 700 : 400}>{t.t}</T>
              </Pressable>
            ))}
          </View>
        )}
        {body()}
      </ScrollView>
      {/* 下に固定の2ボタン（高さ56） */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={() => setNote(true)} style={{ flex: 1, height: 56, borderRadius: 10, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
          <T size={15} w={700}>ひとこと</T>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: paused }}
          onPress={() => !paused && router.push({ pathname: '/goal/[id]', params: { id: row.userId } })}
          style={{ flex: 1, height: 56, borderRadius: 10, backgroundColor: paused ? color.lineStrong : lightPalette.text, alignItems: 'center', justifyContent: 'center' }}
        >
          <T size={15} w={700} c={lightPalette.onText}>目標を変える</T>
        </Pressable>
      </View>
      <View style={{ height: insets.bottom > 0 ? 0 : 0 }} />
      <NoteSheet open={note} onClose={() => setNote(false)} userId={row.userId} name={row.studentName || '生徒'} today={today} previous={row.lastNote && row.lastNote.week_start === ws ? row.lastNote.body : null} />
    </CoachFrame>
  );
}

function Hidden({ label }: { label: string }) {
  return (
    <View style={{ ...card, padding: 22, alignItems: 'center', gap: 6 }}>
      <T size={15} w={700} c={color.sub}>非公開</T>
      <T size={12} c={color.sub} style={{ textAlign: 'center', lineHeight: 19 }}>{label}は、生徒が共有していません。</T>
    </View>
  );
}
