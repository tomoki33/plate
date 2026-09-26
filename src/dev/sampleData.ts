import foodsJson from '../data/foods.json';
import * as repo from '../db/repo';
import { SEED_MY_FOODS, shortName } from '../domain/foodSearch';
import { SEED_TEMPLATES, SEED_WEEK_PLAN } from '../domain/defaults';
import { addDays, dateKey, weekdayIndex } from '../domain/dates';
import type { ExerciseLog, MealEntry, SessionRecord, Slot } from '../domain/models';
import { bestSet, decideDayType, volumeScore } from '../domain/training';
import { uuid } from '../lib/id';
import { SAMPLE_PHOTO_URI } from './samplePhoto';
import { useStore } from '../store/store';

/**
 * 開発用のサンプルデータ（直近3週間）。レビュー・目標の再配分・TDEE補正・過去日の編集などを一通り試せる。
 *
 * - 体重：21日分（1日抜け、ヘルスケア由来3日と体脂肪率つき）
 * - 食事：14日分。実際の食品とグラムで作る。食べ過ぎの日・軽い日・記録なしの日・AI入力の食事を混ぜる。今日は朝食だけ
 * - トレ：21日分。予定どおりの日、予定を飛ばした日、予定外にやった日。重量は少しずつ伸びる（RIRつき）
 * __DEV__ のときだけ「データ」画面とオンボーディングに出る。
 */

type FoodRow = [string, string, string, number, number, number, number];
const FOODS = new Map((foodsJson as FoodRow[]).map((r) => [r[0], r]));

interface Item {
  /** 成分表の食品番号、またはマイ食品のキー */
  code: string;
  g: number;
}
const my = (key: string) => SEED_MY_FOODS.find((m) => m.key === key)!;

