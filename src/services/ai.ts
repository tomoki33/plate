import { getFoodsByIds, searchFoodsDb, searchFoodsSmart } from '../db/repo';
import { catalogFoodId, findCatalogInQuery, parseQuantities, relevance } from '../domain/foodSearch';
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
  /** 'table'：文章と成分表の照合、'ai'：AIが文章から推定、'photo'：写真から推定、'estimate'：カタログにないので値もAIの目安、'manual'：利用者が追加・差し替え */
  origin?: 'table' | 'ai' | 'photo' | 'estimate' | 'manual';
}

export interface EstimateResult {
  rows: EstimateRow[];
  /** ログインが必要で推定できなかった（画面に「ログインする」を出す） */
  needsLogin?: boolean;
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
    // 写真の推定はサーバー（ログイン済みの人だけ受け付ける）で行う。ログインしていなければ、通信せずに理由を伝える
    const token = getToken ? await getToken() : null;
    if (!token && input.photo) {
      return { rows: [], needsLogin: true, error: '写真の推定には、ログインが必要です。ログインするか、食べたものを文章で書いてください（文章はログインなしでも推定できます）。' };
    }
    try {
      return { rows: await estimateRemote(text, input.photo, getToken) };
    } catch (e) {
      if (input.photo) return { rows: [], ...photoErrorMessage(e) };
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

export async function estimateLocal(text: string, search: (q: string) => Promise<FoodItem[]> = (q) => searchFoodsSmart(q, 1)): Promise<EstimateRow[]> {
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
  for (const b of base) rows.push(await resolve(b.q, /半分/.test(text) && b.q === 'ごはん' ? b.g / 2 : b.g, 'photo', (q) => searchFoodsSmart(q, 1)));
  // ひとことで足された食品
  if (text) for (const r of await estimateLocal(text)) if (r.foodId && !rows.some((x) => x.foodId === r.foodId)) rows.push({ ...r, origin: 'photo' });
  return rows;
}

/** サーバーが返した失敗（ステータスで原因を分けて、画面に出す） */
class EstimateHttpError extends Error {
  constructor(public status: number) {
    super(`estimate failed: ${status}`);
  }
}

/** 写真の推定に失敗したときの、画面に出す文（原因が分かるもの。番号は、問い合わせのときの手がかり） */
export function photoErrorMessage(e: unknown): { error: string; needsLogin?: boolean } {
  const status = e instanceof EstimateHttpError ? e.status : null;
  if (status === 401) return { error: 'ログインの有効期限が切れたようです。もう一度ログインしてください。', needsLogin: true };
  if (status === 429) return { error: '今日の推定の回数を使い切りました。明日また使えます。' };
  if (status === 503) return { error: '現在、写真の推定が混み合っています。しばらくしてからお試しください。食べたものを文章で書くと、推定できます。' };
  if (status === 413) return { error: '写真が大きすぎて送れませんでした。撮り直すか、文章で書いてください。' };
  if (status !== null) return { error: `推定に失敗しました（エラー ${status}）。少し待って、もう一度お試しください。` };
  return { error: '通信できませんでした。電波の良い場所で、もう一度お試しください。' };
}

interface RemoteItem {
  /** カタログの key（AIが一覧から選んだもの）。無ければ null */
  key?: string | null;
  name: string;
  grams: number;
  /** カタログにないときだけ、AIが出す100gあたりの目安 */
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** AIの返した1品を、カタログ → 名前の検索 → AIの目安の順で、食品に結びつける */
async function resolveRemote(i: RemoteItem, origin: EstimateRow['origin']): Promise<EstimateRow> {
  const grams = Math.max(1, Math.round(i.grams));
  const row = (food: FoodItem): EstimateRow => ({ token: i.name, name: food.name, grams, per100: { kcal: food.kcal, p: food.p, f: food.f, c: food.c }, foodId: food.id, origin });
  // 1. AIが選んだカタログの食品
  const id = i.key ? catalogFoodId(i.key) : findCatalogInQuery(i.name);
  if (id) {
    const [food] = await getFoodsByIds([id]);
    if (food) return row(food);
  }
  // 2. 名前の検索。合い具合が高いものだけ採る（「ちくわ」→「ちくわぶ」のような偶然の一致は採らない）
  const [hit] = await searchFoodsDb(i.name, 1);
  if (hit && (hit.source === 'カタログ' || relevance(i.name, hit.name) <= 1)) return row(hit);
  // 3. カタログにない：AIの目安の値で残す（除外しない。確認画面で直せる）
  if (num(i.kcal) && num(i.protein) && num(i.fat) && num(i.carbs) && i.kcal <= 950) {
    return { token: i.name, name: i.name, grams, per100: { kcal: i.kcal, p: i.protein, f: i.fat, c: i.carbs }, origin: 'estimate' };
  }
  // 4. 値も無いときは、弱い一致でもあれば使う
  if (hit) return row(hit);
  return { token: i.name };
}

async function estimateRemote(text: string, photo: PickedPhoto | null, getToken?: () => Promise<string | null>): Promise<EstimateRow[]> {
  const token = getToken ? await getToken() : null;
  const res = await fetch(AI_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ text, image_base64: photo?.base64, media_type: photo?.base64 ? 'image/jpeg' : undefined }),
  });
  if (!res.ok) throw new EstimateHttpError(res.status);
  const json = (await res.json()) as { items?: RemoteItem[] };
  if (!Array.isArray(json.items)) throw new Error('invalid response');
  const items = json.items.filter((i) => typeof i.name === 'string' && typeof i.grams === 'number' && i.grams > 0 && i.grams <= 3000);
  const origin = photo ? 'photo' : 'ai';
  const rows: EstimateRow[] = [];
  for (const i of items) rows.push(await resolveRemote(i, origin));
  return rows;
}
