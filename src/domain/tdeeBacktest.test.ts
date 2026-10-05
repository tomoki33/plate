import { describe, expect, it } from 'vitest';
import { backtest, rng, SCENARIOS, simulate } from './tdeeBacktest';

describe('TDEE補正のバックテスト', () => {
  it('同じ種なら同じ結果（再現できる）', () => {
    expect(simulate(SCENARIOS[0], {}, { seed: 7 })).toEqual(simulate(SCENARIOS[0], {}, { seed: 7 }));
    const a = rng(1);
    const b = rng(1);
    expect([a(), a()]).toEqual([b(), b()]);
  });

  it('初期値が大きくずれていると、補正で予測誤差とTDEE誤差が小さくなる', () => {
    const seeds = [1, 2, 3, 4, 5];
    for (const sc of SCENARIOS.slice(0, 2)) {
      const none = backtest(sc, null, seeds);
      const cur = backtest(sc, {}, seeds);
      expect(cur.maeKg).toBeLessThan(none.maeKg);
      expect(cur.tdeeMae).toBeLessThan(none.tdeeMae);
    }
  });

  it('値が動かなくても、補正できたら applied は true', () => {
    const sc = { name: 'x', trueTdee: () => 2400, initialTdee: 2400, deficit: 0 };
    const { checks } = simulate(sc, {}, { seed: 1, weightNoiseKg: 0, intakeNoise: 0, weightMissRate: 0, intakeMissRate: 0 });
    const later = checks.filter((c) => c.day >= 28); // 初めは体重の履歴が足りず補正されない
    expect(later.length).toBeGreaterThan(0);
    expect(later.every((c) => c.applied && c.tdeeAfter === 2400)).toBe(true);
  });

  it('補正しない場合、TDEEは動かない', () => {
    const { checks } = simulate(SCENARIOS[0], null, { seed: 1 });
    expect(checks.every((c) => c.tdeeAfter === SCENARIOS[0].initialTdee && !c.applied)).toBe(true);
  });
});