function per100(code: string) {
  const my_ = SEED_MY_FOODS.find((m) => m.key === code);
  if (my_) return { id: `myfood_${my_.key}`, name: my_.name, kcal: my_.kcal, p: my_.p, f: my_.f, c: my_.c };
  const r = FOODS.get(code);
  if (!r) throw new Error(`food ${code} not found`);
  return { id: `food_${code}`, name: shortName(r[2]), kcal: r[3], p: r[4], f: r[5], c: r[6] };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function group(date: string, at: number, slot: Slot, name: string, items: Item[], opts: { ai?: boolean; scale?: number; photo?: boolean } = {}): MealEntry[] {
  const groupId = uuid();
  return items.map((it, i) => {
    const f = per100(it.code);
    const g = Math.round(it.g * (opts.scale ?? 1));
    return {
      id: uuid(), date, slot, foodId: f.id, groupId, groupName: name, name: f.name, grams: g,
      kcal: Math.round((f.kcal * g) / 100), P: round1((f.p * g) / 100), F: round1((f.f * g) / 100), C: round1((f.c * g) / 100),
      ai: !!opts.ai, photoUri: opts.photo ? SAMPLE_PHOTO_URI : null, inputType: opts.photo ? 'photo' : opts.ai ? 'text' : 'set', createdAt: at + i,
    };
  });
}

// よくある食事の組み合わせ
const BREAKFAST: [string, Item[]][] = [
  ['納豆ごはん＋卵', [{ code: '04046', g: 45 }, { code: '01088', g: 200 }, { code: '12004', g: 50 }]],
  ['オートミール＋プロテイン＋牛乳', [{ code: '01004', g: 60 }, { code: 'protein', g: 30 }, { code: '13003', g: 200 }]],
  ['食パン＋卵＋ヨーグルト', [{ code: '01026', g: 120 }, { code: '12004', g: 100 }, { code: '13025', g: 100 }]],
];
const LUNCH: [string, Item[]][] = [
  ['鶏むね200g・米250g', [{ code: '11220', g: 200 }, { code: '01088', g: 250 }]],
  ['鶏もも＋ごはん＋ブロッコリー', [{ code: '11224', g: 180 }, { code: '01088', g: 220 }, { code: '06263', g: 80 }]],
  ['サラダチキン＋おにぎり', [{ code: 'salad-chicken', g: 110 }, { code: '01111', g: 200 }]],
];
const DINNER: [string, Item[]][] = [
  ['さば焼き定食', [{ code: '10156', g: 100 }, { code: '01088', g: 200 }, { code: 'miso-soup', g: 180 }]],
  ['ささみ＋さつまいも', [{ code: '11227', g: 150 }, { code: '02007', g: 200 }]],
  ['豚ロース＋ごはん＋ブロッコリー', [{ code: '11126', g: 150 }, { code: '01088', g: 150 }, { code: '06263', g: 100 }]],
  ['鮭＋ごはん＋味噌汁', [{ code: '10134', g: 100 }, { code: '01088', g: 200 }, { code: 'miso-soup', g: 180 }]],
  ['パスタ＋ささみ', [{ code: '01064', g: 250 }, { code: '11227', g: 100 }]],
];

/** 種目ごとの重量の目安（このあと、日ごとに少しずつ伸ばす） */
const BASE_KG: Record<string, number> = { ex_squat: 80, ex_bulgarian: 14, ex_leg_curl: 35, ex_calf_raise: 50, ex_bench: 60, ex_incline_db: 20, ex_shoulder_press: 16, ex_deadlift: 100, ex_pullup: 0, ex_bent_row: 50, ex_bb_curl: 30, ex_pushdown: 30, ex_hanging_leg_raise: 0 };

export async function insertSampleData(now = new Date()): Promise<void> {
  await repo.clearLogs();
  const { exercises } = useStore.getState();
  const exById = new Map(exercises.map((e) => [e.id, e]));
  const today = dateKey(now);

  // ---- 体重（21日）と体脂肪率
  for (let i = 21; i >= 1; i--) {
    if (i === 9) continue; // 1日抜ける
    const d = addDays(now, -i);
    // 予定（−0.47kg/週）より遅めの減り方にして、レビューの「ペースの見直し」が出るようにする
    const kg = Math.round((72.4 - 0.45 * ((21 - i) / 21) + Math.sin(i * 1.7) * 0.25) * 10) / 10;
    const fromHealth = i === 2 || i === 8 || i === 15;
    await repo.saveBodyLog(uuid(), dateKey(d), kg, fromHealth ? 'healthkit' : 'manual', fromHealth ? Math.round((16.8 - (21 - i) * 0.03) * 10) / 10 : null);
  }

  // ---- 食事（14日 + 今日の朝食）
  const meals: MealEntry[] = [];
  for (let i = 14; i >= 1; i--) {
    if (i === 6) continue; // 記録なしの日
    const d = addDays(now, -i);
    const date = dateKey(d);
    const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8).getTime();
    // 標準は目標に近い量（×1.3）。食べ過ぎの日・軽い日を混ぜる
    const scale = i === 10 ? 1.5 : i === 4 ? 0.95 : 1.2;
    const [bn, bi] = BREAKFAST[i % BREAKFAST.length];
    const [ln, li] = LUNCH[(i + 1) % LUNCH.length];
    const [dn, di] = DINNER[i % DINNER.length];
    meals.push(...group(date, at, '朝', bn, bi, { scale }));
    meals.push(...group(date, at + 4 * 3600_000, '昼', ln, li, { scale }));
    const trained = SEED_WEEK_PLAN[weekdayIndex(d)] !== null;
    if (trained) meals.push(...group(date, at + 9 * 3600_000, '間食', 'トレーニング後：プロテイン＋バナナ', [{ code: 'protein', g: 30 }, { code: '07107', g: 100 }], { scale: 1.2 }));
    // 夜ごはんのうち1日は、文章から入れた（AI入力）ことにする
    if (i === 2 || i === 8) {
      // 写真で記録した昼ごはん（サムネイルの表示を確かめる）
      meals.splice(meals.length - 1, 0, ...group(date, at + 5 * 3600_000, '昼', '鶏むね・ごはん・味噌汁', [{ code: '11220', g: 180 }, { code: '01088', g: 200 }, { code: 'miso-soup', g: 180 }], { ai: true, photo: true, scale }));
    }
    meals.push(...group(date, at + 12 * 3600_000, '夜', i === 3 ? '鶏むね200g 米150g 味噌汁' : dn, i === 3 ? [{ code: '11220', g: 200 }, { code: '01088', g: 150 }, { code: 'miso-soup', g: 180 }] : di, { ai: i === 3, scale }));
  }
  const at0 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8).getTime();
  meals.push(...group(today, at0, '朝', BREAKFAST[0][0], BREAKFAST[0][1], { scale: 1.2 }));
  // 今日の昼ごはんも、写真で記録したことにする
  meals.push(...group(today, at0 + 4 * 3600_000, '昼', '鶏むね・ごはん・味噌汁', [{ code: '11220', g: 180 }, { code: '01088', g: 200 }, { code: 'miso-soup', g: 180 }], { ai: true, photo: true }));
  await repo.insertMeals(meals);

  // ---- トレ（21日）：予定どおり／予定を飛ばした日／予定外の日
  const dayTypes: Record<string, string> = {};
  let extra = false;
  for (let i = 21; i >= 1; i--) {
    const d = addDays(now, -i);
    const wd = weekdayIndex(d);
    let templateId = SEED_WEEK_PLAN[wd];
    if (templateId && i === 12) continue; // 予定を飛ばした日
    if (!templateId && !extra && i <= 12 && (wd === 1 || wd === 3)) {
      templateId = 'tpl_chest'; // 予定外にやった日（オフの日に胸・肩）
      extra = true;
    }
    if (!templateId) continue;
    const tpl = SEED_TEMPLATES.find((t) => t.id === templateId)!;
    const progress = (21 - i) / 21;
    const logs: ExerciseLog[] = tpl.exercises.map((te, k) => {
      const e = exById.get(te.exerciseId)!;
      const base = BASE_KG[te.exerciseId] ?? te.kg;
      const kg = base === 0 ? 0 : Math.round((base + progress * base * 0.06) / 2.5) * 2.5;
      const reps = te.reps + (i % 3 === 0 ? 1 : 0);
      return {
        exerciseId: e.id, name: e.name, part: e.part, coef: e.coef, prevKg: kg, prevReps: reps,
        sets: Array.from({ length: te.sets }, (_, s) => ({ kg, reps: s === te.sets - 1 ? Math.max(1, reps - 1) : reps, done: true, rir: k === 0 ? (s === te.sets - 1 ? 1 : 2) : null })),
      };
    });
    const volume = volumeScore(logs);
    const dayType = decideDayType(tpl.defaultDayType, volume, 11);
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18).getTime();
    const rec: SessionRecord = {
      id: uuid(), date: dateKey(d), templateId, name: tpl.name, startedAt: start, endedAt: start + 58 * 60_000,
      volume, dayType, doneSets: logs.reduce((a, e) => a + e.sets.length, 0), best: bestSet(logs), exercises: logs,
    };
    await repo.saveSession(rec, logs.flatMap((l) => l.sets.map(() => uuid())));
    dayTypes[rec.date] = dayType;
  }
  for (const [date, t] of Object.entries(dayTypes)) await repo.setKv(`dt:${date}`, t);

  // ---- 今日は、AI入力を1回使った状態
  await repo.setKv(`ai:${today}`, '1');

  await useStore.getState().reload();
  // 目標体重が未設定なら入れる（体重の詳細と到達予測を試せるように）
  if (useStore.getState().profile.goalWeightKg === null) useStore.getState().setGoalWeight(69);
}

