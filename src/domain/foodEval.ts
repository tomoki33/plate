import catalogJson from '../data/catalog.json';
import foodsJson from '../data/foods.json';
import {
  catalogFoodId,
  catalogSearchText,
  expandQuery,
  findCatalogInQuery,
  matchesQuery,
  rankFoods,
  searchKey,
  shortName,
  type CatalogRow,
} from './foodSearch';

/**
 * 食品名の命中率を測る評価（純粋関数）。
 * 端末の searchFoodsSmart（src/db/repo.ts）と同じ手順を、DB なしでメモリ上の食品データに対して行う：
 *   1. 検索語を展開して絞り込み → rankFoods で並べ替え → 先頭1件
 *   2. 見つからなければ、文章に含まれるカタログの名前・別名で探し直す
 */

type FoodRow = [string, string, string, number, number, number, number];
interface Food {
  id: string;
  name: string;
  source: '成分表' | 'カタログ';
  key: string;
}

const FOODS: Food[] = [
  ...(foodsJson as unknown as FoodRow[]).map((r) => ({ id: `food_${r[0]}`, name: r[2], source: '成分表' as const, key: searchKey(r[2]) })),
  ...(catalogJson as CatalogRow[]).map((r) => ({ id: catalogFoodId(r[0]), name: r[1], source: 'カタログ' as const, key: catalogSearchText(r) })),
];
const BY_ID = new Map(FOODS.map((f) => [f.id, f]));

/** 検索語から、端末と同じ手順で食品を1件選ぶ。見つからなければ null */
export function resolveFood(query: string): { id: string; name: string; source: string } | null {
  const q = query.trim();
  if (!q) return null;
  const ex = expandQuery(q);
  const rows = FOODS.filter((f) => matchesQuery(f.key, ex)).slice(0, 400);
  const hit = rankFoods(q, rows, 1)[0];
  if (hit) return hit;
  const id = findCatalogInQuery(q);
  return (id && BY_ID.get(id)) || null;
}

export interface EvalCase {
  /** ユーザーが入力しそうな食品名（実在の個人の記録は使わない） */
  query: string;
  /** 正解とみなす食品名の正規表現（shortName 後の名前に対して）。どれか1つに合えば命中。空なら「見つからない」が正解 */
  accept: string[];
  /** 区分（集計用） */
  group?: string;
}

export interface EvalRow {
  query: string;
  group: string;
  hit: boolean;
  /** 先頭に出た食品名（なければ null） */
  got: string | null;
  accept: string[];
}

export interface EvalReport {
  total: number;
  hits: number;
  rate: number;
  rows: EvalRow[];
  byGroup: Record<string, { total: number; hits: number }>;
}

export function runEval(cases: EvalCase[]): EvalReport {
  const rows: EvalRow[] = cases.map((c) => {
    const r = resolveFood(c.query);
    const got = r ? shortName(r.name) : null;
    // accept が空なら「何も見つからない」が正解（存在しない語の誤ヒット確認用）
    const hit = c.accept.length === 0 ? got === null : got !== null && c.accept.some((re) => new RegExp(re).test(got));
    return { query: c.query, group: c.group ?? '(なし)', hit, got, accept: c.accept };
  });
  const byGroup: EvalReport['byGroup'] = {};
  for (const r of rows) {
    const g = (byGroup[r.group] ??= { total: 0, hits: 0 });
    g.total++;
    if (r.hit) g.hits++;
  }
  const hits = rows.filter((r) => r.hit).length;
  return { total: rows.length, hits, rate: rows.length ? hits / rows.length : 0, rows, byGroup };
}

/** 保存した結果（--save）と比べるための最小限の形 */
export interface Snapshot {
  total: number;
  hits: number;
  rate: number;
  /** query → 命中したか */
  results: Record<string, boolean>;
}

export const toSnapshot = (r: EvalReport): Snapshot => ({
  total: r.total,
  hits: r.hits,
  rate: r.rate,
  results: Object.fromEntries(r.rows.map((x) => [x.query, x.hit])),
});

export interface Diff {
  before: Snapshot;
  /** 外れていたのが命中になった */
  fixed: string[];
  /** 命中していたのが外れた */
  broken: string[];
}

export function compareSnapshots(before: Snapshot, after: EvalReport): Diff {
  const fixed: string[] = [];
  const broken: string[] = [];
  for (const r of after.rows) {
    const was = before.results[r.query];
    if (was === undefined) continue;
    if (!was && r.hit) fixed.push(r.query);
    if (was && !r.hit) broken.push(r.query);
  }
  return { before, fixed, broken };
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

