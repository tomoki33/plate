/**
 * 食品検索の正規化と別名辞書（純粋関数）。
 * 成分表の名前は「にわとり ［若どり・主品目］ むね 皮なし 生」のような表記なので、
 * 「鶏むね」「ごはん」のような日常の言い方を、成分表の語に言い換えて検索する。
 */

/** カタカナ→ひらがな、全角→半角、大文字→小文字をそろえる */
export function fold(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
}

/** 検索用のキー（空白・括弧を除いて、かなをそろえる） */
export function searchKey(name: string): string {
  return fold(name).replace(/[\s　［］\[\]（）()＜＞<>・]/g, '');
}

/** 言い換え：キー（日常の言い方）→ 成分表の語のAND条件（いずれかに一致） */
const RAW_SYNONYMS: Record<string, string[][]> = {
  鶏むね: [['にわとり', '若どり', 'むね', '皮なし', '生']],
  とりむね: [['にわとり', '若どり', 'むね', '皮なし', '生']],
  むね肉: [['にわとり', '若どり', 'むね', '皮なし', '生']],
  鶏胸: [['にわとり', '若どり', 'むね', '皮なし', '生']],
  チキン: [['にわとり', '若どり', 'むね', '皮なし', '生']],
  鶏もも: [['にわとり', '若どり', 'もも', '皮なし', '生']],
  もも肉: [['にわとり', '若どり', 'もも', '皮なし', '生']],
  ささみ: [['にわとり', '若どり', 'ささみ', '生']],
  鶏: [['にわとり']],
  米: [['水稲めし', '精白米', 'うるち米']],
  ごはん: [['水稲めし', '精白米', 'うるち米']],
  ご飯: [['水稲めし', '精白米', 'うるち米']],
  白米: [['水稲めし', '精白米', 'うるち米']],
  玄米: [['水稲めし', '玄米']],
  卵: [['鶏卵', '全卵', '生']],
  たまご: [['鶏卵', '全卵', '生']],
  玉子: [['鶏卵', '全卵', '生']],
  生卵: [['鶏卵', '全卵', '生']],
  ゆで卵: [['鶏卵', '全卵', 'ゆで']],
  納豆: [['糸引き納豆']],
  バナナ: [['バナナ', '生']],
  オーツ: [['オートミール']],
  牛乳: [['普通牛乳']],
  ミルク: [['普通牛乳']],
  パン: [['食パン']],
  食パン: [['角形食パン', '食パン']],
  鮭: [['しろさけ', '生']],
  サケ: [['しろさけ', '生']],
  しゃけ: [['しろさけ', '生']],
  鯖: [['さば']],
  豚: [['ぶた']],
  牛: [['うし']],
  パスタ: [['スパゲッティ', 'ゆで']],
  スパゲッティ: [['スパゲッティ', 'ゆで']],
  芋: [['さつまいも', '皮なし', '蒸し']],
  さつまいも: [['さつまいも', '皮なし', '蒸し']],
  ブロッコリー: [['ブロッコリー', '花序', '生']],
  ヨーグルト: [['ヨーグルト', '全脂無糖']],
  チーズ: [['プロセスチーズ']],
  アーモンド: [['アーモンド', '乾']],
  オリーブオイル: [['オリーブ油']],
  海苔: [['あまのり', '焼きのり']],
  のり: [['あまのり', '焼きのり']],
};
const SYNONYMS: Record<string, string[][]> = Object.fromEntries(
  Object.entries(RAW_SYNONYMS).map(([k, v]) => [fold(k), v.map((and) => and.map(fold))]),
);

/** 「よく使う」順の食品番号（既定gと1個あたりgつき）。空検索のときの候補と検索結果の並びに使う */
export interface PopularFood {
  code: string;
  defaultG: number;
  unitG?: number;
}
export const POPULAR_FOODS: PopularFood[] = [
  { code: '11220', defaultG: 150 },
  { code: '11227', defaultG: 100, unitG: 50 },
  { code: '11224', defaultG: 150 },
  { code: '01088', defaultG: 150, unitG: 150 },
  { code: '01085', defaultG: 150, unitG: 150 },
  { code: '12004', defaultG: 50, unitG: 50 },
  { code: '12005', defaultG: 50, unitG: 50 },
  { code: '04046', defaultG: 45, unitG: 45 },
  { code: '07107', defaultG: 100, unitG: 100 },
  { code: '01004', defaultG: 40 },
  { code: '10156', defaultG: 100 },
  { code: '10134', defaultG: 100 },
  { code: '04032', defaultG: 150 },
  { code: '13003', defaultG: 200, unitG: 200 },
  { code: '13025', defaultG: 100 },
  { code: '01026', defaultG: 60, unitG: 60 },
  { code: '02007', defaultG: 150 },
  { code: '06263', defaultG: 80 },
  { code: '01039', defaultG: 200 },
  { code: '01064', defaultG: 200 },
  { code: '11126', defaultG: 100 },
  { code: '11020', defaultG: 100 },
  { code: '05001', defaultG: 20 },
  { code: '13040', defaultG: 20 },
  { code: '04052', defaultG: 200, unitG: 200 },
  { code: '01111', defaultG: 100, unitG: 100 },
];
export const POPULAR_BY_CODE: Record<string, PopularFood> = Object.fromEntries(POPULAR_FOODS.map((p) => [p.code, p]));

