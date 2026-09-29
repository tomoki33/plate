/**
 * 生徒側の同期：コーチから届いたものを取り込み、共有するスナップショットを送る。
 * 起動時・復帰時・記録が変わったときに動く。通信できなくても、アプリは止めない。
 */
import type { WorkoutTemplate } from '../../domain/models';
import { weekKcalOf } from '../../domain/nutrition';
import type { Part } from '../../domain/training';
import { weightForProtein } from '../../domain/weight';
import { useCoach, withCoachApply, type Managed } from '../../store/coachStore';
import { templateType } from '../../store/selectors';
import { useStore } from '../../store/store';
import * as api from './api';
import { todayIn } from './dateKeys';
import { activePlan, profilePatchFromPlan } from './plan';
import { buildSnapshot } from './snapshot';
import type { PlanRow } from './types';

export const deviceTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo';
  } catch {
    return 'Asia/Tokyo';
  }
};

export const COACH_TEMPLATE_PREFIX = 'coach_';
export const isCoachTemplate = (id: string | null | undefined) => !!id && id.startsWith(COACH_TEMPLATE_PREFIX);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** コーチの目標プランを、この端末の設定に反映する（目標・ペース・P・メニュー・週の予定） */
export function applyPlanToDevice(plan: PlanRow, coachName: string, now: Date = new Date()): void {
  withCoachApply(() => applyPlanInner(plan, coachName, now));
}

function applyPlanInner(plan: PlanRow, coachName: string, now: Date): void {
  const st = useStore.getState();
  const kg = weightForProtein(st.weights, now) ?? 65;
  const patch = profilePatchFromPlan(plan, kg);
  st.patchProfile({ ...patch, pk: Math.round(clamp(plan.protein_g / kg, 1, 4) * 10) / 10 });

  // メニュー：コピーを作って、テンプレートに入れる（コーチ側で直しても、送った分は変わらない）
  const oldIds = useCoach.getState().managed?.templateIds ?? [];
  const newIds: string[] = [];
  for (const [i, menu] of plan.menus.entries()) {
    const id = `${COACH_TEMPLATE_PREFIX}${menu.id}`;
    const exercises = menu.exercises.map((e) => {
      const cur = useStore.getState().exercises;
      const found = cur.find((x) => x.id === e.exerciseId) ?? cur.find((x) => x.name === e.name);
      const exerciseId = found?.id ?? useStore.getState().addCustomExercise(e.name, (e.part as Part) || '胸');
      return { exerciseId, sets: e.sets, kg: e.kg, reps: e.reps };
    });
    const t: WorkoutTemplate = { id, name: menu.name, defaultDayType: menu.defaultDayType, exercises, sortOrder: 100 + i };
    useStore.getState().saveTemplate(t);
    newIds.push(id);
  }
  // 送られなくなったメニューは外す
  for (const id of oldIds) if (!newIds.includes(id)) useStore.getState().deleteTemplate(id);

  // 週の予定：これまでトレーニングしていた曜日（なければ 月・水・金）に、メニューを順に割り当てる
  if (newIds.length) {
    const plan0 = useStore.getState().weekPlan;
    let days = plan0.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
    if (!days.length) days = [0, 2, 4];
    days.forEach((d, k) => useStore.getState().setWeekPlan(d, newIds[k % newIds.length]));
  }

  const managed: Managed = {
    planId: plan.id,
    coachName,
    proteinG: plan.protein_g,
    fatPct: plan.fat_pct,
    targetWeight: Number(plan.target_weight),
    pace: patch.pace,
    appliedAt: now.getTime(),
    effectiveFrom: plan.effective_from,
    templateIds: newIds,
  };
  useCoach.getState().setManaged(managed);
}

let lastPublishAt = 0;
/** 共有するスナップショットを送る（つながっていて、共有中のときだけ） */
export async function publishNow(force = false): Promise<void> {
  const co = useCoach.getState();
  const st = useStore.getState();
  if (!st.account || !co.link || co.link.status !== 'active') return;
  if (!force && Date.now() - lastPublishAt < 20_000) return;
  lastPublishAt = Date.now();
  const now = new Date();
  const managed = co.managed && co.link.managesGoals ? { proteinG: co.managed.proteinG, fatPct: co.managed.fatPct } : null;
  const snap = buildSnapshot({
    now,
    tz: deviceTz(),
    share: co.link.share,
    profile: { goal: st.profile.goal, goalWeightKg: st.profile.goalWeightKg, pace: st.profile.pace, tdee: st.profile.tdee, coef: st.profile.coef, pk: st.profile.pk },
    managed,
    weekTypes: st.weekPlan.map((id) => templateType(st.templates, id)),
    plannedPerWeek: st.weekPlan.filter(Boolean).length,
    weekKcal: weekKcalOf(st.profile.tdee, st.profile.pace) + st.profile.weekAdjustKcal,
    weights: st.weights,
    meals: st.meals,
    sessions: st.sessions,
    targets: Object.fromEntries(Object.entries(st.lastTargets).map(([d, t]) => [d, { dayType: t.dayType, kcal: t.kcal }])),
    weightKg: weightForProtein(st.weights, now),
  });
  await api.publishSnapshot(st.account.userId, snap);
}

/** コーチから届いたものを取り込み、共有を送る。起動時と復帰時に呼ぶ */
export async function syncStudent(): Promise<void> {
  const st = useStore.getState();
  if (!st.account) return;
  const r = await api.fetchInbox();
  if (!r.ok) return;
  const co = useCoach.getState();
  co.applyInbox(r.data);
  const link = r.data.link;
  if (link && link.managesGoals && link.status === 'active') {
    const today = todayIn(deviceTz());
    const plan = activePlan(r.data.plans, today);
    if (plan && plan.id !== useCoach.getState().managed?.planId) applyPlanToDevice(plan, link.coachName);
  } else if (useCoach.getState().managed) {
    // 「ひとりで」に戻した・共有をやめた：最後の目標をそのまま自分のものとして引き継ぐ
    useCoach.getState().setManaged(null);
  }
  if (link?.status === 'active') await publishNow(true);
}

/** 生徒が招待を受ける／設定を変えたあとの反映 */
export async function afterLinkChange(): Promise<void> {
  await syncStudent();
}
