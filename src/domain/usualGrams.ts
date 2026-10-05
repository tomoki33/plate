import type { MealEntry } from './models';

/** よく使う量を見るときに、食品ごとに何回ぶんさかのぼるか */
const RECENT = 5;

/**
 * 食品ごとの「いつもの量（g）」。端末内の食事記録だけから求める（サーバーには何も送らない・保存先も増やさない）。
 * 直近 RECENT 回のうち最も多い量。同数なら、あとに食べた量（＝直前に確定した量）を選ぶ。
 * 記録を直す・消すと、次の計算にそのまま反映される。
 */
export function buildUsualGrams(meals: readonly Pick<MealEntry, 'foodId' | 'grams' | 'createdAt'>[]): Map<string, number> {
  const byFood = new Map<string, { g: number; at: number }[]>();
  for (const m of meals) {
    if (!m.foodId || m.grams === null || !(m.grams > 0)) continue;
    const list = byFood.get(m.foodId);
    if (list) list.push({ g: m.grams, at: m.createdAt });
    else byFood.set(m.foodId, [{ g: m.grams, at: m.createdAt }]);
  }
  const out = new Map<string, number>();
  for (const [id, list] of byFood) {
    const recent = list.sort((a, b) => b.at - a.at).slice(0, RECENT);
    const count = new Map<number, number>();
    for (const { g } of recent) count.set(g, (count.get(g) ?? 0) + 1);
    let best = recent[0].g;
    for (const { g } of recent) if ((count.get(g) ?? 0) > (count.get(best) ?? 0)) best = g;
    out.set(id, best);
  }
  return out;
}

/** 文章に「150g」のように量が書いてあるか（書いてあるなら、その量を優先する） */
export function textStatesGrams(text: string, grams: number): boolean {
  // 入力の解釈（parseQuantities）と同じく NFKC で正規化する。「米１５０ｇ」も量の指定として扱う
  const n = String(Math.round(grams));
  return new RegExp(`(^|[^0-9.])${n}\\s*(g|グラム)`, 'i').test(text.normalize('NFKC'));
}

interface Row {
  foodId?: string | null;
  grams?: number;
  origin?: 'table' | 'ai' | 'photo' | 'estimate' | 'manual';
  personalized?: boolean;
}

/**
 * AI・文章の推定結果の量を、前回の量に置き換える。
 * 文章に量が書かれている行と、成分表に無い行（AIの目安）はそのまま。
 */
export function personalizeRows<T extends Row>(rows: T[], usual: ReadonlyMap<string, number>, text: string): T[] {
  return rows.map((r) => {
    if (!r.foodId || r.origin === 'estimate' || r.origin === 'manual' || r.grams === undefined) return r;
    const g = usual.get(r.foodId);
    if (g === undefined || g === r.grams || textStatesGrams(text, r.grams)) return r;
    return { ...r, grams: g, personalized: true };
  });
}
