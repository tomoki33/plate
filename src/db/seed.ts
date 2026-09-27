import { count, eq } from 'drizzle-orm';
import foodsJson from '../data/foods.json';
import { SEED_ALIASES, SEED_EXERCISES, SEED_TEMPLATES, SEED_WEEK_PLAN } from '../domain/defaults';
import { MY_FOOD_ALIASES, POPULAR_BY_CODE, SEED_MY_FOODS, searchKey } from '../domain/foodSearch';
import { DEFAULT_PROFILE, defaultPk } from '../domain/nutrition';
import { PART_COEF } from '../domain/training';
import { db } from './client';
import * as s from './schema';

type FoodRow = [string, string, string, number, number, number, number];

/** 初期データの版。上げると、起動時に足りないものだけ追加する（ユーザーの編集は上書きしない） */
const SEED_VERSION = 3;

const chunk = <T,>(xs: T[], n: number): T[][] => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

/**
 * 初回起動時に、成分表（約2,500品目）・種目・分割テンプレート・週間スケジュール・
 * マイ食品・マイセット・プロフィール（初期値）を入れる。
 */
export async function seedIfNeeded(now = Date.now()): Promise<void> {
  const [{ n }] = await db.select({ n: count() }).from(s.food);
  const kvRow = await db.select().from(s.kv).where(eq(s.kv.key, 'seed_version'));
  if (n > 0 && kvRow.length && Number(kvRow[0].value) >= SEED_VERSION) return;

  // 成分表（SQLiteの変数上限に収まるよう分割して入れる）
  const foodRows = (foodsJson as FoodRow[]).map(([code, , name, kcal, p, f, c]) => ({
    id: `food_${code}`,
    name,
    search: searchKey(name),
    kcal,
    p,
    f,
    c,
    source: '成分表' as const,
    code,
    unitG: POPULAR_BY_CODE[code]?.unitG ?? null,
    defaultG: POPULAR_BY_CODE[code]?.defaultG ?? null,
    updatedAt: now,
  }));
  for (const part of chunk(foodRows, 60)) await db.insert(s.food).values(part).onConflictDoNothing();

  // マイ食品
  const myIds: Record<string, string> = {};
  for (const m of SEED_MY_FOODS) {
    const id = `myfood_${m.key}`;
    myIds[m.key] = id;
    await db
      .insert(s.food)
      .values({
        id,
        name: m.name,
        search: searchKey(`${m.name} ${(MY_FOOD_ALIASES[m.key] ?? []).join(' ')}`),
        kcal: m.kcal,
        p: m.p,
        f: m.f,
        c: m.c,
        source: '自作',
        code: null,
        unitG: m.unitG,
        defaultG: m.defaultG,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // 種目・テンプレート・週間スケジュール
  await db
    .insert(s.exercise)
    .values(SEED_EXERCISES.map((e) => ({ id: e.id, name: e.name, part: e.part, coef: PART_COEF[e.part], isCustom: false, aliases: SEED_ALIASES[e.id.replace(/^ex_/, '')] ?? '', updatedAt: now })))
    .onConflictDoNothing();
  // 既存の端末にも、別名（BSS・RDL など）を入れる
  for (const [key, aliases] of Object.entries(SEED_ALIASES)) await db.update(s.exercise).set({ aliases }).where(eq(s.exercise.id, `ex_${key}`));
  await db
    .insert(s.workoutTemplate)
    .values(SEED_TEMPLATES.map((t, i) => ({ id: t.id, name: t.name, exercises: t.exercises, defaultDayType: t.defaultDayType, sortOrder: i, updatedAt: now })))
    .onConflictDoNothing();
  await db
    .insert(s.weekPlan)
    .values(SEED_WEEK_PLAN.map((templateId, weekday) => ({ id: `week_${weekday}`, weekday, templateId, updatedAt: now })))
    .onConflictDoNothing();

  // マイセット（トレ後のプロテイン＋バナナなど）
  const banana = 'food_07107';
  const chicken = 'food_11220';
  const rice = 'food_01088';
  const natto = 'food_04046';
  const egg = 'food_12004';
  const sasami = 'food_11227';
  const imo = 'food_02007';
  await db
    .insert(s.mealSet)
    .values([
      { id: 'set_protein_banana', name: 'プロテイン＋バナナ', items: [{ foodId: myIds.protein, g: 30 }, { foodId: banana, g: 100 }], slotHint: 'トレ後', useCount: 0, lastUsedAt: null, updatedAt: now },
      { id: 'set_chicken_rice', name: '鶏むね200g・米250g', items: [{ foodId: chicken, g: 200 }, { foodId: rice, g: 250 }], slotHint: '昼', useCount: 0, lastUsedAt: null, updatedAt: now },
      { id: 'set_natto_egg', name: '納豆ごはん＋卵', items: [{ foodId: natto, g: 45 }, { foodId: rice, g: 200 }, { foodId: egg, g: 50 }], slotHint: '朝', useCount: 0, lastUsedAt: null, updatedAt: now },
      { id: 'set_sasami_imo', name: 'ささみ＋さつまいも', items: [{ foodId: sasami, g: 150 }, { foodId: imo, g: 200 }], slotHint: '夜', useCount: 0, lastUsedAt: null, updatedAt: now },
    ])
    .onConflictDoNothing();

  // プロフィール（初期値。オンボーディングで入力してもらう）
  await db
    .insert(s.profile)
    .values({
      id: 'me',
      sex: DEFAULT_PROFILE.sex,
      birthYear: DEFAULT_PROFILE.birthYear,
      heightCm: DEFAULT_PROFILE.heightCm,
      activity: DEFAULT_PROFILE.activity,
      goal: DEFAULT_PROFILE.goal,
      paceKgPerWeek: DEFAULT_PROFILE.pace,
      pk: defaultPk(DEFAULT_PROFILE.goal),
      coefHigh: 1.15,
      coefNormal: 1.0,
      coefOff: 0.85,
      tdee: 2600,
      tdeeWeek: null,
      onboarded: false,
      goalWeightKg: null,
      weekAdjustKcal: 0,
      updatedAt: now,
    })
    .onConflictDoNothing();

  await db.insert(s.kv).values({ key: 'seed_version', value: String(SEED_VERSION), updatedAt: now }).onConflictDoUpdate({ target: s.kv.key, set: { value: String(SEED_VERSION), updatedAt: now } });
}
