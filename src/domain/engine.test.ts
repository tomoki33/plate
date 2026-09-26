import { describe, expect, it } from 'vitest';
import { computeTargets } from './engine';
import { bestSet, decideDayType, estimate1RM, median, volumeScore } from './training';
import { TEMPLATES } from './training';
import type { EngineInput } from './types';

const base: EngineInput = {
  weekKcal: 17500,
  coef: { high: 1.15, normal: 1.0, off: 0.85 },
  pk: 2.2,
  weight: 71.6,
  todayIndex: 4,
  plan: ['normal', 'off', 'high', 'off', 'high', 'normal', 'off'],
  todayType: null,
};

describe('computeTargets', () => {
  it('週合計がそのまま配分される', () => {
    const { orig } = computeTargets(base);
    const sum = orig.reduce((a, d) => a + d.kcal, 0);
    expect(Math.abs(sum - 17500)).toBeLessThan(10);
  });

  it('係数の大きい日ほどkcalが多い', () => {
    const { orig } = computeTargets(base);
    expect(orig[2].kcal).toBeGreaterThan(orig[0].kcal);
    expect(orig[0].kcal).toBeGreaterThan(orig[1].kcal);
  });

  it('Pは体重×係数で毎日同じ', () => {
    const { days } = computeTargets(base);
    expect(new Set(days.map((d) => d.P))).toEqual(new Set([Math.round(71.6 * 2.2)]));
  });

  it('Fの下限は体重×0.6g', () => {
    const { days } = computeTargets({ ...base, weekKcal: 7000 });
    days.forEach((d) => expect(d.F).toBeGreaterThanOrEqual(Math.round(71.6 * 0.6)));
  });

  it('予定どおりなら目標は変わらない', () => {
    const { days, orig } = computeTargets(base);
    expect(days.map((d) => d.kcal)).toEqual(orig.map((d) => d.kcal));
  });

  it('今日をオフに変えると今日が減り、後の日は元の+10%以内', () => {
    const { days, orig } = computeTargets({ ...base, todayType: 'off' });
    expect(days[4].kcal).toBeLessThan(orig[4].kcal);
    [5, 6].forEach((i) => expect(days[i].kcal).toBeLessThanOrEqual(Math.round(orig[i].kcal * 1.1) + 1));
    // 過去の日は固定
    [0, 1, 2, 3].forEach((i) => expect(days[i].kcal).toBe(orig[i].kcal));
  });

  it('日曜が今日でも壊れない', () => {
    const { days } = computeTargets({ ...base, todayIndex: 6 });
    expect(days).toHaveLength(7);
    days.forEach((d) => expect(Number.isFinite(d.kcal)).toBe(true));
  });
});

describe('training', () => {
  it('Epley式', () => {
    expect(estimate1RM(100, 30)).toBeCloseTo(200);
  });
  it('ボリュームスコアは完了セットの部位係数の合計', () => {
    const ex = TEMPLATES.legs.exercises.map((e) => ({
      ...e,
      prevKg: e.kg,
      prevReps: e.reps,
      sets: [{ kg: e.kg, reps: e.reps, done: true }, { kg: e.kg, reps: e.reps, done: false }],
    }));
    expect(volumeScore(ex)).toBeCloseTo(4 * 1.5);
    expect(bestSet(ex)?.name).toBe('スクワット');
  });
  it('日タイプ：中央値の1.3倍以上なら高', () => {
    expect(decideDayType(TEMPLATES.back, 14.3, 11)).toBe('high');
    expect(decideDayType(TEMPLATES.back, 14.2, 11)).toBe('normal');
    expect(decideDayType(TEMPLATES.legs, 1, 11)).toBe('high');
  });
  it('中央値', () => {
    expect(median([])).toBe(11);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});
