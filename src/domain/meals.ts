import type { MealEntry } from './models';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * 食事の量（g）を直したとき、その行の栄養を比例で計算し直す。
 * 記録時の値のコピーなので、元の食品データは見ない。量が分からない行（g が無い）は変えない。
 */
export function scaleMealEntry<T extends Pick<MealEntry, 'grams' | 'kcal' | 'P' | 'F' | 'C'>>(m: T, newGrams: number): T {
  if (m.grams === null || m.grams <= 0 || newGrams <= 0 || newGrams === m.grams) return m;
  const k = newGrams / m.grams;
  return { ...m, grams: newGrams, kcal: Math.round(m.kcal * k), P: round1(m.P * k), F: round1(m.F * k), C: round1(m.C * k) };
}
