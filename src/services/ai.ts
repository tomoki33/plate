import { searchFoodsDb } from '../db/repo';
import { parseQuantities } from '../domain/foodSearch';
import type { FoodItem } from '../domain/models';
import type { PickedPhoto } from './photos';

/** 推定の1行。per100 が無いものは「見つからず」 */
export interface EstimateRow {
  token: string;
  name?: string;
  grams?: number;
  /** 100gあたり（成分表・マイ食品の値。AIには直接PFCを出させない） */
  per100?: { kcal: number; p: number; f: number; c: number };
  foodId?: string;
  /** 'table'：文章と成分表の照合、'ai'：AIが文章から推定、'photo'：写真から推定、'manual'：利用者が追加・差し替え */
  origin?: 'table' | 'ai' | 'photo' | 'manual';
}

export interface EstimateResult {
  rows: EstimateRow[];
  /** 推定できなかった理由（画面に出す） */
  error?: string;
}

const AI_ENDPOINT = process.env.EXPO_PUBLIC_AI_ENDPOINT;

/** 通信できない開発ビルドで、写真の流れを試すための模擬（AIの設定がないときだけ） */
const DEV_PHOTO_MOCK = __DEV__ && !AI_ENDPOINT;

/**
 * 写真と文章（どちらか、または両方）から、食品ごとの {名前, g} を推定し、PFCは成分表の値から計算する。
 * AI_ENDPOINT（Supabase Edge Function）があればそこへ送る。APIキーは端末に置かない。
 * 設定がないときは、文章を成分表と照合して推定する（写真は AI が要るので、推定できない）。
 * どちらの場合も、追加する前に確認画面を必ず挟む。
 */
export async function estimateMeal(input: { text: string; photo: PickedPhoto | null }, getToken?: () => Promise<string | null>): Promise<EstimateResult> {
  const text = input.text.trim();
  if (AI_ENDPOINT) {
    try {
      return { rows: await estimateRemote(text, input.photo, getToken) };
    } catch {
      if (input.photo) return { rows: [], error: '通信できませんでした。もう一度お試しください。' };
      // 文章だけなら、通信できないときはローカルの照合に切り替える
    }
  }
  if (input.photo) {
    if (DEV_PHOTO_MOCK) return { rows: await sampleFromPhoto(text) };
    return { rows: [], error: '写真の推定には、AIの設定が必要です。食べたものを文章で書くと、推定できます。' };
  }
  return { rows: await estimateLocal(text) };
}

/** 名前を成分表・マイ食品に当てて、g と 100gあたりの値を持つ行にする */
async function resolve(name: string, grams: number, origin: EstimateRow['origin'], search: (q: string) => Promise<FoodItem[]>): Promise<EstimateRow> {
  const [food] = await search(name);
  if (!food) return { token: name };
  return { token: name, name: food.name, grams: Math.max(1, Math.round(grams)), per100: { kcal: food.kcal, p: food.p, f: food.f, c: food.c }, foodId: food.id, origin };
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

/** 開発用：サンプル写真の推定（鶏むね・ごはん・味噌汁）。「米は半分」と書けば、ごはんが半分になる */
async function sampleFromPhoto(text: string): Promise<EstimateRow[]> {
  const base = [{ q: '鶏むね', g: 150 }, { q: 'ごはん', g: 200 }, { q: '味噌汁', g: 180 }];
  const rows: EstimateRow[] = [];
  for (const b of base) rows.push(await resolve(b.q, /半分/.test(text) && b.q === 'ごはん' ? b.g / 2 : b.g, 'photo', (q) => searchFoodsDb(q, 1)));
  // ひとことで足された食品
  if (text) for (const r of await estimateLocal(text)) if (r.foodId && !rows.some((x) => x.foodId === r.foodId)) rows.push({ ...r, origin: 'photo' });
  return rows;
}

interface RemoteItem {
  name: string;
  grams: number;
}

async function estimateRemote(text: string, photo: PickedPhoto | null, getToken?: () => Promise<string | null>): Promise<EstimateRow[]> {
  const token = getToken ? await getToken() : null;
  const res = await fetch(AI_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, image_base64: photo?.base64, media_type: photo?.base64 ? 'image/jpeg' : undefined }),
  });
  if (!res.ok) throw new Error(`estimate failed: ${res.status}`);
  const json = (await res.json()) as { items?: RemoteItem[] };
  if (!Array.isArray(json.items)) throw new Error('invalid response');
  const items = json.items.filter((i) => typeof i.name === 'string' && typeof i.grams === 'number' && i.grams > 0 && i.grams <= 3000);
  const origin = photo ? 'photo' : 'ai';
  // PFC は AI に出させず、成分表・マイ食品の値から計算する
  const rows: EstimateRow[] = [];
  for (const i of items) rows.push(await resolve(i.name, i.grams, origin, (q) => searchFoodsDb(q, 1)));
  return rows;
}
