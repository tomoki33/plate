import type { Goal, Profile, Sex } from './nutrition';
import type { Part } from './training';
import type { Coef, DayType, Pfc } from './types';

export interface Exercise {
  id: string;
  name: string;
  part: Part;
  /** 部位係数（ボリュームスコアに使う） */
  coef: number;
  isCustom: boolean;
  /** 検索用の別名（BSS・RDL・OHP など。空白区切り） */
  aliases: string;
}

export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  kg: number;
  reps: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  defaultDayType: DayType;
  exercises: TemplateExercise[];
  sortOrder: number;
}

/** 食品（100gあたり）。成分表・マイ食品 */
export interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  p: number;
  f: number;
  c: number;
  source: '成分表' | 'カタログ' | '自作' | 'AI';
  code?: string | null;
  unitG?: number | null;
  defaultG?: number | null;
}

export interface MealSet {
  id: string;
  name: string;
  items: { foodId: string; g: number }[];
  useCount: number;
  lastUsedAt: number | null;
  slotHint: string | null;
}

export type Slot = '朝' | '昼' | '間食' | '夜';
export type InputType = 'set' | 'search' | 'text' | 'photo' | 'rough';

/** 記録時の値をコピーして持つ（食品データを後で直しても過去の記録は変わらない） */
export interface MealEntry extends Pfc {
  id: string;
  date: string;
  slot: Slot;
  foodId: string | null;
  groupId: string;
  groupName: string;
  name: string;
  grams: number | null;
  ai: boolean;
  /** 写真で記録した食事の写真（アプリ内のファイル）。なければ null */
  photoUri: string | null;
  inputType: InputType;
  createdAt: number;
}

export interface SetLog {
  kg: number;
  reps: number;
  done: boolean;
  rir?: number | null;
}

export interface ExerciseLog {
  exerciseId: string;
  name: string;
  part: Part;
  coef: number;
  prevKg: number;
  prevReps: number;
  /** 前回のセットごとの回数（「前回 120 × 5・5・5」の表示用） */
  prevRepsList?: number[];
  /** 「+2.5kg」：前回、すべてのセットで目標の回数ができた種目 */
  tip?: string;
  sets: SetLog[];
}

export interface SessionRecord {
  id: string;
  date: string;
  templateId: string | null;
  name: string;
  startedAt: number;
  endedAt: number;
  volume: number;
  dayType: DayType;
  doneSets: number;
  best: { name: string; e1rm: number } | null;
  /** 完了画面のメモ */
  memo: string;
  /** 完了したセットだけ */
  exercises: ExerciseLog[];
}

export interface ProfileData extends Profile {
  pk: number;
  coef: Coef;
  tdee: number;
  tdeeWeek: string | null;
  onboarded: boolean;
  goalWeightKg: number | null;
  /** 週の合計への調整（kcal）。ペースの見直しで受け入れたぶん */
  weekAdjustKcal: number;
}

export type { Goal, Sex };
