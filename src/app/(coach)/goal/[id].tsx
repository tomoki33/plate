import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { N, Notice, Sheet, T, color, hairline, lightPalette, radius } from '@/design-system';
import { CoachFrame } from '../../../components/coach/Frames';
import * as api from '../../../features/coach/api';
import { PACE_STEPS, P_STEP, F_STEP, W_STEP, currentWeightOf, effectiveFromFor, goalFor, initialDraft, previewPlan, signedPace, withFat, withPace, withProtein, withTarget } from '../../../features/coach/plan';
import { useCoach } from '../../../store/coachStore';
import { useStore } from '../../../store/store';

/**
 * 目標を変える（1画面で完結）：目標体重・ペース・P・F・メニュー。C と kcal は自動。
 * 反映は翌日 0:00（生徒のタイムゾーン）から。その日の途中では目標を変えない。
 */
export default function GoalEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const row = useCoach((s) => s.students.find((x) => x.userId === id));
  const menus = useCoach((s) => s.menus);
  const refresh = useCoach((s) => s.refreshCoach);
  const showToast = useStore((s) => s.showToast);
  const s = row?.payload ?? null;
  const [draft, setDraft] = useState(() => initialDraft(s, row?.plan ?? null));
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cur = currentWeightOf(s);
  const goal = goalFor(cur, draft.targetWeight);
  const preview = useMemo(() => previewPlan(draft, s), [draft, s]);
  const back = { label: 'キャンセル', onPress: () => router.back() };
  if (!row) return <CoachFrame back={back}><View style={{ padding: 28 }}><T size={14} c={color.sub}>この生徒は見つかりませんでした。</T></View></CoachFrame>;

  const chosen = menus.filter((m) => draft.menuIds.includes(m.id));
  const tooLow = preview.weekKcal / 7 < 1200;
  const stepBtn = (label: string, onPress: () => void, size = 56, a11y?: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={{ width: size, height: size, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: size === 56 ? 10 : 8, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
      <T size={size === 56 ? 22 : 18}>{label}</T>
    </Pressable>
  );

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await api.setGoalPlan(row.userId, draft, chosen, effectiveFromFor(s));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    showToast(`${row.studentName || '生徒'}さんに送りました（明日から反映）`);
    void refresh();
    router.back();
  };

  const kcal = preview.day.kcal || 1;
  const macros = [
    { k: 'P', c: color.P, v: preview.day.P, w: (4 * preview.day.P) / kcal, r: `${preview.pPerKg}g/kg`, adj: [() => setDraft(withProtein(draft, draft.proteinG - P_STEP)), () => setDraft(withProtein(draft, draft.proteinG + P_STEP))] },
    { k: 'F', c: color.F, v: preview.day.F, w: (9 * preview.day.F) / kcal, r: `${draft.fatPct}%`, adj: [() => setDraft(withFat(draft, draft.fatPct - F_STEP)), () => setDraft(withFat(draft, draft.fatPct + F_STEP))] },
    { k: 'C', c: color.C, v: preview.day.C, w: (4 * preview.day.C) / kcal, r: '自動', adj: null },
  ] as const;

  return (
    <CoachFrame back={back}>
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        <T size={20} w={900} style={{ paddingHorizontal: 20, paddingTop: 6 }}>{row.studentName || '生徒'}の目標</T>
        <View style={{ margin: 16, marginBottom: 0, padding: 14, gap: 12, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12 }}>
          <T size={12} c={color.sub}>目標体重（いま {cur.toFixed(1)}kg）</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {stepBtn('−', () => setDraft(withTarget(draft, draft.targetWeight - W_STEP, cur)), 56, '目標体重を下げる')}
            <N size={44}>
              {draft.targetWeight.toFixed(1)}
              <T size={14} c={color.sub}> kg</T>
            </N>
            {stepBtn('＋', () => setDraft(withTarget(draft, draft.targetWeight + W_STEP, cur)), 56, '目標体重を上げる')}
          </View>
          {goal !== 'maintain' ? (
            <View style={{ flexDirection: 'row', backgroundColor: color.track, borderRadius: 8, padding: 3 }}>
              {PACE_STEPS.map((m) => {
                const on = Math.abs(Math.abs(draft.pace) - m) < 0.001;
                return (
                  <Pressable key={m} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setDraft(withPace(draft, goal, m))} style={{ flex: 1, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? color.surface : 'transparent' }}>
                    <N size={14} w={600}>{signedPace(goal, m) > 0 ? '+' : '−'}{m.toFixed(2)} kg/週</N>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <T size={12} c={color.sub}>目標体重が今の体重に近いので、維持として送ります。</T>
          )}
        </View>

        <View style={{ margin: 16, marginTop: 10, padding: 14, gap: 12, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <T size={12} c={color.sub}>1日の目安（トレーニングの日）</T>
            <N size={18}>{preview.day.kcal.toLocaleString()} kcal</N>
          </View>
          {macros.map((m) => (
            <View key={m.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={13} w={700} c={m.c} style={{ width: 20 }}>{m.k}</T>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: color.track, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, m.w * 100))}%`, backgroundColor: m.c }} />
                </View>
                <N size={16}>
                  {m.v}g<T size={12} c={color.sub}>　{m.r}</T>
                </N>
              </View>
              {m.adj ? (
                <>
                  {stepBtn('−', m.adj[0], 48, `${m.k}を減らす`)}
                  {stepBtn('＋', m.adj[1], 48, `${m.k}を増やす`)}
                </>
              ) : (
                <View style={{ width: 104 }} />
              )}
            </View>
          ))}
        </View>
        {tooLow ? <View style={{ marginHorizontal: 16 }}><Notice>1日の平均が 1,200kcal を下回ります。ペースをゆるめてください。</Notice></View> : null}

        <Pressable accessibilityRole="button" onPress={() => setPick(true)} style={{ marginHorizontal: 16, marginTop: 10, minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, gap: 12 }}>
          <T size={15}>トレーニングメニュー</T>
          <T size={13} c={color.sub} numberOfLines={1} style={{ flexShrink: 1 }}>{chosen.length ? chosen.map((m) => m.name).join('・') : menus.length ? '選ばない（今のまま）' : 'メニュー画面で作れます'} ›</T>
        </Pressable>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14, gap: 6 }}>
        {err ? <T size={12} c={color.brandText} style={{ textAlign: 'center' }}>{err}</T> : null}
        <T size={11.5} c={color.sub} style={{ textAlign: 'center' }}>明日から反映し、生徒に通知します</T>
        <Pressable accessibilityRole="button" onPress={save} disabled={busy} style={{ height: 60, borderRadius: 10, backgroundColor: busy ? color.lineStrong : lightPalette.text, alignItems: 'center', justifyContent: 'center' }}>
          <T size={16} w={700} c={lightPalette.onText}>{busy ? '送っています…' : '保存して送る'}</T>
        </Pressable>
      </View>

      <Sheet visible={pick} onClose={() => setPick(false)}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 4 }}>
          <T size={17} w={900}>メニューを選ぶ</T>
          <T size={12} c={color.sub}>選んだメニューが、生徒のメニューに「コーチ」バッジ付きで入ります。</T>
        </View>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8 }}>
          {menus.map((m) => {
            const on = draft.menuIds.includes(m.id);
            return (
              <Pressable key={m.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDraft({ ...draft, menuIds: on ? draft.menuIds.filter((x) => x !== m.id) : [...draft.menuIds, m.id] })} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: hairline, borderBottomColor: color.line }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15}>{m.name}</T>
                  <T size={11.5} c={color.sub} numberOfLines={1}>{m.exercises.map((e) => e.name).join('・')}</T>
                </View>
                <T size={16} w={700} style={{ width: 28, textAlign: 'center' }}>{on ? '✓' : ''}</T>
              </Pressable>
            );
          })}
          {!menus.length && <T size={13} c={color.sub} style={{ paddingVertical: 20 }}>まだメニューがありません。「メニュー」タブで作ってください。</T>}
        </ScrollView>
      </Sheet>
    </CoachFrame>
  );
}
