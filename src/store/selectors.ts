import { useMemo } from 'react';
import { computeTargets } from '../domain/engine';
import { addDays, dateKey, weekdayIndex, weekStart } from '../domain/dates';
import { featuresOf, planOf, trialDaysLeft, TRIAL_DAYS, type Features, type Plan } from '../domain/entitlement';
import type { MealEntry, SessionRecord, WorkoutTemplate } from '../domain/models';
import { ageOf, bmr, weekKcalOf } from '../domain/nutrition';
import { avg7, etaLabel, etaTo, paceKgPerWeek, signed1, suggestPace, weekDiff, weightForProtein, type PaceSuggestion } from '../domain/weight';
import type { DayTarget, DayType, Pfc } from '../domain/types';
import { FREE_LAUNCH } from '../lib/flags';
import { useEngineOverrides } from './coachStore';
import { useStore } from './store';

export const DEFAULT_WEIGHT = 70;

export const sumMeals = (meals: Pick<MealEntry, 'kcal' | 'P' | 'F' | 'C'>[]): Pfc =>
  meals.reduce((a, m) => ({ kcal: a.kcal + m.kcal, P: a.P + m.P, F: a.F + m.F, C: a.C + m.C }), { kcal: 0, P: 0, F: 0, C: 0 });

export interface MealGroup {
  groupId: string;
  name: string;
  slot: MealEntry['slot'];
  ai: boolean;
  /** 写真で記録した食事の写真（あれば） */
  photoUri: string | null;
  /** 「ざっくり」で入れた食事（目安なので、kcal は「約600」のように出す） */
  rough: boolean;
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
    } else map.set(m.groupId, { groupId: m.groupId, name: m.groupName, slot: m.slot, ai: m.ai, photoUri: m.photoUri, rough: m.inputType === 'rough', kcal: m.kcal, createdAt: m.createdAt, items: [m] });
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

/** 体験中／購入済み／見るだけ */
export function usePlan(now: Date): { plan: Plan; features: Features; trialLeft: number } {
  const trialStartedAt = useStore((s) => s.trialStartedAt);
  const paid = useStore((s) => s.paid);
  const aiPlus = useStore((s) => s.aiPlus);
  return useMemo(() => {
    const plan = planOf(now.getTime(), trialStartedAt, paid);
    return { plan, features: featuresOf(plan, aiPlus, FREE_LAUNCH), trialLeft: trialDaysLeft(now.getTime(), trialStartedAt) };
  }, [now, trialStartedAt, paid, aiPlus]);
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
  const overrides = useEngineOverrides();

  const todayKey = dateKey(now);
  return useMemo(() => {
    const ti = weekdayIndex(now);
    const monday = weekStart(now);
    const dates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const planTypes = weekPlan.map((id) => templateType(templates, id));
    // Pの計算に使う体重は、1日の値ではなく7日平均
    const { kg: latestKg, logged } = latestWeight(weights, todayKey);
    const kg = weightForProtein(weights, now) ?? latestKg;
    const weekKcal = weekKcalOf(profile.tdee, profile.pace) + profile.weekAdjustKcal;

    // 今日より前の日に食べた実績（記録がない日は null）
    const actuals = dates.slice(0, ti).map((d) => {
      const k = dateKey(d);
      const day = meals.filter((m) => m.date === k);
      return day.length ? sumMeals(day).kcal : null;
    });

    const override = dayTypes[todayKey] ?? null;
    const changedType = override && override !== planTypes[ti] ? override : null;
    const input = { weekKcal, coef: profile.coef, pk: profile.pk, weight: kg, todayIndex: ti, plan: planTypes, actuals, linked: true, ...overrides };
    const eng = computeTargets({ ...input, todayType: changedType });
    const planned = computeTargets({ ...input, actuals: [], todayType: null });
    const today: DayTarget = eng.days[ti];
    const todayMeals = meals.filter((m) => m.date === todayKey);
    const eaten = sumMeals(todayMeals);
    const remaining: Pfc = { kcal: today.kcal - eaten.kcal, P: today.P - eaten.P, F: today.F - eaten.F, C: today.C - eaten.C };
    const todayWorkout: SessionRecord | null = sessions.filter((w) => w.date === todayKey).slice(-1)[0] ?? null;
    const todayTemplateId = weekPlan[ti];
    return { ti, dates, planTypes, eng, plan: planned, today, todayKey, todayMeals, eaten, remaining, weight: kg, latestWeight: latestKg, weightLogged: logged, changed: changedType !== null, todayWorkout, todayTemplateId, weekKcal, profile, weekPlan, templates, entitlement, features };
  }, [now, profile, weekPlan, templates, weights, dayTypes, meals, sessions, todayKey, entitlement, features, overrides]);
}

export interface WeightStats {
  /** 今日の7日平均 */
  avg: number | null;
  /** 先週との差（7日平均） */
  weekDiff: number | null;
  /** 直近2週のペース（kg/週） */
  pace: number | null;
  planned: number;
  goal: number | null;
  /** 目標まで（kg）。届いていれば 0 */
  left: number | null;
  etaActual: string | null;
  etaPlanned: string | null;
  /** ペースの見直しの提案（出す条件を満たし、今週まだ答えていないときだけ） */
  suggestion: PaceSuggestion | null;
  /** 今週の月曜（ペースの見直しの答えを、週ごとに覚えるためのキー） */
  weekKey: string;
  /** 文字の表示：「直近2週 −0.2kg/週（予定 −0.5）」 */
  paceLine: string | null;
}