/** 最初から入れておく「マイ食品」（成分表にないもの） */
export const SEED_MY_FOODS = [
  { key: 'protein', name: 'プロテイン（ホエイ）', kcal: 400, p: 80, f: 6, c: 8, defaultG: 30, unitG: 30 },
  { key: 'miso-soup', name: '味噌汁（豆腐・わかめ）', kcal: 25, p: 1.9, f: 0.9, c: 2.0, defaultG: 180, unitG: 180 },
  { key: 'salad-chicken', name: 'サラダチキン', kcal: 114, p: 23.8, f: 1.6, c: 0.3, defaultG: 110, unitG: 110 },
] as const;
/** マイ食品の検索名（成分表にない言い方を拾う） */
export const MY_FOOD_ALIASES: Record<string, string[]> = {
  protein: ['プロテイン', 'ホエイ', 'ソイプロテイン'],
  'miso-soup': ['味噌汁', 'みそ汁', 'おみそ汁'],
  'salad-chicken': ['サラダチキン'],
};

export type Clause = string[]; // AND
export type TokenClauses = Clause[]; // OR

/**
 * 検索語を、トークンごとの「OR of AND」に展開する。
 * 例: 「鶏むね 皮」→ [ [[にわとり,若どり,むね,皮なし,生], [鶏むね]], [[皮]] ]
 * 全トークンを満たす食品（各トークンはいずれかの条件を満たす）が結果になる。
 */
export function expandQuery(query: string): TokenClauses[] {
  return fold(query)
    .split(/[\s　、,，]+/)
    .filter(Boolean)
    .map((tok) => {
      const alt: TokenClauses = [[tok.replace(/[\s　［］\[\]（）()＜＞<>・]/g, '')]];
      const syn = SYNONYMS[tok] ?? SYNONYMS[tok.replace(/肉$/, '')];
      if (syn) alt.unshift(...syn);
      return alt;
    });
}

/** テスト・メモリ検索用。search キーが全トークンを満たすか */
export function matchesQuery(key: string, expanded: TokenClauses[]): boolean {
  return expanded.every((alts) => alts.some((and) => and.every((t) => key.includes(t))));
}

// ---- 文章入力（AI入力のローカル推定）用 ----

export interface Quantity {
  /** 食品名に当たる部分 */
  word: string;
  grams?: number;
  count?: number;
}

const UNIT_RE = /(\d+(?:\.\d+)?)\s*(g|グラム|ｇ|個|枚|杯|本|パック|切れ|袋)?/i;

/** 「鶏むね200g」「卵2個」「米 150g」を、食品名と量に分ける */
export function parseQuantities(text: string): Quantity[] {
  const parts = text
    .normalize('NFKC')
    .split(/[\s、,，・+＋\n]+/)
    .filter(Boolean);
  const out: Quantity[] = [];
  for (let i = 0; i < parts.length; i++) {
    const tok = parts[i];
    const m = tok.match(UNIT_RE);
    if (m && m[0].length === tok.length && out.length) {
      // 「米」「150g」のように量だけの語は、直前の食品にかける
      applyQty(out[out.length - 1], m);
      continue;
    }
    const q: Quantity = { word: tok.replace(UNIT_RE, '').trim() || tok };
    if (m) applyQty(q, m);
    out.push(q);
  }
  return out;
}
function applyQty(q: Quantity, m: RegExpMatchArray) {
  const n = parseFloat(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  if (u === 'g' || u === 'グラム' || u === 'ｇ') q.grams = Math.round(n);
  else if (u) q.count = n;
  else q.grams = Math.round(n);
}

/**
 * 成分表の名前を、画面に出しやすい形にする。
 * 先頭の分類（（さけ・ます類）など）を外し、［］は中身を残して記号だけ外す。
 * 例: 「にわとり ［若どり・主品目］ むね 皮なし 生」→「にわとり 若どり・主品目 むね 皮なし 生」
 */
export function shortName(name: string): string {
  return name
    .replace(/^[（(][^）)]*[）)]\s*/, '')
    .replace(/[［\[]([^］\]]*)[］\]]/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const SLOT_LABEL: Record<string, string> = { 朝: '朝ごはん', 昼: '昼ごはん', 間食: '間食', 夜: '夜ごはん' };
