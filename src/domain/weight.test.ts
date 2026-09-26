import { describe, expect, it } from 'vitest';
import { avg7, buildWeightChart, etaLabel, etaTo, paceKgPerWeek, signed1, suggestPace, suggestedStep, weekDiff, weightForProtein } from './weight';

const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = new Date(2026, 8, 25);
const at = (n: number) => new Date(2026, 8, 25 + n);
/** n日前を 0、… の値で埋める */
const log = (f: (daysAgo: number) => number | null, len = 60) => {
  const w: Record<string, number> = {};
  for (let d = 0; d < len; d++) {
    const v = f(d);
    if (v !== null) w[k(at(-d))] = v;
  }
  return w;
};

describe('7日平均', () => {
  it('その日から過去7日の平均（記録がない日は飛ばす）', () => {
    const w = log((d) => (d === 2 ? null : 70 + d));
    // d=0..6 のうち d=2 を除く：70,71,73,74,75,76 → 平均 73.1666
    expect(avg7(w, today)).toBeCloseTo((70 + 71 + 73 + 74 + 75 + 76) / 6);
  });
  it('7日以内に記録がなければ null', () => {
    expect(avg7({ [k(at(-10))]: 70 }, today)).toBeNull();
  });
  it('Pの計算に使う体重は7日平均（0.1kg）。なければ直近の記録', () => {
    expect(weightForProtein(log((d) => 70 + d), today)).toBe(73);
    expect(weightForProtein({ [k(at(-20))]: 68.4 }, today)).toBe(68.4);
    expect(weightForProtein({}, today)).toBeNull();
  });
});

describe('ペースと先週との差', () => {
  it('ペース = （今日の7日平均 − 14日前の7日平均）÷ 2', () => {
    // 1日あたり −0.1kg のペース：14日で −1.4kg → 週 −0.7
    const w = log((d) => 72 - (60 - d) * 0 + d * 0.1);
    expect(paceKgPerWeek(w, today)).toBe(-0.7);
  });
  it('14日前の平均が出せなければ null', () => {
    expect(paceKgPerWeek(log((d) => (d < 8 ? 70 : null)), today)).toBeNull();
  });
  it('先週との差', () => {
    const w = log((d) => 70 + d * 0.05);
    expect(weekDiff(w, today)).toBeCloseTo(-0.35);
  });
  it('符号つきの表示', () => {
    expect(signed1(-0.5)).toBe('−0.5');
    expect(signed1(0.3)).toBe('+0.3');
    expect(signed1(0.02)).toBe('±0.0');
  });
});

describe('到達予測', () => {
  it('（7日平均 − 目標）÷ ペース で日付を出す', () => {
    const e = etaTo(71.5, 69, -0.5, today, 'down');
    expect(e.kind).toBe('date');
    if (e.kind === 'date') expect(k(e.date)).toBe(k(at(35))); // 2.5 ÷ 0.5 × 7 = 35日後
  });
  it('目標に達していれば到達済み', () => {
    expect(etaTo(68.9, 69, -0.5, today, 'down')).toEqual({ kind: 'reached' });
    expect(etaLabel({ kind: 'reached' })).toBe('到達済み');
  });
  it('ペースが止まっている・逆向きなら、届かない', () => {
    expect(etaTo(71.5, 69, 0, today, 'down')).toEqual({ kind: 'never' });
    expect(etaTo(71.5, 69, 0.3, today, 'down')).toEqual({ kind: 'never' });
    expect(etaLabel({ kind: 'never' })).toBe('今のままでは届かない');
  });
  it('増量：目標が上のとき', () => {
    expect(etaTo(70, 75, 0.25, today, 'up').kind).toBe('date');
    expect(etaTo(70, 75, -0.2, today, 'up')).toEqual({ kind: 'never' });
    expect(etaTo(75.2, 75, 0.25, today, 'up')).toEqual({ kind: 'reached' });
  });
  it('上旬・中旬・下旬の表示', () => {
    expect(etaLabel({ kind: 'date', date: new Date(2027, 0, 5) })).toBe('2027年1月上旬');
    expect(etaLabel({ kind: 'date', date: new Date(2027, 0, 15) })).toBe('2027年1月中旬');
    expect(etaLabel({ kind: 'date', date: new Date(2027, 0, 25) })).toBe('2027年1月下旬');
  });
});

