import { useMemo } from 'react';
import { computeTargets } from '../domain/engine';
import { addDays, dateKey, weekdayIndex, weekStart } from '../domain/dates';
import { TEMPLATES } from '../domain/training';
import type { DayTarget, DayType, Pfc } from '../domain/types';
import { useStore, type Meal } from './store';

export const DEFAULT_WEIGHT = 70;

export const sumMeals = (meals: Meal[]): Pfc =>
  meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, P: a.P + m.P, F: a.F + m.F, C: a.C + m.C }), { kcal: 0, P: 0, F: 0, C: 0 });

export const planTypeOf = (templateId: string | null): DayType => (templateId ? TEMPLATES[templateId].type : 'off');
export const planMenuOf = (templateId: string | null) => (templateId ? TEMPLATES[templateId].menu : 'オフ');

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

/** 今日タブなど、画面共通の派生値 */
export function useWeek(now: Date) {
  const settings = useStore((s) => s.settings);
  const weights = useStore((s) => s.weights);
  const todayTypes = useStore((s) => s.todayTypes);
  const meals = useStore((s) => s.meals);
  const workouts = useStore((s) => s.workouts);

  const todayKey = dateKey(now);
  return useMemo(() => {
    const ti = weekdayIndex(now);
    const monday = weekStart(now);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const planTypes = settings.plan.map(planTypeOf);
    const { kg, logged } = latestWeight(weights, todayKey);
    const input = { weekKcal: settings.weekKcal, coef: settings.coef, pk: settings.pk, weight: kg, todayIndex: ti, plan: planTypes };
    const override = todayTypes[todayKey] ?? null;
    const changedType = override && override !== planTypes[ti] ? override : null;
    const eng = computeTargets({ ...input, todayType: changedType });
    const plan = computeTargets({ ...input, todayType: null });
    const today: DayTarget = eng.days[ti];
    const todayMeals = meals.filter((m) => m.date === todayKey);
    const eaten = sumMeals(todayMeals);
    const remaining: Pfc = { kcal: today.kcal - eaten.kcal, P: today.P - eaten.P, F: today.F - eaten.F, C: today.C - eaten.C };
    const todayWorkout = workouts.filter((w) => w.date === todayKey).slice(-1)[0] ?? null;
    return { ti, dates, planTypes, eng, plan, today, todayKey, todayMeals, eaten, remaining, weight: kg, weightLogged: logged, changed: changedType !== null, todayWorkout, settings };
  }, [now, settings, weights, todayTypes, meals, workouts, todayKey]);
}
