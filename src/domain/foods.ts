import type { Pfc } from './types';

export interface Food {
  id: string;
  name: string;
  /** 100gあたり */
  kcal: number;
  P: number;
  F: number;
  C: number;
  /** 検索・文章入力で使う別名 */
  aliases: string[];
  /** 既定のg */
  defaultG: number;
  /** 1個・1枚などの重さ(g) */
  unitG?: number;
  source?: string;
}

/** 日本食品標準成分表（八訂）から抜粋。全件は後続で成分表データを取り込む。 */
export const FOODS: Food[] = [
  { id: 'chicken', name: '鶏むね肉（皮なし）', kcal: 105, P: 23.3, F: 1.9, C: 0.1, aliases: ['鶏むね', 'むね肉', '鶏胸', 'チキン'], defaultG: 150 },
  { id: 'sasami', name: 'ささみ', kcal: 98, P: 23.9, F: 0.8, C: 0.1, aliases: ['ささみ'], defaultG: 100, unitG: 50 },
  { id: 'rice', name: 'ごはん（精白米）', kcal: 156, P: 2.5, F: 0.3, C: 37.1, aliases: ['米', 'ごはん', 'ご飯', '白米'], defaultG: 150, unitG: 150 },
  { id: 'egg', name: '鶏卵', kcal: 142, P: 12.2, F: 10.2, C: 0.4, aliases: ['卵', 'たまご', '玉子'], defaultG: 50, unitG: 50 },
  { id: 'natto', name: '納豆', kcal: 190, P: 16.5, F: 10.0, C: 12.1, aliases: ['納豆'], defaultG: 45, unitG: 45 },
  { id: 'banana', name: 'バナナ', kcal: 93, P: 1.1, F: 0.2, C: 22.5, aliases: ['バナナ'], defaultG: 100, unitG: 100 },
  { id: 'oat', name: 'オートミール', kcal: 350, P: 13.7, F: 5.7, C: 69.1, aliases: ['オートミール', 'オーツ'], defaultG: 40 },
  { id: 'saba', name: 'まさば（焼き）', kcal: 264, P: 25.2, F: 17.0, C: 0.3, aliases: ['さば', 'サバ', '鯖'], defaultG: 100 },
  { id: 'tofu', name: '木綿豆腐', kcal: 73, P: 7.0, F: 4.9, C: 1.5, aliases: ['豆腐'], defaultG: 150 },
  { id: 'miso', name: '味噌汁（豆腐・わかめ）', kcal: 25, P: 1.9, F: 0.9, C: 2.0, aliases: ['味噌汁', 'みそ汁'], defaultG: 180 },
  { id: 'milk', name: '牛乳', kcal: 61, P: 3.3, F: 3.8, C: 4.8, aliases: ['牛乳'], defaultG: 200 },
  { id: 'protein', name: 'プロテイン（ホエイ）', kcal: 400, P: 80, F: 6, C: 8, aliases: ['プロテイン'], defaultG: 30, source: 'マイ食品' },
  { id: 'bread', name: '食パン', kcal: 248, P: 8.9, F: 4.1, C: 46.4, aliases: ['食パン', 'パン'], defaultG: 60, unitG: 60 },
  { id: 'imo', name: 'さつまいも（蒸し）', kcal: 131, P: 1.2, F: 0.2, C: 31.9, aliases: ['さつまいも', '芋'], defaultG: 150 },
];

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]));

export function calcPfc(items: [id: string, grams: number][]): Pfc {
  const r = { kcal: 0, P: 0, F: 0, C: 0 };
  for (const [id, g] of items) {
    const f = FOOD_BY_ID[id];
    if (!f) continue;
    (['kcal', 'P', 'F', 'C'] as const).forEach((k) => (r[k] += (f[k] * g) / 100));
  }
  return { kcal: Math.round(r.kcal), P: Math.round(r.P), F: Math.round(r.F), C: Math.round(r.C) };
}

export function searchFoods(query: string, limit = 8): Food[] {
  const q = query.trim();
  return FOODS.filter((f) => !q || f.name.includes(q) || f.aliases.some((a) => a.includes(q) || q.includes(a))).slice(0, limit);
}

export interface MySet {
  name: string;
  items: [string, number][];
  postWorkout?: boolean;
}
export const MY_SETS: MySet[] = [
  { name: 'トレ後：プロテイン＋バナナ', items: [['protein', 30], ['banana', 100]], postWorkout: true },
  { name: '鶏むね200g・米250g', items: [['chicken', 200], ['rice', 250]] },
  { name: '納豆ごはん＋卵', items: [['natto', 45], ['rice', 200], ['egg', 50]] },
  { name: 'ささみ＋さつまいも', items: [['sasami', 150], ['imo', 200]] },
];