/** 初回起動から、サンプルつきで始める（開発用）。オンボーディングを済ませてから、サンプルを入れる */
export async function startWithSampleData(): Promise<void> {
  useStore.getState().skipLogin();
  useStore.getState().completeOnboarding({ sex: 'male', birthYear: 1995, heightCm: 172, activity: 1.55, goal: 'cut', pace: -0.47, weight: 71.5, goalWeight: 69 });
  await new Promise((r) => setTimeout(r, 300)); // 書き込みが終わるのを待つ
  await insertSampleData();
}

/**
 * 開発ビルドで、起動時に自動でサンプルを入れる（.env.local に EXPO_PUBLIC_AUTO_SAMPLE=1）。
 * 初回だけ：まだ始めていなければ、ログインとオンボーディングを飛ばして始める。
 * すでに始めているときは、記録をサンプルに置き換える。入れたら印を残して、消したあとに勝手に戻さない。
 */
export async function maybeAutoSample(): Promise<boolean> {
  if (!__DEV__ || process.env.EXPO_PUBLIC_AUTO_SAMPLE !== '1') return false;
  const st = useStore.getState();
  if (st.sampleInserted) return false;
  if (!st.profile.onboarded) await startWithSampleData();
  else await insertSampleData();
  st.markSampleInserted();
  return true;
}
