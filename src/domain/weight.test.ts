import { describe, expect, it } from 'vitest';
import { avg7, buildWeightChart, etaLabel, etaTo, paceKgPerWeek, signed1, suggestPace, weekDiff, weightForProtein } from './weight';

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
  it('減量：予定より0.1kg/週以上遅いと提案する（−700kcal）', () => {
    const s = suggestPace({ planned: -0.5, actual: -0.2, answeredThisWeek: false });
    expect(s?.deltaKcal).toBe(-700);
    expect(s?.message).toContain('週の合計を700kcal減らしますか');
    expect(s?.message).toContain('−0.2kg/週、予定 −0.5');
  });
  it('予定どおり、または少し遅い程度なら出さない', () => {
    expect(suggestPace({ planned: -0.5, actual: -0.45, answeredThisWeek: false })).toBeNull();
    expect(suggestPace({ planned: -0.5, actual: -0.6, answeredThisWeek: false })).toBeNull();
  });
  it('ちょうど0.1遅いときは出す', () => {
    expect(suggestPace({ planned: -0.5, actual: -0.4, answeredThisWeek: false })).not.toBeNull();
  });
  it('増量は逆向き（+700kcal）', () => {
    const s = suggestPace({ planned: 0.3, actual: 0.1, answeredThisWeek: false });
    expect(s?.deltaKcal).toBe(700);
    expect(s?.message).toContain('増え方が予定より遅め');
  });
  it('今週すでに答えた・データ不足・維持のときは出さない', () => {
    expect(suggestPace({ planned: -0.5, actual: 0, answeredThisWeek: true })).toBeNull();
    expect(suggestPace({ planned: -0.5, actual: null, answeredThisWeek: false })).toBeNull();
    expect(suggestPace({ planned: 0, actual: 0.3, answeredThisWeek: false })).toBeNull();
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
