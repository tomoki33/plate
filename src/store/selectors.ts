import { useMemo } from 'react';
import { computeTargets } from '../domain/engine';
import { addDays, dateKey, weekdayIndex, weekStart } from '../domain/dates';
import { featuresOf, planOf, trialDaysLeft, type Features, type Plan } from '../domain/entitlement';
import type { MealEntry, SessionRecord, WorkoutTemplate } from '../domain/models';
import { weekKcalOf } from '../domain/nutrition';
import type { DayTarget, DayType, Pfc } from '../domain/types';
import { useStore } from './store';

export const DEFAULT_WEIGHT = 70;

export const sumMeals = (meals: Pick<MealEntry, 'kcal' | 'P' | 'F' | 'C'>[]): Pfc =>
  meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, P: a.P + m.P, F: a.F + m.F, C: a.C + m.C }), { kcal: 0, P: 0, F: 0, C: 0 });

export interface MealGroup {
  groupId: string;
  name: string;
  slot: MealEntry['slot'];
  ai: boolean;
  kcal: number;
  createdAt: number;
  items: MealEntry[];
}

/** 同じ操作で追加した行（マイセット・AI入力）を1行にまとめる */
export function groupMeals(meals: MealEntry[]): MealGroup[] {
  const map = new Map<string, MealGroup>();
  for (const m of meals) {
    const g = map.get(m.groupId);
    if (g) {
      g.items.push(m);
      g.kcal += m.kcal;
      g.ai = g.ai || m.ai;
    } else map.set(m.groupId, { groupId: m.groupId, name: m.groupName, slot: m.slot, ai: m.ai, kcal: m.kcal, createdAt: m.createdAt, items: [m] });
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
}

/** 直近の体重（今日以前）。なければ既定値 */
export function latestWeight(weights: Record<string, number>, today: string): { kg: number; logged: boolean } {
  const keys = Object.keys(weights).filter((k) => k <= today).sort();
  if (!keys.length) return { kg: DEFAULT_WEIGHT, logged: false };
  return { kg: weights[keys[keys.length - 1]], logged: keys[keys.length - 1] === today };
}

export function weightAverage7(weights: Record<string, number>, today: Date): number | null {
  const vals: number[] = [];
  for (let i = 0; i < 7; i++) {
    const w = weights[dateKey(addDays(today, -i))];
    if (w !== undefined) vals.push(w);
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** 無料／有料（体験中は有料と同じ） */
export function usePlan(now: Date): { plan: Plan; features: Features; trialLeft: number } {
  const trialStartedAt = useStore((s) => s.trialStartedAt);
  const paid = useStore((s) => s.paid);
  return useMemo(() => {
    const plan = planOf(now.getTime(), trialStartedAt, paid);
    return { plan, features: featuresOf(plan), trialLeft: trialDaysLeft(now.getTime(), trialStartedAt) };
  }, [now, trialStartedAt, paid]);
}

export const templateName = (templates: WorkoutTemplate[], id: string | null) => (id ? (templates.find((t) => t.id === id)?.name ?? '—') : 'オフ');
export const templateType = (templates: WorkoutTemplate[], id: string | null): DayType => (id ? (templates.find((t) => t.id === id)?.defaultDayType ?? 'normal') : 'off');

/** 今日タブなど、画面共通の派生値 */
export function useWeek(now: Date) {
  const profile = useStore((s) => s.profile);
  const weekPlan = useStore((s) => s.weekPlan);
  const templates = useStore((s) => s.templates);
  const weights = useStore((s) => s.weights);
  const dayTypes = useStore((s) => s.dayTypes);
  const meals = useStore((s) => s.meals);
  const sessions = useStore((s) => s.sessions);
  const { plan: entitlement, features } = usePlan(now);

  const todayKey = dateKey(now);
  return useMemo(() => {
    const ti = weekdayIndex(now);
    const monday = weekStart(now);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const planTypes = weekPlan.map((id) => templateType(templates, id));
    const { kg, logged } = latestWeight(weights, todayKey);
    const weekKcal = weekKcalOf(profile.tdee, profile.pace);

    // 今日より前の日に食べた実績（記録がない日は null）
    const actuals = dates.slice(0, ti).map((d) => {
      const k = dateKey(d);
      const day = meals.filter((m) => m.date === k);
      return day.length ? sumMeals(day).kcal : null;
    });

    const override = dayTypes[todayKey] ?? null;
    const changedType = features.linkedTargets && override && override !== planTypes[ti] ? override : null;
    const input = { weekKcal, coef: profile.coef, pk: profile.pk, weight: kg, todayIndex: ti, plan: planTypes, actuals, linked: features.linkedTargets };
    const eng = computeTargets({ ...input, todayType: changedType });
    const planned = computeTargets({ ...input, actuals: [], todayType: null });
    const today: DayTarget = eng.days[ti];
    const todayMeals = meals.filter((m) => m.date === todayKey);
    const eaten = sumMeals(todayMeals);
    const remaining: Pfc = { kcal: today.kcal - eaten.kcal, P: today.P - eaten.P, F: today.F - eaten.F, C: today.C - eaten.C };
    const todayWorkout: SessionRecord | null = sessions.filter((w) => w.date === todayKey).slice(-1)[0] ?? null;
    const todayTemplateId = weekPlan[ti];
    return { ti, dates, planTypes, eng, plan: planned, today, todayKey, todayMeals, eaten, remaining, weight: kg, weightLogged: logged, changed: changedType !== null, todayWorkout, todayTemplateId, weekKcal, profile, weekPlan, templates, entitlement, features };
  }, [now, profile, weekPlan, templates, weights, dayTypes, meals, sessions, todayKey, entitlement, features]);
}
