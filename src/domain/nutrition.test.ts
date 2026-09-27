import { describe, expect, it } from 'vitest';
import { bmr, checkWarnings, clampPace, correctTdee, defaultPace, initialTdee, paceBounds, paceOptions, weekKcalOf, weightTrend, DEFAULT_PROFILE } from './nutrition';

const now = new Date(2026, 8, 26);

describe('TDEEと週合計', () => {
  it('Mifflin-St Jeor（男性 70kg/172cm/29歳）', () => {
    expect(bmr({ sex: 'male', heightCm: 172 }, 70, 29)).toBeCloseTo(700 + 1075 - 145 + 5);
  });
  it('女性は −161', () => {
    expect(bmr({ sex: 'female', heightCm: 160 }, 55, 30)).toBeCloseTo(550 + 1000 - 150 - 161);
  });
  it('週合計 = 7×TDEE + r×7700', () => {
    expect(weekKcalOf(2600, -0.5)).toBe(7 * 2600 - 3850);
    expect(weekKcalOf(2600, 0)).toBe(18200);
  });
  it('初期TDEE = BMR × 活動係数', () => {
    const p = { ...DEFAULT_PROFILE };
    expect(initialTdee(p, 70, now)).toBeCloseTo(bmr(p, 70, 29) * 1.6);
  });
});

describe('ペース', () => {
  it('減量は体重の0.5〜1%/週', () => {
    const b = paceBounds('cut', 70);
    expect(b.min).toBeCloseTo(0.35);
    expect(b.max).toBeCloseTo(0.7);
  });
  it('増量は0.25〜0.5%/週', () => {
    const b = paceBounds('bulk', 80);
    expect(b.min).toBeCloseTo(0.2);
    expect(b.max).toBeCloseTo(0.4);
  });
  it('候補は範囲内で、減量はマイナス', () => {
    const o = paceOptions('cut', 70);
    o.forEach((v) => {
      expect(v).toBeLessThan(0);
      expect(Math.abs(v)).toBeGreaterThanOrEqual(0.35 - 1e-9);
      expect(Math.abs(v)).toBeLessThanOrEqual(0.7 + 1e-9);
    });
  });
  it('範囲外は丸める', () => {
    expect(clampPace('cut', 70, -2)).toBe(-0.7);
    expect(clampPace('cut', 70, -0.1)).toBe(-0.35);
    expect(clampPace('maintain', 70, -1)).toBe(0);
    expect(defaultPace('maintain', 70)).toBe(0);
  });
});

describe('警告', () => {
  const p = { ...DEFAULT_PROFILE };
  it('基礎代謝を下回る設定には警告', () => {
    const w = checkWarnings(p, 70, 7 * 1300, now);
    expect(w.map((x) => x.code)).toContain('below-floor');
  });
  it('普通の設定では出ない', () => {
    expect(checkWarnings(p, 70, weekKcalOf(2600, -0.35), now)).toEqual([]);
  });
  it('1%/週を超える減量ペースには警告', () => {
    const w = checkWarnings({ ...p, pace: -1.5 }, 70, 7 * 2200, now);
    expect(w.map((x) => x.code)).toContain('pace-too-fast');
  });
});

const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const day = (n: number) => new Date(2026, 8, 26 + n);

describe('TDEEの実データ補正', () => {
  const intake = (kcal: number, days = 14) => Object.fromEntries(Array.from({ length: days }, (_, i) => [k(day(-i)), kcal]));
  const weights = (start: number, end: number) => {
    const w: Record<string, number> = {};
    for (let i = 0; i < 28; i++) w[k(day(-i))] = end + ((start - end) * i) / 27; // 28日かけて変化
    return w;
  };

  it('記録が足りなければ補正しない', () => {
    const r = correctTdee({ prevTdee: 2600, today: day(0), intake: intake(2200, 5), weights: weights(72, 71) });
    expect(r.applied).toBe(false);
    expect(r.tdee).toBe(2600);
  });

  it('体重が減っていなければ、摂取＝TDEE。前回値との加重平均をとる', () => {
    const flat: Record<string, number> = {};
    for (let i = 0; i < 28; i++) flat[k(day(-i))] = 70;
    const r = correctTdee({ prevTdee: 2600, today: day(0), intake: intake(2400), weights: flat });
    expect(r.applied).toBe(true);
    expect(r.measured).toBe(2400);
    expect(r.tdee).toBe(Math.round(2600 * 0.7 + 2400 * 0.3));
  });

  it('体重が減っているなら、TDEEは摂取より大きい', () => {
    const r = correctTdee({ prevTdee: 2400, today: day(0), intake: intake(2200), weights: weights(72, 71) });
    expect(r.measured!).toBeGreaterThan(2200);
  });

  it('急変を防ぐため1回の変化は±15%まで', () => {
    const flat: Record<string, number> = {};
    for (let i = 0; i < 28; i++) flat[k(day(-i))] = 70;
    const r = correctTdee({ prevTdee: 3000, today: day(0), intake: intake(1000), weights: flat });
    expect(r.tdee).toBeGreaterThanOrEqual(3000 * 0.85);
  });

  it('体重トレンドは3日以上の記録が要る', () => {
    expect(weightTrend({ [k(day(0))]: 70, [k(day(-1))]: 70 }, day(0))).toBeNull();
    expect(weightTrend({ [k(day(0))]: 70, [k(day(-1))]: 71, [k(day(-2))]: 72 }, day(0))).toBeCloseTo(71);
  });
});

import { SPREAD_PRESETS, coefFromPercents, dailyProtein, matchSpreadPreset, spreadPercents } from './nutrition';

describe('日ごとの食べる量', () => {
  it('標準は設計書の初期値（高1.15／オフ0.85）', () => {
    expect(SPREAD_PRESETS.standard).toMatchObject({ high: 1.15, off: 0.85 });
    expect(matchSpreadPreset({ high: 1.15, normal: 1, off: 0.85 })).toBe('standard');
  });
  it('3段階のどれに当たるか、外れたら null', () => {
    expect(matchSpreadPreset({ high: 1.07, normal: 1, off: 0.93 })).toBe('small');
    expect(matchSpreadPreset({ high: 1.25, normal: 1, off: 0.75 })).toBe('large');
    expect(matchSpreadPreset({ high: 1.2, normal: 1, off: 0.85 })).toBeNull();
    expect(matchSpreadPreset({ high: 1.15, normal: 1.1, off: 0.85 })).toBeNull();
  });
  it('係数と%を行き来できる', () => {
    expect(spreadPercents({ high: 1.15, normal: 1, off: 0.85 })).toEqual({ high: 15, off: 15 });
    expect(coefFromPercents(15, 15)).toEqual({ high: 1.15, normal: 1, off: 0.85 });
    expect(coefFromPercents(20, 10)).toEqual({ high: 1.2, normal: 1, off: 0.9 });
  });
  it('%は範囲に収める（高い日 0〜+40、オフ 0〜−40）', () => {
    expect(coefFromPercents(80, 90)).toEqual({ high: 1.4, normal: 1, off: 0.6 });
    expect(coefFromPercents(-5, -5)).toEqual({ high: 1, normal: 1, off: 1 });
  });
  it('1日のたんぱく質 = 体重 × P係数', () => {
    expect(dailyProtein(71.6, 2.2)).toBe(158);
    expect(dailyProtein(70, 2.2)).toBe(154);
  });
});
