import { describe, expect, it } from 'vitest';
import foods from '../data/foods.json';
import { expandQuery, fold, matchesQuery, parseQuantities, POPULAR_FOODS, searchKey } from './foodSearch';

type Row = [string, string, string, number, number, number, number];
const rows = foods as Row[];
const keyed = rows.map((r) => ({ r, key: searchKey(r[2]) }));
const find = (q: string) => keyed.filter((x) => matchesQuery(x.key, expandQuery(q))).map((x) => x.r);

describe('成分表データ', () => {
  it('八訂の全品目（2,478）が入っている', () => {
    expect(rows.length).toBe(2478);
  });
  it('食品番号は重複しない', () => {
    expect(new Set(rows.map((r) => r[0])).size).toBe(rows.length);
  });
  it('鶏むね肉（皮なし・若どり）の値が成分表どおり', () => {
    const r = rows.find((x) => x[0] === '11220')!;
    expect(r.slice(3)).toEqual([105, 23.3, 1.9, 0.1]);
  });
  it('「よく使う」食品の番号がすべて存在する', () => {
    const codes = new Set(rows.map((r) => r[0]));
    POPULAR_FOODS.forEach((p) => expect(codes.has(p.code), p.code).toBe(true));
  });
});

describe('検索', () => {
  it('かな・全半角をそろえる', () => {
    expect(fold('ＢＡＮＡＮＡ')).toBe('banana');
    expect(fold('バナナ')).toBe('ばなな');
  });
  it('「鶏むね」で鶏むね肉（皮なし）が出る', () => {
    expect(find('鶏むね').map((r) => r[0])).toContain('11220');
  });
  it('「ごはん」で精白米のごはんが出る', () => {
    expect(find('ごはん').map((r) => r[0])).toContain('01088');
    expect(find('ご飯')[0][0]).toBe('01088');
  });
  it('「卵」「たまご」「玉子」がすべて鶏卵の全卵（生）に届く', () => {
    ['卵', 'たまご', '玉子'].forEach((q) => expect(find(q).map((r) => r[0])).toContain('12004'));
  });
  it('カタカナ・ひらがなの違いを吸収する', () => {
    expect(find('さば').length).toBeGreaterThan(0);
    expect(find('サバ').map((r) => r[0])).toEqual(find('さば').map((r) => r[0]));
  });
  it('複数語はAND', () => {
    const r = find('さば 焼き');
    expect(r.length).toBeGreaterThan(0);
    r.forEach((x) => expect(x[2]).toContain('焼き'));
  });
  it('見つからない語は空', () => {
    expect(find('ぜったいにない食品名')).toEqual([]);
  });
});

describe('文章入力のパース', () => {
  it('食品名と量に分ける', () => {
    expect(parseQuantities('鶏むね200g 米150g 味噌汁')).toEqual([
      { word: '鶏むね', grams: 200 },
      { word: '米', grams: 150 },
      { word: '味噌汁' },
    ]);
  });
  it('個・枚・杯は個数として扱う', () => {
    expect(parseQuantities('卵2個 食パン1枚')).toEqual([
      { word: '卵', count: 2 },
      { word: '食パン', count: 1 },
    ]);
  });
  it('離れた量は直前の食品にかける（「米 150g」）', () => {
    expect(parseQuantities('鶏むね 200g 米 150g')).toEqual([
      { word: '鶏むね', grams: 200 },
      { word: '米', grams: 150 },
    ]);
  });
});

import { shortName } from './foodSearch';
describe('表示名', () => {
  it('［］は中身を残し、先頭の分類は外す', () => {
    expect(shortName('にわとり ［若どり・主品目］ むね 皮なし 生')).toBe('にわとり 若どり・主品目 むね 皮なし 生');
    expect(shortName('（さけ・ます類） しろさけ 生')).toBe('しろさけ 生');
    expect(shortName('鶏卵 全卵 生')).toBe('鶏卵 全卵 生');
  });
});