/** 体重の7日平均・ペース・到達予測・ペースの見直し（レビューと体重の詳細で使う） */
export function useWeightStats(now: Date): WeightStats {
  const weights = useStore((s) => s.weights);
  const profile = useStore((s) => s.profile);
  const paceAnswers = useStore((s) => s.paceAnswers);
  const meals = useStore((s) => s.meals);
  return useMemo(() => {
    const avg = avg7(weights, now);
    const pace = paceKgPerWeek(weights, now);
    const previousPace = paceKgPerWeek(weights, addDays(now, -7));
    const planned = profile.pace;
    const goal = profile.goalWeightKg;
    const dir = profile.goal === 'bulk' ? 'up' : 'down';
    const weekKey = dateKey(weekStart(now));
    // 直近14日のうち、食事を記録した日数（記録が足りない週は、提案しない）
    const mealDates = new Set(meals.map((m) => m.date));
    let loggedDays = 0;
    let intakeSum = 0;
    for (let i = 0; i < 14; i++) {
      const key = dateKey(addDays(now, -i));
      if (mealDates.has(key)) {
        loggedDays++;
        intakeSum += meals.filter((m) => m.date === key).reduce((a, m) => a + m.kcal, 0);
      }
    }
    // 減量で週の合計を下げられる余地（基礎代謝×7日を下回らない範囲）
    const floor = 7 * Math.max(1200, bmr(profile, avg ?? 70, ageOf(profile.birthYear, now)));
    const weekTotal = weekKcalOf(profile.tdee, profile.pace) + profile.weekAdjustKcal;
    const room = weekTotal - floor;
    // 計画どおり食べていたか（記録した日の平均摂取 ÷ 1日の目標）
    const intakeRatio = loggedDays > 0 ? intakeSum / loggedDays / (weekTotal / 7) : undefined;
    // 目標・維持カロリーを最後に動かしてからの日数（維持カロリーの補正日、または見直しを受け入れた週）
    const adjustDates = [profile.tdeeWeek, ...Object.entries(paceAnswers).filter(([, a]) => a === 'accepted').map(([w]) => w)].filter((x): x is string => !!x);
    const last = adjustDates.sort().slice(-1)[0];
    const daysSinceAdjust = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000) : null;
    const eta = (p: number) => (avg !== null && goal !== null ? etaLabel(etaTo(avg, goal, p, now, dir)) : null);
    return {
      avg,
      weekDiff: weekDiff(weights, now),
      pace,
      planned,
      goal,
      left: avg !== null && goal !== null ? Math.max(0, dir === 'down' ? avg - goal : goal - avg) : null,
      etaActual: pace !== null ? eta(pace) : null,
      etaPlanned: eta(planned),
      suggestion: suggestPace({ planned, actual: pace, answeredThisWeek: paceAnswers[weekKey] !== undefined, loggedDays, room, intakeRatio, previous: previousPace, daysSinceAdjust }),
      weekKey,
      paceLine: pace !== null ? `直近2週 ${signed1(pace)}kg/週（予定 ${signed1(planned)}）` : null,
    };
  }, [weights, profile, paceAnswers, meals, now]);
}

export interface TrialSummary {
  /** 記録した日／体験の日数（19c「記録した日 ○/28」） */
  loggedDays: number;
  totalDays: number;
  /** 体重の7日平均の変化（kg）。記録が足りなければ null */
  weightChange: number | null;
  /** 主な種目（体験中もっとも多く記録した種目）の重さの伸び */
  topLift: { name: string; deltaKg: number } | null;
}

/** 体験の4週間の成果（19c：無料体験が終わった日） */
export function useTrialSummary(now: Date): TrialSummary {
  const trialStartedAt = useStore((s) => s.trialStartedAt);
  const meals = useStore((s) => s.meals);
  const weights = useStore((s) => s.weights);
  const sessions = useStore((s) => s.sessions);
  return useMemo(() => {
    const started = trialStartedAt ?? now.getTime() - TRIAL_DAYS * 86400000;
    const days = Math.min(TRIAL_DAYS, Math.max(1, Math.round((now.getTime() - started) / 86400000)));
    const mealDates = new Set(meals.map((m) => m.date));
    let loggedDays = 0;
    for (let i = 0; i < days; i++) if (mealDates.has(dateKey(addDays(now, -i)))) loggedDays++;

    const avgNow = avg7(weights, now);
    const avgStart = avg7(weights, addDays(now, -days));
    const weightChange = avgNow !== null && avgStart !== null ? Math.round((avgNow - avgStart) * 10) / 10 : null;

    const cutoff = dateKey(addDays(now, -days));
    const recent = [...sessions].filter((s) => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
    const byExercise = new Map<string, { name: string; weights: number[] }>();
    for (const s of recent) {
      for (const e of s.exercises) {
        const top = Math.max(0, ...e.sets.filter((x) => x.done).map((x) => x.kg));
        if (top <= 0) continue;
        const cur = byExercise.get(e.exerciseId) ?? { name: e.name, weights: [] };
        cur.weights.push(top);
        byExercise.set(e.exerciseId, cur);
      }
    }
    let topLift: TrialSummary['topLift'] = null;
    let bestCount = 1; // 2回以上の記録があるものだけ「伸び」を出す
    for (const v of byExercise.values()) {
      if (v.weights.length <= bestCount) continue;
      bestCount = v.weights.length;
      topLift = { name: v.name, deltaKg: Math.round((v.weights[v.weights.length - 1] - v.weights[0]) * 10) / 10 };
    }
    return { loggedDays, totalDays: days, weightChange, topLift };
  }, [now, trialStartedAt, meals, weights, sessions]);
}
