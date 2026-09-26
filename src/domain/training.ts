import type { DayType } from './types';

export type Part = '脚' | '背中' | '胸' | '肩' | '腕' | '腹';
export const PART_COEF: Record<Part, number> = { 脚: 1.5, 背中: 1.2, 胸: 1.0, 肩: 1.0, 腕: 0.6, 腹: 0.6 };

export interface ExerciseDef {
  name: string;
  part: Part;
  kg: number;
  reps: number;
}

export interface Template {
  id: string;
  name: string;
  menu: string;
  type: DayType;
  meta: string;
  exercises: ExerciseDef[];
}

export const TEMPLATES: Record<string, Template> = {
  legs: {
    id: 'legs',
    name: '脚の日',
    menu: '脚の日',
    type: 'high',
    meta: 'スクワット・ブルガリアン・レッグカール',
    exercises: [
      { name: 'スクワット', part: '脚', kg: 120, reps: 5 },
      { name: 'ブルガリアンスクワット', part: '脚', kg: 20, reps: 10 },
      { name: 'レッグカール', part: '脚', kg: 40, reps: 12 },
      { name: 'カーフレイズ', part: '脚', kg: 60, reps: 15 },
    ],
  },
  chest: {
    id: 'chest',
    name: '胸・肩',
    menu: '胸・肩',
    type: 'normal',
    meta: 'ベンチ・インクライン・ショルダー',
    exercises: [
      { name: 'ベンチプレス', part: '胸', kg: 95, reps: 6 },
      { name: 'インクラインDBプレス', part: '胸', kg: 30, reps: 10 },
      { name: 'ショルダープレス', part: '肩', kg: 25, reps: 10 },
    ],
  },
  back: {
    id: 'back',
    name: '背中',
    menu: '背中',
    type: 'normal',
    meta: 'デッドリフト・懸垂・ロウ',
    exercises: [
      { name: 'デッドリフト', part: '背中', kg: 160, reps: 5 },
      { name: '懸垂', part: '背中', kg: 0, reps: 8 },
      { name: 'ベントオーバーロウ', part: '背中', kg: 80, reps: 8 },
    ],
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);
export const DEFAULT_MEDIAN_VOLUME = 11;
export const HIGH_RATIO = 1.3;

/** 推定1RM（Epley式） */
export const estimate1RM = (kg: number, reps: number) => kg * (1 + reps / 30);

export interface SetLog {
  kg: number;
  reps: number;
  done: boolean;
}
export interface ExerciseLog {
  name: string;
  part: Part;
  prevKg: number;
  prevReps: number;
  sets: SetLog[];
}

/** ボリュームスコア = 完了セットごとの部位係数の合計 */
export function volumeScore(exercises: ExerciseLog[]): number {
  let v = 0;
  for (const ex of exercises) for (const s of ex.sets) if (s.done) v += PART_COEF[ex.part] ?? 1;
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
export function decideDayType(template: Template, volume: number, medianVolume: number): DayType {
  return template.type === 'high' || volume >= medianVolume * HIGH_RATIO ? 'high' : 'normal';
}
