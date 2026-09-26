import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 端末内 SQLite が正（設計書「データモデル」）。
 * 全テーブルに id（UUID）・updated_at・deleted_at を持たせる（バックアップ同期と論理削除のため）。
 * 日付は 'YYYY-MM-DD'、時刻は epoch ミリ秒。
 */
const base = {
  id: text('id').primaryKey(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

/** 1行。性別・生年・身長・目的・ペース・P係数・日タイプ係数 */
export const profile = sqliteTable('profile', {
  ...base,
  sex: text('sex', { enum: ['male', 'female'] }).notNull(),
  birthYear: integer('birth_year').notNull(),
  heightCm: real('height_cm').notNull(),
  activity: real('activity').notNull(),
  goal: text('goal', { enum: ['cut', 'maintain', 'bulk'] }).notNull(),
  paceKgPerWeek: real('pace_kg_per_week').notNull(),
  pk: real('pk').notNull(),
  coefHigh: real('coef_high').notNull(),
  coefNormal: real('coef_normal').notNull(),
  coefOff: real('coef_off').notNull(),
  /** 実データで補正した維持カロリー */
  tdee: real('tdee').notNull(),
  /** TDEEを最後に更新した週の月曜（yyyy-mm-dd） */
  tdeeWeek: text('tdee_week'),
  onboarded: integer('onboarded', { mode: 'boolean' }).notNull().default(false),
  /** 目標体重（kg）。体重の詳細で「あと◯kg」と到達予測に使う */
  goalWeightKg: real('goal_weight_kg'),
  /** 週の合計への調整（kcal）。ペースの見直しで「週 −700kcal にする」を選んだぶん。取り消せる */
  weekAdjustKcal: integer('week_adjust_kcal').notNull().default(0),
});

export const bodyLog = sqliteTable(
  'body_log',
  {
    ...base,
    date: text('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    bodyFatPct: real('body_fat_pct'),
    source: text('source', { enum: ['manual', 'healthkit'] }).notNull().default('manual'),
  },
  (t) => [index('body_log_date_idx').on(t.date)],
);

export const exercise = sqliteTable('exercise', {
  ...base,
  name: text('name').notNull(),
  part: text('part', { enum: ['脚', '背中', '胸', '肩', '腕', '腹'] }).notNull(),
  /** 部位係数 */
  coef: real('coef').notNull(),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
});

export const workoutTemplate = sqliteTable('workout_template', {
  ...base,
  name: text('name').notNull(),
  /** [{ exerciseId, sets, kg, reps }] */
  exercises: text('exercises', { mode: 'json' }).$type<TemplateExercise[]>().notNull(),
  defaultDayType: text('default_day_type', { enum: ['high', 'normal', 'off'] }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});
export interface TemplateExercise {
  exerciseId: string;
  sets: number;
  kg: number;
  reps: number;
}

export const weekPlan = sqliteTable('week_plan', {
  ...base,
  /** 月曜=0 … 日曜=6 */
  weekday: integer('weekday').notNull(),
  /** null はオフ */
  templateId: text('template_id'),
});

export const workoutSession = sqliteTable(
  'workout_session',
  {
    ...base,
    date: text('date').notNull(),
    templateId: text('template_id'),
    name: text('name').notNull(),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at').notNull(),
    volumeScore: real('volume_score').notNull(),
    dayType: text('day_type', { enum: ['high', 'normal', 'off'] }).notNull(),
  },
  (t) => [index('workout_session_date_idx').on(t.date)],
);

export const workoutSet = sqliteTable(
  'workout_set',
  {
    ...base,
    sessionId: text('session_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    weightKg: real('weight_kg').notNull(),
    reps: integer('reps').notNull(),
    rir: integer('rir'),
    order: integer('order').notNull(),
  },
  (t) => [index('workout_set_session_idx').on(t.sessionId), index('workout_set_exercise_idx').on(t.exerciseId)],
);

export const food = sqliteTable(
  'food',
  {
    ...base,
    name: text('name').notNull(),
    /** 検索用（かな・全半角をそろえた文字列） */
    search: text('search').notNull(),
    kcal: real('kcal').notNull(),
    p: real('p').notNull(),
    f: real('f').notNull(),
    c: real('c').notNull(),
    source: text('source', { enum: ['成分表', '自作', 'AI'] }).notNull(),
    /** 成分表の食品番号 */
    code: text('code'),
    /** 1個・1枚あたりのg */
    unitG: real('unit_g'),
    defaultG: real('default_g'),
  },
  (t) => [index('food_source_idx').on(t.source), uniqueIndex('food_code_idx').on(t.code)],
);

export const mealSet = sqliteTable('meal_set', {
  ...base,
  name: text('name').notNull(),
  /** [{ foodId, g }] */
  items: text('items', { mode: 'json' }).$type<{ foodId: string; g: number }[]>().notNull(),
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: integer('last_used_at'),
  /** 主に使う時間帯（朝・昼・間食・夜・トレ後） */
  slotHint: text('slot_hint'),
});

/** 記録時の値をスナップショット保存（食品データを後で直しても過去の記録が変わらない） */
export const mealEntry = sqliteTable(
  'meal_entry',
  {
    ...base,
    date: text('date').notNull(),
    slot: text('slot', { enum: ['朝', '昼', '間食', '夜'] }).notNull(),
    foodId: text('food_id'),
    /** 同じ操作でまとめて追加した行（マイセット・AI入力）を束ねる */
    groupId: text('group_id').notNull(),
    groupName: text('group_name').notNull(),
    name: text('name').notNull(),
    grams: real('grams'),
    kcal: real('kcal').notNull(),
    p: real('p').notNull(),
    f: real('f').notNull(),
    c: real('c').notNull(),
    ai: integer('ai', { mode: 'boolean' }).notNull().default(false),
    /** 写真で記録した食事の写真（アプリ内に保存したファイル） */
    photoUri: text('photo_uri'),
    /** どの入力方法で記録したか（マイセット・検索・文章・写真） */
    inputType: text('input_type', { enum: ['set', 'search', 'text', 'photo'] }).notNull().default('search'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('meal_entry_date_idx').on(t.date)],
);

/** 再配分の履歴を残す */
export const dayTarget = sqliteTable(
  'day_target',
  {
    ...base,
    date: text('date').notNull(),
    dayType: text('day_type', { enum: ['high', 'normal', 'off'] }).notNull(),
    kcal: real('kcal').notNull(),
    p: real('p').notNull(),
    f: real('f').notNull(),
    c: real('c').notNull(),
    reason: text('reason').notNull(),
  },
  (t) => [index('day_target_date_idx').on(t.date)],
);

/** ペースの見直しの提案に答えた記録。同じ週に2回出さないため（id は週の月曜の日付） */
export const paceSuggestion = sqliteTable('pace_suggestion', {
  ...base,
  weekStart: text('week_start').notNull(),
  deltaKcal: integer('delta_kcal').notNull(),
  answer: text('answer', { enum: ['accepted', 'dismissed'] }).notNull(),
});

/** 1日のAI入力回数、課金状態のキャッシュなど */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
