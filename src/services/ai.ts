import { parseQuantities } from '../domain/foodSearch';
import type { FoodItem } from '../domain/models';
import { searchFoodsDb } from '../db/repo';

/** 推定の1行。per100 が無いものは「見つからず」 */
export interface EstimateRow {
  token: string;
  name?: string;
  grams?: number;
  /** 100gあたり */
  per100?: { kcal: number; p: number; f: number; c: number };
  foodId?: string;
  /** 'table'：成分表・マイ食品と照合、'ai'：AIが数値まで推定 */
  origin?: 'table' | 'ai';
}

const AI_ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

/**
 * 文章 → 食品と量の推定。
 * AI_ENDPOINT（Supabase Edge Function）が設定されていればそちらへ。APIキーは端末に置かない。
 * 未設定・失敗時は、成分表との照合（ローカル）で推定する。どちらも確認画面を必ず挟む。
 */
export async function estimateMeal(text: string, getToken?: () => Promise<string | null>): Promise<EstimateRow[]> {
  if (AI_ENDPOINT) {
    try {
      return await estimateRemote(text, getToken);
    } catch {
      // 通信できないときはローカル推定に切り替える
    }
  }
  return estimateLocal(text);
}

export async function estimateLocal(text: string, search: (q: string) => Promise<FoodItem[]> = (q) => searchFoodsDb(q, 1)): Promise<EstimateRow[]> {
  const rows: EstimateRow[] = [];
  for (const q of parseQuantities(text)) {
    const [food] = await search(q.word);
    if (!food) {
      rows.push({ token: q.word });
      continue;
    }
    const grams = q.grams ?? (q.count !== undefined ? Math.round(q.count * (food.unitG ?? food.defaultG ?? 100)) : (food.defaultG ?? 100));
    rows.push({ token: q.word, name: food.name, grams, per100: { kcal: food.kcal, p: food.p, f: food.f, c: food.c }, foodId: food.id, origin: 'table' });
  }
  return rows;
}

interface RemoteItem {
  name: string;
  grams: number;
  kcal: number;
  p: number;
  f: number;
  c: number;
}

async function estimateRemote(text: string, getToken?: () => Promise<string | null>): Promise<EstimateRow[]> {
  const token = getToken ? await getToken() : null;
  const res = await fetch(AI_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`estimate failed: ${res.status}`);
  const json = (await res.json()) as { items?: RemoteItem[] };
  if (!Array.isArray(json.items)) throw new Error('invalid response');
  return json.items
    .filter((i) => typeof i.grams === 'number' && i.grams > 0 && [i.kcal, i.p, i.f, i.c].every((n) => typeof n === 'number' && n >= 0))
    .map((i) => ({
      token: i.name,
      name: i.name,
      grams: Math.round(i.grams),
      per100: { kcal: (i.kcal / i.grams) * 100, p: (i.p / i.grams) * 100, f: (i.f / i.grams) * 100, c: (i.c / i.grams) * 100 },
      origin: 'ai' as const,
    }));
}
