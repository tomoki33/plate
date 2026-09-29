import { describe, expect, it } from 'vitest';
import foods from '../data/foods.json';
import { CATALOG, catalogFoodId, catalogSearchText, expandQuery, findCatalogInQuery, matchesQuery, rankFoods, searchKey } from './foodSearch';

describe('食品カタログのデータ', () => {
  it('key が重複せず、名前がある', () => {
    const keys = CATALOG.map((r) => r[0]);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of CATALOG) expect(r[1].length).toBeGreaterThan(0);
  });
  it('100gあたりの値が、PFCからのカロリーと大きくずれない', () => {
    const ALCOHOL = new Set(['beer', 'wine', 'sake']); // アルコールは 7kcal/g で、PFC からは出ない
    for (const [key, , , kcal, p, f, c] of CATALOG) {
      if (ALCOHOL.has(key)) continue;
      const calc = 4 * p + 9 * f + 4 * c;
      // 成分表のエネルギーは組成と完全には一致しない（食物繊維・アルコール等）。大きなずれだけ見る
      expect(Math.abs(kcal - calc), `${key}: ${kcal}kcal vs P/F/C から ${calc.toFixed(0)}kcal`).toBeLessThanOrEqual(Math.max(25, kcal * 0.35));
      expect(kcal).toBeLessThanOrEqual(900);
    }
  });
  it('既定gが正の数', () => {
    for (const r of CATALOG) expect(r[7]).toBeGreaterThan(0);
  });
});

/** 「AI・利用者が入れそうな名前」→ 期待するカタログの key。文中の余計な言葉があっても引けること */
const CASES: [string, string][] = [
  ['鶏むね肉', 'chicken_breast_skinless'],
  ['鶏むね肉(皮なし)', 'chicken_breast_skinless'],
  ['鶏むね肉（皮つき）', 'chicken_breast_skin'],
  ['鶏胸肉', 'chicken_breast_skinless'],
  ['鶏もも肉', 'chicken_thigh_skinless'],
  ['ささみ', 'chicken_sasami'],
  ['白いご飯', 'rice'],
  ['茶碗一杯のご飯', 'rice'],
  ['玄米ごはん', 'brown_rice'],
  ['豆腐の味噌汁', 'miso_soup'],
  ['味噌汁', 'miso_soup'],
  ['鮭の塩焼き', 'salmon_grilled'],
  ['焼き鮭', 'salmon_grilled'],
  ['スクランブルエッグ', 'scrambled_egg'],
  ['豚の生姜焼き', 'shogayaki'],
  ['鶏の唐揚げ', 'karaage'],
  ['グリーンサラダ', 'lettuce'],
  ['茹でブロッコリー', 'broccoli'],
  ['冷奴', 'tofu_kinu'],
  ['牛丼', 'gyudon'],
  ['カレーライス', 'curry_rice'],
  ['醤油ラーメン', 'ramen_shoyu'],
  ['焼き餃子', 'gyoza'],
  ['握り寿司', 'sushi_nigiri'],
  ['塩むすび', 'onigiri'],
  ['トースト', 'bread'],
  ['プレーンヨーグルト', 'yogurt'],
  ['プロテイン', 'protein'],
  ['ほうれん草のおひたし', 'spinach'],
  ['サラダチキン', 'salad_chicken'],
  ['マグロの刺身', 'tuna_akami'],
  ['鯖の塩焼き', 'mackerel_grilled'],
  ['野菜炒め', 'yasai_itame'],
  ['卵かけご飯', 'tamagokake'],
  ['オムライス', 'omurice'],
  ['チャーハン', 'chahan'],
  ['ミートソーススパゲッティ', 'spaghetti_meat'],
  ['サンドイッチ', 'sandwich_egg'],
  ['ポテトサラダ', 'potato_salad'],
  ['千切りキャベツ', 'cabbage'],
  ['ブラックコーヒー', 'coffee'],
  ['ちくわ', 'chikuwa'],
  ['寿司', 'sushi_nigiri'],
  ['焼きそば', 'yakisoba'],
  ['ナッツ', 'almond'],
];

describe('findCatalogInQuery（文中の名前・別名を拾う）', () => {
  it.each(CASES)('%s → %s', (q, key) => {
    expect(findCatalogInQuery(q)).toBe(catalogFoodId(key));
  });
  it('1文字の別名（米・油）は、その語だけのときしか使わない', () => {
    expect(findCatalogInQuery('米')).toBe(catalogFoodId('rice'));
    expect(findCatalogInQuery('米粉パン')).not.toBe(catalogFoodId('rice'));
  });
  it('カタログにないものは null', () => {
    expect(findCatalogInQuery('タンドリー')).toBeNull();
    expect(findCatalogInQuery('')).toBeNull();
  });
});

describe('検索（カタログを先頭に）', () => {
  const table = (foods as [string, string, string, number, number, number, number][]).map((r) => ({ id: `food_${r[0]}`, name: r[2], source: '成分表' as const, search: searchKey(r[2]) }));
  const cat = CATALOG.map((r) => ({ id: catalogFoodId(r[0]), name: r[1], source: 'カタログ' as const, search: catalogSearchText(r) }));
  const all = [...cat, ...table];
  const top = (q: string) => rankFoods(q, all.filter((f) => matchesQuery(f.search, expandQuery(q))), 1)[0]?.id;
  it.each([
    ['胸肉', 'chicken_breast_skinless'],
    ['むね肉', 'chicken_breast_skinless'],
    ['ごはん', 'rice'],
    ['ツナ', 'tuna_can'],
    ['ちくわ', 'chikuwa'],
    ['唐揚げ', 'karaage'],
    ['寿司', 'sushi_nigiri'],
    ['ヨーグルト', 'yogurt'],
  ])('%s → 先頭は %s', (q, key) => {
    expect(top(q)).toBe(catalogFoodId(key));
  });
});
