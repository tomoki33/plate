import { and, desc, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';
import { expandQuery, findCatalogInQuery, POPULAR_FOODS, rankFoods } from '../domain/foodSearch';
import type { Exercise, FoodItem, MealEntry, MealSet, ProfileData, SessionRecord, WorkoutTemplate } from '../domain/models';
import type { DayType } from '../domain/types';
import { bestSet } from '../domain/training';
import { db } from './client';
import * as s from './schema';

const alive = <T extends { deletedAt: unknown }>(t: T) => isNull(t.deletedAt as never);

// ---------------------------------------------------------------- 読み込み

export interface LoadedData {
  profile: ProfileData;
  weights: Record<string, number>;
  weightSources: Record<string, 'manual' | 'healthkit'>;
  bodyFat: Record<string, number>;
  meals: MealEntry[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  weekPlan: (string | null)[];
  sessions: SessionRecord[];
  mealSets: MealSet[];
  myFoods: FoodItem[];
  aiUsed: Record<string, number>;
  kv: Record<string, string>;
  lastTargets: Record<string, { dayType: DayType; kcal: number; reason: string }>;
  /** ペースの見直しに答えた週（週の月曜 → 答え） */
  paceAnswers: Record<string, 'accepted' | 'dismissed'>;
}

export async function loadAll(): Promise<LoadedData> {
  const [p] = await db.select().from(s.profile).where(eq(s.profile.id, 'me'));
  const profile: ProfileData = {
    sex: p.sex,
    birthYear: p.birthYear,
    heightCm: p.heightCm,
    activity: p.activity,
    goal: p.goal,
    pace: p.paceKgPerWeek,
    pk: p.pk,
    coef: { high: p.coefHigh, normal: p.coefNormal, off: p.coefOff },
    tdee: p.tdee,
    tdeeWeek: p.tdeeWeek,
    onboarded: p.onboarded,
    goalWeightKg: p.goalWeightKg,
    weekAdjustKcal: p.weekAdjustKcal,
  };

  const body = await db.select().from(s.bodyLog).where(alive(s.bodyLog)).orderBy(s.bodyLog.date);
  const weights: Record<string, number> = {};
  const weightSources: Record<string, 'manual' | 'healthkit'> = {};
  const bodyFat: Record<string, number> = {};
  for (const b of body) {
    // 同じ日に手入力とヘルスケアがあれば、手入力を優先する
    if (weights[b.date] !== undefined && weightSources[b.date] === 'manual' && b.source === 'healthkit') continue;
    weights[b.date] = b.weightKg;
    weightSources[b.date] = b.source;
    if (b.bodyFatPct != null) bodyFat[b.date] = b.bodyFatPct;
  }

  const meals: MealEntry[] = (await db.select().from(s.mealEntry).where(alive(s.mealEntry)).orderBy(s.mealEntry.createdAt)).map((m) => ({
    id: m.id,
    date: m.date,
    slot: m.slot,
    foodId: m.foodId,
    groupId: m.groupId,
    groupName: m.groupName,
    name: m.name,
    grams: m.grams,
    kcal: m.kcal,
    P: m.p,
    F: m.f,
    C: m.c,
    ai: m.ai,
    photoUri: m.photoUri,
    inputType: m.inputType,
    createdAt: m.createdAt,
  }));

  const exercises: Exercise[] = (await db.select().from(s.exercise).where(alive(s.exercise))).map((e) => ({ id: e.id, name: e.name, part: e.part, coef: e.coef, isCustom: e.isCustom, aliases: e.aliases }));
  const templates: WorkoutTemplate[] = (await db.select().from(s.workoutTemplate).where(alive(s.workoutTemplate)).orderBy(s.workoutTemplate.sortOrder)).map((t) => ({
    id: t.id,
    name: t.name,
    defaultDayType: t.defaultDayType,
    exercises: t.exercises,
    sortOrder: t.sortOrder,
  }));
  const plan = await db.select().from(s.weekPlan).where(alive(s.weekPlan));
  const weekPlan: (string | null)[] = Array.from({ length: 7 }, (_, i) => plan.find((w) => w.weekday === i)?.templateId ?? null);

  const exById = new Map(exercises.map((e) => [e.id, e]));
  const sessRows = await db.select().from(s.workoutSession).where(alive(s.workoutSession)).orderBy(s.workoutSession.startedAt);
  const setRows = await db.select().from(s.workoutSet).where(alive(s.workoutSet)).orderBy(s.workoutSet.order);
  const setsBySession = new Map<string, typeof setRows>();
  for (const r of setRows) setsBySession.set(r.sessionId, [...(setsBySession.get(r.sessionId) ?? []), r]);
  const sessions: SessionRecord[] = sessRows.map((r) => {
    const byEx = new Map<string, SessionRecord['exercises'][number]>();
    for (const st of setsBySession.get(r.id) ?? []) {
      const ex = exById.get(st.exerciseId);
      if (!byEx.has(st.exerciseId))
        byEx.set(st.exerciseId, { exerciseId: st.exerciseId, name: ex?.name ?? '種目', part: ex?.part ?? '胸', coef: ex?.coef ?? 1, prevKg: st.weightKg, prevReps: st.reps, sets: [] });
      byEx.get(st.exerciseId)!.sets.push({ kg: st.weightKg, reps: st.reps, done: true, rir: st.rir });
    }
    const exs = [...byEx.values()];
    return {
      id: r.id,
      date: r.date,
      templateId: r.templateId,
      name: r.name,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      volume: r.volumeScore,
      dayType: r.dayType,
      doneSets: exs.reduce((a, e) => a + e.sets.length, 0),
      best: bestSet(exs),
      memo: r.memo,
      exercises: exs,
    };
  });

  const mealSets: MealSet[] = (await db.select().from(s.mealSet).where(alive(s.mealSet))).map((m) => ({
    id: m.id,
    name: m.name,
    items: m.items,
    useCount: m.useCount,
    lastUsedAt: m.lastUsedAt,
    slotHint: m.slotHint,
  }));
  const myFoods = (await db.select().from(s.food).where(and(eq(s.food.source, '自作'), alive(s.food)))).map(toFood);

  const kvRows = await db.select().from(s.kv);
  const kv: Record<string, string> = Object.fromEntries(kvRows.map((k) => [k.key, k.value]));
  const aiUsed: Record<string, number> = {};
  for (const k of kvRows) if (k.key.startsWith('ai:')) aiUsed[k.key.slice(3)] = Number(k.value);

  const targets = await db.select().from(s.dayTarget).orderBy(s.dayTarget.updatedAt);
  const lastTargets: LoadedData['lastTargets'] = {};
  for (const t of targets) lastTargets[t.date] = { dayType: t.dayType, kcal: t.kcal, reason: t.reason };

  const answers = await db.select().from(s.paceSuggestion).where(alive(s.paceSuggestion));
  const paceAnswers: LoadedData['paceAnswers'] = Object.fromEntries(answers.map((a) => [a.weekStart, a.answer]));

  return { profile, weights, weightSources, bodyFat, meals, exercises, templates, weekPlan, sessions, mealSets, myFoods, aiUsed, kv, lastTargets, paceAnswers };
}

const toFood = (f: typeof s.food.$inferSelect): FoodItem => ({ id: f.id, name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, source: f.source, code: f.code, unitG: f.unitG, defaultG: f.defaultG });

// ---------------------------------------------------------------- プロフィール

export async function saveProfile(p: ProfileData, now = Date.now()) {
  await db
    .update(s.profile)
    .set({
      sex: p.sex,
      birthYear: p.birthYear,
      heightCm: p.heightCm,
      activity: p.activity,
      goal: p.goal,
      paceKgPerWeek: p.pace,
      pk: p.pk,
      coefHigh: p.coef.high,
      coefNormal: p.coef.normal,
      coefOff: p.coef.off,
      tdee: p.tdee,
      tdeeWeek: p.tdeeWeek,
      onboarded: p.onboarded,
      goalWeightKg: p.goalWeightKg,
      weekAdjustKcal: p.weekAdjustKcal,
      updatedAt: now,
    })
    .where(eq(s.profile.id, 'me'));
}

// ---------------------------------------------------------------- 体重

export async function saveBodyLog(id: string, date: string, weightKg: number, source: 'manual' | 'healthkit', bodyFatPct: number | null, now = Date.now()) {
  // 同じ日・同じ出所の行は更新する
  const existing = await db.select().from(s.bodyLog).where(and(eq(s.bodyLog.date, date), eq(s.bodyLog.source, source), alive(s.bodyLog)));
  if (existing.length) {
    await db.update(s.bodyLog).set({ weightKg, bodyFatPct, updatedAt: now }).where(eq(s.bodyLog.id, existing[0].id));
    return existing[0].id;
  }
  await db.insert(s.bodyLog).values({ id, date, weightKg, bodyFatPct, source, updatedAt: now });
  return id;
}

/** その日の体重の記録を、手入力もヘルスケアも、すべて消す（論理削除） */
export async function deleteWeightOn(date: string, now = Date.now()) {
  await db.update(s.bodyLog).set({ deletedAt: now, updatedAt: now }).where(eq(s.bodyLog.date, date));
}

export async function savePaceAnswer(weekStart: string, deltaKcal: number, answer: 'accepted' | 'dismissed', now = Date.now()) {
  await db
    .insert(s.paceSuggestion)
    .values({ id: weekStart, weekStart, deltaKcal, answer, updatedAt: now })
    .onConflictDoUpdate({ target: s.paceSuggestion.id, set: { deltaKcal, answer, deletedAt: null, updatedAt: now } });
}
export async function deletePaceAnswer(weekStart: string, now = Date.now()) {
  await db.update(s.paceSuggestion).set({ deletedAt: now, updatedAt: now }).where(eq(s.paceSuggestion.id, weekStart));
}

export async function deleteBodyLog(date: string, source: 'manual' | 'healthkit', now = Date.now()) {
  await db.update(s.bodyLog).set({ deletedAt: now, updatedAt: now }).where(and(eq(s.bodyLog.date, date), eq(s.bodyLog.source, source)));
}

// ---------------------------------------------------------------- 食事

export async function insertMeals(entries: MealEntry[], now = Date.now()) {
  if (!entries.length) return;
  await db.insert(s.mealEntry).values(
    entries.map((m) => ({
      id: m.id,
      date: m.date,
      slot: m.slot,
      foodId: m.foodId,
      groupId: m.groupId,
      groupName: m.groupName,
      name: m.name,
      grams: m.grams,
      kcal: m.kcal,
      p: m.P,
      f: m.F,
      c: m.C,
      ai: m.ai,
      photoUri: m.photoUri,
      inputType: m.inputType,
      createdAt: m.createdAt,
      updatedAt: now,
    })),
  );
}

/** 食事の行を書き換える（量・栄養・時間帯）。記録時の値のコピーなので、その行の値だけが変わる */
export async function updateMealEntries(rows: Pick<MealEntry, 'id' | 'slot' | 'grams' | 'kcal' | 'P' | 'F' | 'C'>[], now = Date.now()) {
  for (const r of rows) {
    await db.update(s.mealEntry).set({ slot: r.slot, grams: r.grams, kcal: r.kcal, p: r.P, f: r.F, c: r.C, updatedAt: now }).where(eq(s.mealEntry.id, r.id));
  }
}

export async function softDeleteMealGroup(groupId: string, now = Date.now()) {
  await db.update(s.mealEntry).set({ deletedAt: now, updatedAt: now }).where(eq(s.mealEntry.groupId, groupId));
}
export async function restoreMealGroup(groupId: string, now = Date.now()) {
  await db.update(s.mealEntry).set({ deletedAt: null, updatedAt: now }).where(eq(s.mealEntry.groupId, groupId));
}

// ---------------------------------------------------------------- 食品検索

/** 検索語を SQL に展開して検索。自作（マイ食品）→ よく使う順 → 名前の短い順 */
export async function searchFoodsDb(query: string, limit = 30): Promise<FoodItem[]> {
  const q = query.trim();
  if (!q) {
    const codes = POPULAR_FOODS.map((p) => `food_${p.code}`);
    const mine = await db.select().from(s.food).where(and(eq(s.food.source, '自作'), alive(s.food)));
    const pop = await db.select().from(s.food).where(inArray(s.food.id, codes));
    const order = new Map(codes.map((c, i) => [c, i]));
    pop.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return [...mine, ...pop].map(toFood);
  }
  const esc = (t: string) => `%${t.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const conds = expandQuery(q).map((alts) => or(...alts.map((and_) => and(...and_.map((t) => sql`${s.food.search} LIKE ${esc(t)} ESCAPE '\\'`))))!);
  // よく使う食品は、リストの順位どおりに並べる（それ以外は名前の短い順）
  const popularCase = sql`CASE ${s.food.id} ${sql.join(POPULAR_FOODS.map((p, i) => sql`WHEN ${`food_${p.code}`} THEN ${i}`), sql` `)} ELSE 999 END`;
  const rows = await db
    .select()
    .from(s.food)
    .where(and(alive(s.food), ...conds))
    .orderBy(sql`CASE ${s.food.source} WHEN '自作' THEN 0 WHEN 'カタログ' THEN 1 ELSE 2 END`, popularCase, sql`length(${s.food.name})`)
    .limit(400);
  // 関連の高い順に並べ替える（偶然の一致は落とす）
  return rankFoods(q, rows.map(toFood), limit);
}

/**
 * 名前から食品を1件探す（AI入力・文章入力用）。
 * 検索で見つからないとき、文章に含まれるカタログの名前・別名で探し直す
 * （「鮭の塩焼き」「白いご飯」のように余計な言葉が付いていても拾う）。
 */
export async function searchFoodsSmart(query: string, limit = 1): Promise<FoodItem[]> {
  const hits = await searchFoodsDb(query, limit);
  if (hits.length) return hits;
  const id = findCatalogInQuery(query);
  return id ? getFoodsByIds([id]) : [];
}

export async function getFoodsByIds(ids: string[]): Promise<FoodItem[]> {
  if (!ids.length) return [];
  return (await db.select().from(s.food).where(inArray(s.food.id, ids))).map(toFood);
}

export async function saveMyFood(f: FoodItem & { search: string }, now = Date.now()) {
  await db
    .insert(s.food)
    .values({ id: f.id, name: f.name, search: f.search, kcal: f.kcal, p: f.p, f: f.f, c: f.c, source: f.source, code: null, unitG: f.unitG ?? null, defaultG: f.defaultG ?? null, updatedAt: now })
    .onConflictDoUpdate({ target: s.food.id, set: { name: f.name, search: f.search, kcal: f.kcal, p: f.p, f: f.f, c: f.c, unitG: f.unitG ?? null, defaultG: f.defaultG ?? null, deletedAt: null, updatedAt: now } });
}
export async function deleteMyFood(id: string, now = Date.now()) {
  await db.update(s.food).set({ deletedAt: now, updatedAt: now }).where(eq(s.food.id, id));
}

// ---------------------------------------------------------------- マイセット

export async function saveMealSet(m: MealSet, now = Date.now()) {
  await db
    .insert(s.mealSet)
    .values({ id: m.id, name: m.name, items: m.items, useCount: m.useCount, lastUsedAt: m.lastUsedAt, slotHint: m.slotHint, updatedAt: now })
    .onConflictDoUpdate({ target: s.mealSet.id, set: { name: m.name, items: m.items, useCount: m.useCount, lastUsedAt: m.lastUsedAt, slotHint: m.slotHint, deletedAt: null, updatedAt: now } });
}
export async function deleteMealSet(id: string, now = Date.now()) {
  await db.update(s.mealSet).set({ deletedAt: now, updatedAt: now }).where(eq(s.mealSet.id, id));
}

// ---------------------------------------------------------------- トレ

export async function saveExercise(e: Exercise, now = Date.now()) {
  await db
    .insert(s.exercise)
    .values({ id: e.id, name: e.name, part: e.part, coef: e.coef, isCustom: e.isCustom, aliases: e.aliases, updatedAt: now })
    .onConflictDoUpdate({ target: s.exercise.id, set: { name: e.name, part: e.part, coef: e.coef, aliases: e.aliases, deletedAt: null, updatedAt: now } });
}

export async function saveTemplate(t: WorkoutTemplate, now = Date.now()) {
  await db
    .insert(s.workoutTemplate)
    .values({ id: t.id, name: t.name, exercises: t.exercises, defaultDayType: t.defaultDayType, sortOrder: t.sortOrder, updatedAt: now })
    .onConflictDoUpdate({ target: s.workoutTemplate.id, set: { name: t.name, exercises: t.exercises, defaultDayType: t.defaultDayType, sortOrder: t.sortOrder, deletedAt: null, updatedAt: now } });
}
export async function deleteTemplate(id: string, now = Date.now()) {
  await db.update(s.workoutTemplate).set({ deletedAt: now, updatedAt: now }).where(eq(s.workoutTemplate.id, id));
  await db.update(s.weekPlan).set({ templateId: null, updatedAt: now }).where(eq(s.weekPlan.templateId, id));
}

export async function saveWeekPlan(plan: (string | null)[], now = Date.now()) {
  for (let weekday = 0; weekday < 7; weekday++) {
    await db
      .insert(s.weekPlan)
      .values({ id: `week_${weekday}`, weekday, templateId: plan[weekday], updatedAt: now })
      .onConflictDoUpdate({ target: s.weekPlan.id, set: { templateId: plan[weekday], deletedAt: null, updatedAt: now } });
  }
}

export async function saveSession(rec: SessionRecord, setIds: string[], now = Date.now()) {
  await db.insert(s.workoutSession).values({ id: rec.id, date: rec.date, templateId: rec.templateId, name: rec.name, startedAt: rec.startedAt, endedAt: rec.endedAt, volumeScore: rec.volume, dayType: rec.dayType, memo: rec.memo, updatedAt: now });
  let order = 0;
  const rows = rec.exercises.flatMap((e) =>
    e.sets
      .filter((st) => st.done)
      .map((st) => ({ id: setIds[order] ?? `${rec.id}_${order}`, sessionId: rec.id, exerciseId: e.exerciseId, weightKg: st.kg, reps: st.reps, rir: st.rir ?? null, order: order++, updatedAt: now })),
  );
  if (rows.length) await db.insert(s.workoutSet).values(rows);
}

export async function setSessionMemo(id: string, memo: string, now = Date.now()) {
  await db.update(s.workoutSession).set({ memo, updatedAt: now }).where(eq(s.workoutSession.id, id));
}

export async function deleteSession(id: string, now = Date.now()) {
  await db.update(s.workoutSession).set({ deletedAt: now, updatedAt: now }).where(eq(s.workoutSession.id, id));
  await db.update(s.workoutSet).set({ deletedAt: now, updatedAt: now }).where(eq(s.workoutSet.sessionId, id));
}

// ---------------------------------------------------------------- 目標の履歴・KV

export async function insertDayTarget(row: { id: string; date: string; dayType: DayType; kcal: number; p: number; f: number; c: number; reason: string }, now = Date.now()) {
  await db.insert(s.dayTarget).values({ ...row, updatedAt: now });
}

export async function setKv(key: string, value: string, now = Date.now()) {
  await db.insert(s.kv).values({ key, value, updatedAt: now }).onConflictDoUpdate({ target: s.kv.key, set: { value, updatedAt: now } });
}
export async function getAllKv(): Promise<Record<string, string>> {
  const rows = await db.select().from(s.kv);
  return Object.fromEntries(rows.map((k) => [k.key, k.value]));
}
export async function deleteKv(key: string) {
  await db.delete(s.kv).where(eq(s.kv.key, key));
}

export async function lastSessions(limit: number) {
  return db.select().from(s.workoutSession).where(alive(s.workoutSession)).orderBy(desc(s.workoutSession.startedAt)).limit(limit);
}

// ---------------------------------------------------------------- 記録だけ消す（開発用のサンプル投入の前）

/** 体重・食事・トレ・目標の履歴・1日ごとの入力回数と日タイプを消す。プロフィールや設定は残す */
export async function clearLogs() {
  await db.delete(s.mealEntry);
  await db.delete(s.bodyLog);
  await db.delete(s.workoutSet);
  await db.delete(s.workoutSession);
  await db.delete(s.dayTarget);
  await db.delete(s.paceSuggestion);
  await db.delete(s.kv).where(or(sql`${s.kv.key} LIKE 'ai:%'`, sql`${s.kv.key} LIKE 'dt:%'`)!);
}

// ---------------------------------------------------------------- 開発用：初回起動の状態に戻す

/** 記録・設定・体験や課金の状態・コーチの設定まで、端末の中身を全部消す（開発用。ログアウトは呼び出し側） */
export async function wipeEverything() {
  await wipeUserData();
  await db.delete(s.kv);
}

// ---------------------------------------------------------------- 全消去（データ削除）

export async function wipeUserData() {
  await db.delete(s.mealEntry);
  await db.delete(s.bodyLog);
  await db.delete(s.workoutSet);
  await db.delete(s.workoutSession);
  await db.delete(s.dayTarget);
  await db.delete(s.paceSuggestion);
  await db.delete(s.mealSet);
  // 無料体験の開始日と課金状態は、データ削除では消さない（削除で体験が延びないように）
  // コーチの設定（オン／オフ・コーチ名・つながり）はアカウントに付くものなので残す。反映済みの目標は消し、次の同期で入れ直す
  await db.delete(s.kv).where(notInArray(s.kv.key, ['trial_started_at', 'paid', 'sample_inserted', 'coach_enabled', 'coach_mode', 'coach_name', 'coach_seen_note', 'coach_seen_plan', 'coach_link']));
  await db.delete(s.food).where(eq(s.food.source, '自作'));
  await db.delete(s.food).where(eq(s.food.source, 'AI'));
  await db.delete(s.profile);
  await db.delete(s.weekPlan);
  await db.delete(s.workoutTemplate);
  await db.delete(s.exercise);
}

