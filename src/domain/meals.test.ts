import { describe, expect, it } from 'vitest';
import { scaleMealEntry } from './meals';

const chicken = { grams: 150, kcal: 158, P: 35, F: 2.9, C: 0.2 };

describe('食事の量を直す', () => {
  it('栄養を比例で計算し直す', () => {
    const r = scaleMealEntry(chicken, 300);
    expect(r).toEqual({ grams: 300, kcal: 316, P: 70, F: 5.8, C: 0.4 });
  });
  it('量を減らしても比例', () => {
    const r = scaleMealEntry(chicken, 75);
    expect(r.kcal).toBe(79);
    expect(r.P).toBe(17.5);
  });
  it('同じ量、0以下、量が分からない行は変えない', () => {
    expect(scaleMealEntry(chicken, 150)).toBe(chicken);
    expect(scaleMealEntry(chicken, 0)).toBe(chicken);
    const unknown = { grams: null, kcal: 100, P: 5, F: 1, C: 10 };
    expect(scaleMealEntry(unknown, 200)).toBe(unknown);
  });
});
