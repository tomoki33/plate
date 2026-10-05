import { describe, expect, it } from 'vitest';
import evalData from '../../eval/foods.json';
import { candidateFoods, compareSnapshots, resolveFood, runEval, toSnapshot, type EvalCase } from './foodEval';

const cases = evalData.cases as EvalCase[];

describe('食品名の評価リスト', () => {
  it('同じ名前が重複しない', () => {
    expect(new Set(cases.map((c) => c.query)).size).toBe(cases.length);
  });
  it('命中率が下がっていない（下限 95%）', () => {
    const r = runEval(cases);
    expect(r.rate, r.rows.filter((x) => !x.hit).map((x) => `${x.query}→${x.got}`).join(', ')).toBeGreaterThanOrEqual(0.95);
  });
});

describe('評価の集計', () => {
  it('見つからない語は null（accept が空なら命中）', () => {
    expect(resolveFood('ぜったいにない食品名')).toBeNull();
    const r = runEval([{ query: 'ぜったいにない食品名', accept: [] }, { query: 'バナナ', accept: [] }]);
    expect(r.rows.map((x) => x.hit)).toEqual([true, false]);
  });
  it('区分ごとに数える', () => {
    const r = runEval([{ query: 'バナナ', accept: ['バナナ'], group: 'a' }, { query: 'りんご', accept: ['ばつ'], group: 'a' }]);
    expect(r.byGroup.a).toEqual({ total: 2, hits: 1 });
    expect(r.rate).toBe(0.5);
  });
  it('保存した結果と比べて、直った・悪化した名前が分かる', () => {
    const before = toSnapshot(runEval([{ query: 'バナナ', accept: ['ばつ'] }, { query: 'りんご', accept: ['りんご'] }]));
    const after = runEval([{ query: 'バナナ', accept: ['バナナ'] }, { query: 'りんご', accept: ['ばつ'] }]);
    const d = compareSnapshots(before, after);
    expect(d.fixed).toEqual(['バナナ']);
    expect(d.broken).toEqual(['りんご']);
  });
});

describe('端末の検索との一致', () => {
  it('初期のマイ食品が優先される（味噌汁→マイ食品の味噌汁）', () => {
    expect(resolveFood('味噌汁')).toMatchObject({ id: 'myfood_miso-soup', source: '自作' });
    expect(resolveFood('プロテイン')).toMatchObject({ id: 'myfood_protein' });
  });
  it('400件を超える広い語でも、打ち切る前に端末と同じ順に並べる', () => {
    const all = candidateFoods('生');
    expect(all).toHaveLength(400);
    const order = { 自作: 0, カタログ: 1, 成分表: 2 } as const;
    const tiers = all.map((f) => order[f.source]);
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    // カタログに合う行は、成分表の行より先に残る
    expect(all.some((f) => f.source === 'カタログ')).toBe(true);
  });
});
