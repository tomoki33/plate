/**
 * コーチが生徒に送る目標プランの計算（純粋関数）。
 * 生徒側のアプリと同じ目標エンジンで kcal を出すので、コーチが見る数字と生徒に出る数字が一致する。
 */
import { computeTargets } from '../../domain/engine';
import { defaultPk, weekKcalOf, type Goal } from '../../domain/nutrition';
import type { DayTarget, DayType } from '../../domain/types';
import { addKey, todayIn } from './dateKeys';
import type { PlanRow, Snapshot } from './types';

export const PACE_STEPS = [0.25, 0.5, 0.75] as const;
export const P_STEP = 5;
export const F_STEP = 5;
export const F_MIN = 10;
export const F_MAX = 40;
export const W_STEP = 0.5;
export const DEFAULT_WEEK_TYPES: DayType[] = ['high', 'normal', 'off', 'high', 'normal', 'off', 'off'];

export interface PlanDraft {
  targetWeight: number;
  /** kg/週（減量はマイナス、維持は 0） */
  pace: number;
  proteinG: number;
  fatPct: number;
  /** 送るメニュー（コーチのメニューの id） */
  menuIds: string[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (n: number) => Math.round(n * 10) / 10;
const roundTo = (v: number, step: number) => Math.round(v / step) * step;

/** 体重と目標体重から目的を決める（±0.5kg 以内は維持） */
export function goalFor(currentKg: number, targetKg: number): Goal {
  if (targetKg < currentKg - 0.5) return 'cut';
  if (targetKg > currentKg + 0.5) return 'bulk';
  return 'maintain';
}
/** 0.25／0.5／0.75 kg/週 を、目的に合わせて符号つきにする。維持は 0 */
export const signedPace = (goal: Goal, magnitude: number) => (goal === 'maintain' ? 0 : goal === 'cut' ? -Math.abs(magnitude) : Math.abs(magnitude));

export function currentWeightOf(s: Snapshot | null): number {
  const e = s?.weight?.entries ?? [];
  if (!e.length) return s?.profile.goalWeightKg ?? 65;
  const last = [...e].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
  return round1(last.reduce((a, x) => a + x.kg, 0) / last.length);
}

/** 目標編集の初期値：いま送っているプラン → なければ生徒自身の設定 */
export function initialDraft(s: Snapshot | null, plan: PlanRow | null): PlanDraft {
  if (plan) return { targetWeight: Number(plan.target_weight), pace: Number(plan.pace_per_week), proteinG: plan.protein_g, fatPct: plan.fat_pct, menuIds: plan.menus.map((m) => m.id) };
  const w = currentWeightOf(s);
  const goal = s?.profile.goal ?? 'maintain';
  const target = s?.profile.goalWeightKg ?? w;
  return {
    targetWeight: target,
    pace: s?.profile.pace ?? 0,
    proteinG: s?.profile.proteinG || Math.round(w * defaultPk(goal) / P_STEP) * P_STEP,
    fatPct: s?.profile.fatPct ?? 25,
    menuIds: [],
  };
}

/** 目標体重を動かしたとき、ペースの符号（目的）を合わせ直す */
export function withTarget(d: PlanDraft, targetWeight: number, currentKg: number): PlanDraft {
  const t = clamp(roundTo(targetWeight, W_STEP), 30, 200);
  const goal = goalFor(currentKg, t);
  const mag = Math.abs(d.pace) || 0.5;
  return { ...d, targetWeight: t, pace: signedPace(goal, mag) };
}
export const withPace = (d: PlanDraft, goal: Goal, magnitude: number): PlanDraft => ({ ...d, pace: signedPace(goal, magnitude) });
export const withProtein = (d: PlanDraft, g: number): PlanDraft => ({ ...d, proteinG: clamp(Math.round(g / P_STEP) * P_STEP, 40, 400) });
export const withFat = (d: PlanDraft, pct: number): PlanDraft => ({ ...d, fatPct: clamp(Math.round(pct / F_STEP) * F_STEP, F_MIN, F_MAX) });

export interface PlanPreview {
  weekKcal: number;
  /** トレーニングの日（高い日があればその日、なければ通常の日）の1日の目安 */
  day: DayTarget;
  /** P の g/kg */
  pPerKg: number;
  /** C は残りのkcal÷4で自動 */
}

export function previewPlan(d: PlanDraft, s: Snapshot | null): PlanPreview {
  const weight = currentWeightOf(s);
  const tdee = s?.profile.tdee ?? 2400;
  const coef = s?.profile.coef ?? { high: 1.15, normal: 1, off: 0.85 };
  const types = s?.profile.weekTypes?.length === 7 ? s.profile.weekTypes : DEFAULT_WEEK_TYPES;
  const weekKcal = weekKcalOf(tdee, d.pace);
  const res = computeTargets({ weekKcal, coef, pk: d.proteinG / weight, weight, todayIndex: 0, plan: types, todayType: null, linked: true, fixedP: d.proteinG, fatPct: d.fatPct });
  const idx = types.indexOf('high') >= 0 ? types.indexOf('high') : types.indexOf('normal') >= 0 ? types.indexOf('normal') : 0;
  return { weekKcal, day: res.orig[idx], pPerKg: Math.round((d.proteinG / weight) * 10) / 10 };
}

/** 反映は「翌日 0:00（生徒のタイムゾーン）」から。その日の途中では目標を変えない */
export function effectiveFromFor(s: Snapshot | null, now: Date = new Date()): string {
  return addKey(todayIn(s?.tz || 'Asia/Tokyo', now), 1);
}

/** 生徒側：サーバーの目標プランのうち、いま（生徒の今日）から有効なもの。effective_from が新しい順の先頭 */
export function activePlan(plans: PlanRow[], todayKey: string): PlanRow | null {
  return [...plans].filter((p) => p.effective_from <= todayKey).sort((a, b) => b.effective_from.localeCompare(a.effective_from) || b.created_at.localeCompare(a.created_at))[0] ?? null;
}
/** これから反映される予定のプラン（今日画面の「コーチが目標を更新しました」の対象にはしない） */
export const upcomingPlan = (plans: PlanRow[], todayKey: string): PlanRow | null =>
  [...plans].filter((p) => p.effective_from > todayKey).sort((a, b) => a.effective_from.localeCompare(b.effective_from))[0] ?? null;

/** 生徒の設定に反映する値（プラン → プロフィールの項目） */
export function profilePatchFromPlan(plan: Pick<PlanRow, 'target_weight' | 'pace_per_week'>, currentKg: number): { goal: Goal; pace: number; goalWeightKg: number } {
  const target = Number(plan.target_weight);
  const goal = goalFor(currentKg, target);
  return { goal, pace: signedPace(goal, Math.abs(Number(plan.pace_per_week))), goalWeightKg: target };
}
