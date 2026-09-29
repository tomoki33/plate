import type { Goal } from '../../domain/nutrition';
import type { Coef, DayType } from '../../domain/types';

/** 起動時のモード。'coach' はコーチをオンにした人だけ */
export type Mode = 'self' | 'coach';

export interface ShareFlags {
  meals: boolean;
  weight: boolean;
  training: boolean;
}
export type LinkStatus = 'active' | 'paused' | 'revoked';

// ---- 生徒がコーチへ送る「スナップショット」（共有を許した項目だけ入れる） ----

export interface SnapshotDay {
  date: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  /** その日の目標 kcal と日タイプ（分かれば） */
  targetKcal: number | null;
  dayType: DayType | null;
}
export interface SnapshotMeal {
  date: string;
  slot: string;
  name: string;
  kcal: number;
  P: number;
  F: number;
  C: number;
  /** 入力方法のラベル用：set／search／text／photo／rough */
  input: string;
}
export interface SnapshotSession {
  date: string;
  name: string;
  /** 自己ベスト（推定1RM）。pr は、これまでの自己ベストを更新したか */
  best: { name: string; e1rm: number; pr: boolean } | null;
  exercises: { name: string; sets: { kg: number; reps: number }[] }[];
}
export interface Snapshot {
  v: 1;
  /** 生徒のタイムゾーン（週の区切り・「今日」の判定に使う） */
  tz: string;
  updatedAt: number;
  /** 送った時点の、生徒の今日 */
  today: string;
  profile: {
    goal: Goal;
    goalWeightKg: number | null;
    pace: number;
    proteinG: number;
    fatPct: number | null;
    tdee: number;
    weekKcal: number;
    coef: Coef;
    /** 月曜〜日曜の日タイプ（予定） */
    weekTypes: DayType[];
    /** 週にトレーニングを予定している回数 */
    plannedPerWeek: number;
    /** コーチが目標を管理しているか */
    managed: boolean;
  };
  meals?: { days: SnapshotDay[]; recent: SnapshotMeal[] };
  weight?: { entries: { date: string; kg: number }[] };
  training?: { sessions: SnapshotSession[] };
}

// ---- サーバーの行 ----

export interface MenuExercise {
  exerciseId: string;
  name: string;
  part: string;
  sets: number;
  kg: number;
  reps: number;
}
/** コーチが作るメニューのひな形（生徒に送るとコピーが作られる） */
export interface CoachMenu {
  id: string;
  name: string;
  defaultDayType: DayType;
  exercises: MenuExercise[];
  sortOrder: number;
}

export interface PlanRow {
  id: string;
  user_id: string;
  coach_id: string;
  target_weight: number;
  pace_per_week: number;
  protein_g: number;
  fat_pct: number;
  menus: CoachMenu[];
  effective_from: string;
  created_at: string;
}
export interface NoteRow {
  id: string;
  weekStart: string;
  body: string;
  createdAt: string;
  coachName: string;
}
/** coach_students() が返す生徒の行の「ひとこと」（テーブルの行そのまま） */
export interface LastNote {
  id: string;
  week_start: string;
  body: string;
  created_at: string;
}

export interface StudentRow {
  linkId: string;
  userId: string;
  studentName: string;
  status: 'active' | 'paused';
  share: ShareFlags;
  managesGoals: boolean;
  joinedAt: string;
  /** 一時停止中は null。共有を切った項目は入っていない */
  payload: Snapshot | null;
  payloadUpdatedAt: string | null;
  plan: PlanRow | null;
  lastNote: LastNote | null;
}

export interface CoachInfo {
  id: string;
  name: string;
  invite_code: string;
}

export interface MyLink {
  coachName: string;
  status: 'active' | 'paused';
  managesGoals: boolean;
  studentName: string;
  share: ShareFlags;
}
export interface Inbox {
  link: MyLink | null;
  plans: PlanRow[];
  notes: NoteRow[];
}
