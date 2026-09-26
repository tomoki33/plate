import type { ExerciseLog } from './models';
import type { DayType } from './types';

export type Part = '脚' | '背中' | '胸' | '肩' | '腕' | '腹';
export const PART_COEF: Record<Part, number> = { 脚: 1.5, 背中: 1.2, 胸: 1.0, 肩: 1.0, 腕: 0.6, 腹: 0.6 };

export const DEFAULT_MEDIAN_VOLUME = 11;
export const HIGH_RATIO = 1.3;

/** 推定1RM（Epley式） */
export const estimate1RM = (kg: number, reps: number) => kg * (1 + reps / 30);


/** ボリュームスコア = 完了セットごとの部位係数の合計 */
export function volumeScore(exercises: ExerciseLog[]): number {
  let v = 0;
  for (const ex of exercises) for (const s of ex.sets) if (s.done) v += ex.coef ?? PART_COEF[ex.part] ?? 1;
  return v;
}

export function bestSet(exercises: ExerciseLog[]): { name: string; e1rm: number } | null {
  let best: { name: string; e1rm: number } | null = null;
  for (const ex of exercises)
    for (const s of ex.sets)
      if (s.done) {
        const e = estimate1RM(s.kg, s.reps);
        if (!best || e > best.e1rm) best = { name: ex.name, e1rm: e };
      }
  return best;
}

export function median(xs: number[]): number {
  if (!xs.length) return DEFAULT_MEDIAN_VOLUME;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** テンプレートの既定値。ただしボリュームが本人の中央値の1.3倍以上なら「高」 */
export function decideDayType(defaultDayType: DayType, volume: number, medianVolume: number): DayType {
  return defaultDayType === 'high' || volume >= medianVolume * HIGH_RATIO ? 'high' : 'normal';
}
