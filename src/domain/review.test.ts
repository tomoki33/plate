import { describe, expect, it } from 'vitest';
import type { SessionRecord } from './models';
import { e1rmSeries, movingAverage, summarizeWeek, weekBestE1rm } from './review';

const mk = (date: string, kg: number, reps = 5): SessionRecord => ({
  id: date,
  date,
  templateId: null,
  name: 't',
  startedAt: 0,
  endedAt: 0,
  volume: 1,
  dayType: 'normal',
  doneSets: 1,
  best: null,
  exercises: [{ exerciseId: 'sq', name: 'スクワット', part: '脚', coef: 1.5, prevKg: kg, prevReps: reps, sets: [{ kg, reps, done: true }] }],
});

describe('推定1RMの推移', () => {
  const sessions = [mk('2026-09-01', 100), mk('2026-09-08', 110), mk('2026-09-15', 105)];
  it('日付順に並ぶ', () => {
    const s = e1rmSeries(sessions, 'sq');
    expect(s.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-08', '2026-09-15']);
    expect(s[0].e1rm).toBeCloseTo(100 * (1 + 5 / 30));
  });
  it('期間で絞れる', () => {
    expect(e1rmSeries(sessions, 'sq', '2026-09-08')).toHaveLength(2);
  });
  it('その種目のない日は出ない', () => {
    expect(e1rmSeries(sessions, 'bench')).toEqual([]);
  });
  it('週の最大値', () => {
    expect(weekBestE1rm(sessions, 'sq', new Date(2026, 8, 7))).toBeCloseTo(110 * (1 + 5 / 30));
    expect(weekBestE1rm(sessions, 'sq', new Date(2026, 8, 21))).toBeNull();
  });
});

describe('週の集計', () => {
  const monday = new Date(2026, 8, 21);
  const meals = [
    { date: '2026-09-21', kcal: 2000, P: 150, F: 60, C: 200 },
    { date: '2026-09-21', kcal: 500, P: 30, F: 10, C: 60 },
    { date: '2026-09-23', kcal: 2400, P: 170, F: 70, C: 250 },
  ];
  const target = [2300, 2100, 2500, 2100, 2500, 2300, 2100];
  it('記録のある日だけで平均と過不足を出す', () => {
    const s = summarizeWeek(meals, monday, target);
    expect(s.loggedDays).toBe(2);
    expect(s.avg.kcal).toBe(2450);
    expect(s.kcalDiff).toBe(2500 + 2400 - (2300 + 2500));
  });
  it('記録がなければ0日', () => {
    expect(summarizeWeek([], monday, target).loggedDays).toBe(0);
  });
});

describe('体重の移動平均', () => {
  it('3日以上の記録があるところから出る', () => {
    const days = [new Date(2026, 8, 1), new Date(2026, 8, 2), new Date(2026, 8, 3)];
    const w = { '2026-09-01': 70, '2026-09-02': 71, '2026-09-03': 72 };
    const r = movingAverage(w, days);
    expect(r[0]).toBeNull();
    expect(r[1]).toBeNull();
    expect(r[2]).toBeCloseTo(71);
  });
});