describe('ペースの見直し', () => {
  const base = { answeredThisWeek: false, loggedDays: 12 };
  it('減量：予定より0.15kg/週以上遅いと提案する。遅れに応じて量が変わる', () => {
    const s = suggestPace({ ...base, planned: -0.5, actual: -0.3 }); // 0.2遅れ → 0.2×7700×0.5=770 → 800
    expect(s?.deltaKcal).toBe(-800);
    expect(s?.message).toContain('週の合計を800kcal減らしますか');
    expect(s?.message).toContain('−0.3kg/週、予定 −0.5');
  });
  it('遅れが大きいほど提案量が増える', () => {
    const a = suggestPace({ ...base, planned: -0.5, actual: -0.3 })!.deltaKcal;
    const b = suggestPace({ ...base, planned: -0.5, actual: -0.1 })!.deltaKcal;
    const c = suggestPace({ ...base, planned: -0.5, actual: 0.3 })!.deltaKcal;
    expect(Math.abs(b)).toBeGreaterThan(Math.abs(a));
    expect(Math.abs(c)).toBeGreaterThanOrEqual(Math.abs(b));
  });
  it('提案量は300〜1,400kcalに収まる', () => {
    expect(suggestedStep(0.15)).toBe(600);
    expect(suggestedStep(0.05)).toBe(300);
    expect(suggestedStep(2)).toBe(1400);
  });
  it('0.15未満の遅れ（日々のぶれ程度）では出さない', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.4 })).toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.6 })).toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.35 })).not.toBeNull();
  });
  it('「2週続けて」：1週前の窓も遅れているときだけ出す。比較できなければ出さない', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.2, previous: -0.25 })).not.toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.2, previous: -0.5 })).toBeNull(); // 1週前は順調（一時的な停滞かもしれない）
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.2, previous: null })).toBeNull();
  });
  it('目標・維持カロリーを動かして14日以内は出さない（二重に絞らない）', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, daysSinceAdjust: 13 })).toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, daysSinceAdjust: 14 })).not.toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, daysSinceAdjust: null })).not.toBeNull();
  });
  it('食事の記録が14日中10日未満なら出さない', () => {
    expect(suggestPace({ ...base, loggedDays: 9, planned: -0.5, actual: -0.1 })).toBeNull();
    expect(suggestPace({ ...base, loggedDays: 10, planned: -0.5, actual: -0.1 })).not.toBeNull();
  });
  it('減量で、下げられる余地が少ないときは、余地の範囲に収める。余地が300未満なら出さない', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: 0.2, room: 600 })?.deltaKcal).toBe(-600);
    expect(suggestPace({ ...base, planned: -0.5, actual: 0.2, room: 250 })).toBeNull();
  });
  it('計画どおり食べていないときは出さない（減量で5%超の食べ過ぎ）', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, intakeRatio: 1.08 })).toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, intakeRatio: 1.05 })).not.toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: -0.1, intakeRatio: 0.9 })).not.toBeNull();
  });
  it('増量は逆向き（+）で、食べ足りないときは出さない。余地の制限はない', () => {
    expect(suggestPace({ ...base, planned: 0.3, actual: 0.0, intakeRatio: 0.9 })).toBeNull();
    const s = suggestPace({ ...base, planned: 0.3, actual: 0.1, room: 0 });
    expect(s?.deltaKcal).toBeGreaterThan(0);
    expect(s?.message).toContain('増え方が予定より遅め');
  });
  it('今週すでに答えた・データ不足・維持のときは出さない', () => {
    expect(suggestPace({ ...base, planned: -0.5, actual: 0, answeredThisWeek: true })).toBeNull();
    expect(suggestPace({ ...base, planned: -0.5, actual: null })).toBeNull();
    expect(suggestPace({ ...base, planned: 0, actual: 0.3 })).toBeNull();
  });
});

describe('グラフの座標', () => {
  const w = log((d) => 72 - (30 - d) * 0.03 + Math.sin(d) * 0.2, 40);
  it('点・平均・目標・今日の線・目盛りが出る', () => {
    const c = buildWeightChart({ weights: w, today, days: 30, fut: 9, goal: 69, pace: -0.4, W: 331, H: 190, padL: 26 });
    expect(c.empty).toBe(false);
    expect(c.dots.length).toBeGreaterThan(20);
    expect(c.avg.length).toBeGreaterThan(20);
    expect(c.goalY).not.toBeNull();
    expect(c.ticks).toHaveLength(3);
    expect(c.proj!.to.x).toBeGreaterThan(c.proj!.from.x);
    expect(c.todayX).toBeLessThan(331);
    // 今日は右寄り、見込みの右端がグラフの右端
    expect(c.proj!.to.x).toBeCloseTo(331 - 4);
  });
  it('目標線は目標より上のときは上に描く（yは小さい）', () => {
    const c = buildWeightChart({ weights: w, today, days: 30, fut: 0, goal: 75, pace: 0, W: 331, H: 190, padL: 26 });
    expect(c.goalY!).toBeLessThan(c.dots[0].y);
  });
  it('記録がなければ empty', () => {
    expect(buildWeightChart({ weights: {}, today, days: 30, fut: 0, goal: null, pace: 0, W: 331, H: 190, padL: 0 }).empty).toBe(true);
  });
});
