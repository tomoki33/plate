import { describe, expect, it } from 'vitest';
import { buildUsualGrams, personalizeRows, textStatesGrams } from './usualGrams';

const e = (foodId: string | null, grams: number | null, createdAt: number) => ({ foodId, grams, createdAt });

describe('buildUsualGrams', () => {
  it('1回だけなら、その量', () => {
    expect(buildUsualGrams([e('a', 180, 1)]).get('a')).toBe(180);
  });
  it('2回目以降は、同数なら直前の量', () => {
    expect(buildUsualGrams([e('a', 150, 1), e('a', 200, 2)]).get('a')).toBe(200);
    expect(buildUsualGrams([e('a', 200, 2), e('a', 150, 1)]).get('a')).toBe(200);
  });
  it('直近でいちばん多い量を選ぶ', () => {
    expect(buildUsualGrams([e('a', 150, 1), e('a', 150, 2), e('a', 200, 3)]).get('a')).toBe(150);
  });
  it('古い記録（直近5回より前）は見ない', () => {
    const old = [1, 2, 3].map((i) => e('a', 100, i));
    const recent = [4, 5, 6, 7, 8].map((i) => e('a', 250, i));
    expect(buildUsualGrams([...old, ...recent]).get('a')).toBe(250);
  });
  it('食品ごとに別、食品なし・量なしの行は無視', () => {
    const m = buildUsualGrams([e('a', 100, 1), e('b', 50, 2), e(null, 30, 3), e('c', null, 4), e('d', 0, 5)]);
    expect([...m.entries()]).toEqual([['a', 100], ['b', 50]]);
  });
});

describe('textStatesGrams', () => {
  it('量が書かれているときだけ true', () => {
    expect(textStatesGrams('鶏むね200g 米150g', 150)).toBe(true);
    expect(textStatesGrams('鶏むね200g 米', 150)).toBe(false);
    expect(textStatesGrams('米1150g', 150)).toBe(false);
  });
  it('全角の数字・単位でも量の指定とみなす', () => {
    expect(textStatesGrams('米１５０ｇ', 150)).toBe(true);
    expect(textStatesGrams('米　１５０グラム', 150)).toBe(true);
    expect(textStatesGrams('米150㌘', 150)).toBe(true);
    expect(textStatesGrams('米１１５０ｇ', 150)).toBe(false);
  });
});

describe('personalizeRows', () => {
  const usual = new Map([['rice', 180], ['egg', 60]]);
  it('文章に量がない行は前回の量にする', () => {
    const r = personalizeRows([{ foodId: 'rice', grams: 150, origin: 'table' as const }], usual, '米');
    expect(r[0]).toMatchObject({ grams: 180, personalized: true });
  });
  it('文章で量を指定した行・履歴のない行・AIの目安は変えない', () => {
    const rows = [
      { foodId: 'rice', grams: 150, origin: 'table' as const },
      { foodId: 'x', grams: 100, origin: 'table' as const },
      { foodId: 'egg', grams: 50, origin: 'estimate' as const },
    ];
    expect(personalizeRows(rows, usual, '米150g')).toEqual(rows);
    expect(personalizeRows(rows, usual, '米１５０ｇ')).toEqual(rows);
  });
});
