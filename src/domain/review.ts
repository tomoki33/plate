import { addDays, dateKey } from './dates';
import type { MealEntry, SessionRecord } from './models';
import { estimate1RM } from './training';
import type { Pfc } from './types';

/** 種目ごとの推定1RMの推移（1回のトレにつき、その日いちばん高い値） */
export interface E1rmPoint {
  date: string;
  e1rm: number;
}

export function e1rmSeries(sessions: SessionRecord[], exerciseId: string, sinceDate?: string): E1rmPoint[] {
  const byDate = new Map<string, number>();
  for (const s of sessions) {
    if (sinceDate && s.date < sinceDate) continue;
    const ex = s.exercises.find((e) => e.exerciseId === exerciseId);
    if (!ex) continue;
    const best = Math.max(0, ...ex.sets.filter((x) => x.done).map((x) => estimate1RM(x.kg, x.reps)));
    if (best > 0) byDate.set(s.date, Math.max(byDate.get(s.date) ?? 0, best));
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, e1rm]) => ({ date, e1rm }));
}

/** その週（月曜起点）の中で、種目の推定1RMの最大値 */
export function weekBestE1rm(sessions: SessionRecord[], exerciseId: string, monday: Date): number | null {
  const a = dateKey(monday);
  const b = dateKey(addDays(monday, 7));
  const pts = e1rmSeries(sessions, exerciseId).filter((p) => p.date >= a && p.date < b);
  return pts.length ? Math.max(...pts.map((p) => p.e1rm)) : null;
}

export interface WeekSummary {
  /** 食事を記録した日数 */
  loggedDays: number;
  /** 記録のある日の平均 */
  avg: Pfc;
  /** 記録のある日の合計kcal − その日の目標の合計 */
  kcalDiff: number;
}

/** 週の食事の集計。targetKcal は日ごとの目標（月〜日） */
export function summarizeWeek(meals: Pick<MealEntry, 'date' | 'kcal' | 'P' | 'F' | 'C'>[], monday: Date, targetKcal: number[]): WeekSummary {
  const days = Array.from({ length: 7 }, (_, i) => dateKey(addDays(monday, i)));
  const per = days.map((d) => meals.filter((m) => m.date === d));
  const logged = per.map((m, i) => ({ m, i })).filter((x) => x.m.length > 0);
  const tot = (k: keyof Pfc) => logged.reduce((a, x) => a + x.m.reduce((s, m) => s + m[k], 0), 0);
  const n = logged.length || 1;
  return {
    loggedDays: logged.length,
    avg: { kcal: tot('kcal') / n, P: tot('P') / n, F: tot('F') / n, C: tot('C') / n },
    kcalDiff: tot('kcal') - logged.reduce((a, x) => a + targetKcal[x.i], 0),
  };
}

/** 体重の7日移動平均（記録が3日未満の日は null） */
export function movingAverage(weights: Record<string, number>, days: Date[]): (number | null)[] {
  return days.map((d) => {
    const v: number[] = [];
    for (let i = 0; i < 7; i++) {
      const w = weights[dateKey(addDays(d, -i))];
      if (w !== undefined) v.push(w);
    }
    return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
}
