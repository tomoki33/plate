import { describe, expect, it } from 'vitest';
import foods from '../data/foods.json';
import { rankFoods, shortName } from './foodSearch';

type Row = [string, string, string, number, number, number, number];
const all = (foods as unknown as Row[]).map((r) => ({ id: `food_${r[0]}`, name: r[2], source: '成分表' }));
const { expandQuery, matchesQuery, searchKey } = await import('./foodSearch');
/** 端末のSQL検索（search列のLIKE）と同じ条件で絞ってから、並べ替える */
const search = (q: string, limit = 30) => {
  const ex = expandQuery(q);
  return rankFoods(q, all.filter((f) => matchesQuery(searchKey(f.name), ex)), limit).map((f) => shortName(f.name));
};

describe('食品検索の実データ', () => {
  it('日常の言い方で、成分表にある食品が見つかる', () => {
    const cases: [string, RegExp][] = [
      ['味噌', /米みそ/], ['白菜', /^はくさい/], ['ツナ', /缶詰/], ['唐揚げ', /から揚げ/], ['餃子', /ぎょうざ/],
      ['サラダ油', /調合油|なたね油/], ['牛もも', /^うし.*もも/], ['豚バラ', /^ぶた.*ばら/], ['焼き鮭', /しろさけ.*焼き/],
      ['ほうれん草', /ほうれんそう/], ['日本酒', /清酒/], ['ラーメン', /中華めん/], ['牡蠣', /^かき/], ['海老', /えび/],
      ['醤油', /しょうゆ/], ['きなこ', /きな粉/], ['厚揚げ', /生揚げ/], ['パイナップル', /パインアップル/], ['春雨', /はるさめ/],
    ];
    for (const [q, re] of cases) {
      const r = search(q);
      expect(r.length, q).toBeGreaterThan(0);
      expect(r[0], `${q} → ${r[0]}`).toMatch(re);
    }
  });

  it('偶然の一致は出ない（鯖→キャッサバ、ツナ→こまつな）', () => {
    expect(search('鯖').some((n) => n.includes('キャッサバ'))).toBe(false);
    expect(search('ツナ').some((n) => n.includes('こまつな'))).toBe(false);
    expect(search('さば')[0]).toMatch(/さば/);
  });

  it('基本の食品が先頭に来る', () => {
    expect(search('ごはん')[0]).toContain('精白米');
    expect(search('卵')[0]).toBe('鶏卵 全卵 生');
    expect(search('鶏むね')[0]).toContain('むね');
    expect(search('バナナ')[0]).toBe('バナナ 生');
    expect(search('りんご')[0]).toMatch(/^りんご/);
  });

  it('部位・状態の違いを、まとめて探せる／加工品は生より後', () => {
    expect(search('鮭').length).toBeGreaterThan(4);
    expect(search('ささみ').length).toBeGreaterThan(2);
    expect(search('鶏むね').length).toBeGreaterThan(3);
    expect(search('チーズ').length).toBeGreaterThan(3);
    expect(search('きのこ').length).toBeGreaterThan(4);
    expect(search('いか')[0]).toMatch(/いか/);
    expect(search('いか')[0]).not.toMatch(/いかなご/);
    expect(search('たい')[0]).toMatch(/まだい/);
    expect(search('りんご')[0]).toBe('りんご 皮なし 生');
  });

  it('名前の短い基本の項目が、但し書きの多い項目より先に来る', () => {
    const r = search('食パン');
    expect(r[0].length).toBeLessThanOrEqual(r[r.length - 1].length);
  });
});
