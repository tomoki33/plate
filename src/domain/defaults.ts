import type { Part } from './training';
import type { DayType } from './types';

/** 初期に同梱する種目（設計書：約80個）。id は固定（テンプレートから参照するため） */
export interface SeedExercise {
  id: string;
  name: string;
  part: Part;
}

const ex = (part: Part, list: [string, string][]): SeedExercise[] => list.map(([key, name]) => ({ id: `ex_${key}`, name, part }));

export const SEED_EXERCISES: SeedExercise[] = [
  ...ex('脚', [
    ['squat', 'スクワット'],
    ['front_squat', 'フロントスクワット'],
    ['bulgarian', 'ブルガリアンスクワット'],
    ['goblet_squat', 'ゴブレットスクワット'],
    ['smith_squat', 'スミスマシンスクワット'],
    ['hack_squat', 'ハックスクワット'],
    ['leg_press', 'レッグプレス'],
    ['leg_extension', 'レッグエクステンション'],
    ['leg_curl', 'レッグカール'],
    ['rdl', 'ルーマニアンデッドリフト'],
    ['lunge', 'ランジ'],
    ['hip_thrust', 'ヒップスラスト'],
    ['calf_raise', 'カーフレイズ'],
    ['hip_abduction', 'ヒップアブダクション'],
    ['step_up', 'ステップアップ'],
  ]),
  ...ex('背中', [
    ['deadlift', 'デッドリフト'],
    ['pullup', '懸垂'],
    ['wide_pullup', 'ワイドグリップ懸垂'],
    ['lat_pulldown', 'ラットプルダウン'],
    ['bent_row', 'ベントオーバーロウ'],
    ['db_row', 'ワンハンドダンベルロウ'],
    ['seated_row', 'シーテッドロウ'],
    ['t_bar_row', 'Tバーロウ'],
    ['machine_row', 'マシンロウ'],
    ['straight_arm', 'ストレートアームプルダウン'],
    ['face_pull', 'フェイスプル'],
    ['shrug', 'シュラッグ'],
    ['back_extension', 'バックエクステンション'],
    ['rack_pull', 'ラックプル'],
  ]),
  ...ex('胸', [
    ['bench', 'ベンチプレス'],
    ['incline_bench', 'インクラインベンチプレス'],
    ['decline_bench', 'デクラインベンチプレス'],
    ['db_press', 'ダンベルプレス'],
    ['incline_db', 'インクラインDBプレス'],
    ['db_fly', 'ダンベルフライ'],
    ['cable_cross', 'ケーブルクロスオーバー'],
    ['chest_press', 'チェストプレス'],
    ['pec_deck', 'ペックデック'],
    ['dips', 'ディップス'],
    ['pushup', 'プッシュアップ'],
    ['smith_bench', 'スミスマシンベンチプレス'],
  ]),
  ...ex('肩', [
    ['shoulder_press', 'ショルダープレス'],
    ['ohp', 'バーベルショルダープレス'],
    ['machine_shoulder', 'マシンショルダープレス'],
    ['arnold', 'アーノルドプレス'],
    ['side_raise', 'サイドレイズ'],
    ['cable_side', 'ケーブルサイドレイズ'],
    ['front_raise', 'フロントレイズ'],
    ['rear_raise', 'リアレイズ'],
    ['upright_row', 'アップライトロウ'],
    ['reverse_pec', 'リアデルトフライ（マシン）'],
  ]),
  ...ex('腕', [
    ['bb_curl', 'バーベルカール'],
    ['db_curl', 'ダンベルカール'],
    ['hammer_curl', 'ハンマーカール'],
    ['preacher', 'プリーチャーカール'],
    ['incline_curl', 'インクラインカール'],
    ['cable_curl', 'ケーブルカール'],
    ['pushdown', 'トライセプスプッシュダウン'],
    ['skull', 'スカルクラッシャー'],
    ['french', 'フレンチプレス'],
    ['close_bench', 'ナローベンチプレス'],
    ['kickback', 'ダンベルキックバック'],
    ['wrist_curl', 'リストカール'],
  ]),
  ...ex('腹', [
    ['crunch', 'クランチ'],
    ['leg_raise', 'レッグレイズ'],
    ['hanging_leg_raise', 'ハンギングレッグレイズ'],
    ['ab_roller', 'アブローラー'],
    ['cable_crunch', 'ケーブルクランチ'],
    ['russian_twist', 'ロシアンツイスト'],
    ['side_bend', 'サイドベンド'],
    ['plank', 'プランク'],
  ]),
];

export interface SeedTemplate {
  id: string;
  name: string;
  defaultDayType: DayType;
  exercises: { exerciseId: string; sets: number; kg: number; reps: number }[];
}

/** 初期の分割テンプレート（重さは目安の初期値。1回記録すれば前回値に置き換わる） */
export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    id: 'tpl_legs',
    name: '脚の日',
    defaultDayType: 'high',
    exercises: [
      { exerciseId: 'ex_squat', sets: 3, kg: 60, reps: 8 },
      { exerciseId: 'ex_bulgarian', sets: 3, kg: 10, reps: 10 },
      { exerciseId: 'ex_leg_curl', sets: 3, kg: 30, reps: 12 },
      { exerciseId: 'ex_calf_raise', sets: 3, kg: 40, reps: 15 },
    ],
  },
  {
    id: 'tpl_chest',
    name: '胸・肩',
    defaultDayType: 'normal',
    exercises: [
      { exerciseId: 'ex_bench', sets: 3, kg: 50, reps: 8 },
      { exerciseId: 'ex_incline_db', sets: 3, kg: 16, reps: 10 },
      { exerciseId: 'ex_shoulder_press', sets: 3, kg: 14, reps: 10 },
    ],
  },
  {
    id: 'tpl_back',
    name: '背中',
    defaultDayType: 'normal',
    exercises: [
      { exerciseId: 'ex_deadlift', sets: 3, kg: 70, reps: 5 },
      { exerciseId: 'ex_pullup', sets: 3, kg: 0, reps: 8 },
      { exerciseId: 'ex_bent_row', sets: 3, kg: 40, reps: 8 },
    ],
  },
  {
    id: 'tpl_arms',
    name: '腕・腹',
    defaultDayType: 'normal',
    exercises: [
      { exerciseId: 'ex_bb_curl', sets: 3, kg: 25, reps: 10 },
      { exerciseId: 'ex_pushdown', sets: 3, kg: 25, reps: 12 },
      { exerciseId: 'ex_hanging_leg_raise', sets: 3, kg: 0, reps: 10 },
    ],
  },
];

/** 初期の週間スケジュール（月〜日）。null はオフ */
export const SEED_WEEK_PLAN: (string | null)[] = ['tpl_chest', null, 'tpl_legs', null, 'tpl_back', 'tpl_arms', null];
