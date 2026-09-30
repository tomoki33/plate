import { describe, expect, it } from 'vitest';
import { badgeText, daysLogged, kpisOf, lastLoggedDate, mealBars, needCount, proteinAvg, sortStalled, summarize, warningsOf, weekMarks, weightAvg7, weightSeries } from './aggregate';
import { addKey, diffDays, todayIn, weekStartKey, weekdayOf } from './dateKeys';
import { activePlan, effectiveFromFor, goalFor, initialDraft, previewPlan, profilePatchFromPlan, signedPace, withFat, withPace, withProtein, withTarget } from './plan';
import { buildSnapshot, prFlags } from './snapshot';
import type { PlanRow, Snapshot, StudentRow } from './types';

const TODAY = '2026-09-30'; // 水曜
const mk = (over: Partial<Snapshot> = {}, logged: string[] = [], p = 130): Snapshot => ({
  v: 1,
  tz: 'Asia/Tokyo',
  updatedAt: 0,
  today: TODAY,
  profile: { goal: 'cut', goalWeightKg: 60, pace: -0.5, proteinG: 130, fatPct: null, tdee: 2400, weekKcal: 15000, coef: { high: 1.15, normal: 1, off: 0.85 }, weekTypes: ['high', 'normal', 'off', 'high', 'normal', 'off', 'off'], plannedPerWeek: 3, managed: false },
  meals: { days: logged.map((date) => ({ date, kcal: 2000, P: p, F: 60, C: 250, targetKcal: 2100, dayType: 'normal' as const })), recent: [] },
  weight: { entries: [] },
  training: { sessions: [] },
  ...over,
});
const row = (s: Snapshot | null, over: Partial<StudentRow> = {}): StudentRow => ({ linkId: 'l', userId: 'u', studentName: '生徒A', status: 'active', share: { meals: true, weight: true, training: true }, managesGoals: false, joinedAt: '2026-08-01T00:00:00Z', payload: s, payloadUpdatedAt: null, plan: null, lastNote: null, ...over });

describe('日付キー', () => {
  it('月曜始まりの週', () => {
    expect(weekdayOf('2026-09-28')).toBe(0);
    expect(weekdayOf('2026-10-04')).toBe(6);
    expect(weekStartKey('2026-09-30')).toBe('2026-09-28');
    expect(addKey('2026-09-30', 1)).toBe('2026-10-01');
    expect(addKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-09-30', '2026-09-27')).toBe(3);
  });
  it('タイムゾーンで今日が変わる', () => {
    const t = new Date('2026-09-29T20:00:00Z'); // UTC 20:00 = 日本 翌朝5:00
    expect(todayIn('Asia/Tokyo', t)).toBe('2026-09-30');
    expect(todayIn('UTC', t)).toBe('2026-09-29');
    expect(todayIn('Not/AZone', t)).toBe('2026-09-30');
  });
});

describe('警告バッジ（README_coach.md の条件）', () => {
  it('直近の記録から3日以上空くと「n日 記録なし」', () => {
    expect(warningsOf(mk({}, ['2026-09-27']), TODAY).staleDays).toBe(3);
    expect(warningsOf(mk({}, ['2026-09-28']), TODAY).staleDays).toBeNull();
    expect(badgeText(warningsOf(mk({}, ['2026-09-25']), TODAY))).toBe('5日 記録なし');
  });
  it('記録が一度もない人は、参加日から数える', () => {
    expect(warningsOf(mk({}, []), TODAY, '2026-09-20').staleDays).toBe(10);
  });
  it('今週のP平均が目標の85%未満で「P 不足」', () => {
    // 目標130g の 85% = 110.5g
    expect(badgeText(warningsOf(mk({}, ['2026-09-29', '2026-09-30'], 110), TODAY))).toBe('P 不足');
    expect(badgeText(warningsOf(mk({}, ['2026-09-29', '2026-09-30'], 111), TODAY))).toBeNull();
  });
  it('記録なしが優先', () => {
    expect(badgeText(warningsOf(mk({}, ['2026-09-20'], 50), TODAY))).toBe('10日 記録なし');
  });
});

describe('一覧の並び・週バー', () => {
  it('食事を非公開にしていれば、体重の記録で数える', () => {
    const s = mk({ meals: undefined, weight: { entries: [{ date: '2026-09-29', kg: 60 }] } });
    expect(daysLogged(s, '2026-09-28', TODAY)).toBe(1);
  });
  it('トレーニング日はオレンジ、記録のみは黒、なしはグレー', () => {
    const s = mk({ training: { sessions: [{ date: '2026-09-28', name: '脚', best: null, exercises: [] }] } }, ['2026-09-28', '2026-09-29']);
    expect(weekMarks(s, '2026-09-28')).toEqual(['train', 'log', 'none', 'none', 'none', 'none', 'none']);
  });
  it('止まっている順：記録日数が少ない順、同数は最終記録が古い順', () => {
    const a = summarize(row(mk({}, ['2026-09-29', '2026-09-30']), { userId: 'a' }), new Date('2026-09-30T03:00:00Z'));
    const b = summarize(row(mk({}, ['2026-09-28']), { userId: 'b' }), new Date('2026-09-30T03:00:00Z'));
    const c = summarize(row(mk({}, ['2026-09-29']), { userId: 'c' }), new Date('2026-09-30T03:00:00Z'));
    expect(sortStalled([a, b, c]).map((x) => x.row.userId)).toEqual(['b', 'c', 'a']);
  });
  it('一時停止中は最後。声かけ人数は、バッジのある人', () => {
    const now = new Date('2026-09-30T03:00:00Z');
    const paused = summarize(row(null, { userId: 'p', status: 'paused' }), now);
    const stale = summarize(row(mk({}, ['2026-09-20']), { userId: 's' }), now);
    const ok = summarize(row(mk({}, ['2026-09-30']), { userId: 'o' }), now);
    expect(sortStalled([paused, ok, stale]).map((x) => x.row.userId)).toEqual(['s', 'o', 'p']);
    expect(needCount([paused, ok, stale])).toBe(1);
  });
});

describe('KPI・推移', () => {
  it('P平均・記録日は、しきい値を下回ったときだけ low', () => {
    const s = mk({}, ['2026-09-28', '2026-09-29', '2026-09-30'], 100);
    const k = kpisOf(s, '2026-09-28', TODAY);
    expect(k.find((x) => x.key === 'logged')).toMatchObject({ value: '3', low: false });
    expect(k.find((x) => x.key === 'protein')).toMatchObject({ value: '100', low: true });
  });
  it('共有していない項目は「非公開」', () => {
    const s = mk({ weight: undefined, training: undefined });
    const k = kpisOf(s, '2026-09-28', TODAY);
    expect(k.find((x) => x.key === 'weight')).toMatchObject({ hidden: true, value: '非公開' });
    expect(k.find((x) => x.key === 'training')?.hidden).toBe(true);
  });
  it('体重の7日平均と先週比', () => {
    const entries = [{ date: '2026-09-30', kg: 60 }, { date: '2026-09-29', kg: 61 }, { date: '2026-09-23', kg: 62 }, { date: '2026-09-22', kg: 63 }];
    const s = mk({ weight: { entries } });
    expect(weightAvg7(s, TODAY)).toBe(60.5);
    expect(weightAvg7(s, '2026-09-23')).toBe(62.5);
    const k = kpisOf(s, '2026-09-28', TODAY).find((x) => x.key === 'weight')!;
    expect(k.value).toBe('60.5');
    expect(k.note).toBe('先週比 −2.0');
    expect(weightSeries(s, TODAY, 3)).toEqual([null, 62.5, 60.5]);
  });
  it('7日の食事バー', () => {
    const bars = mealBars(mk({}, ['2026-09-29']), '2026-09-28');
    expect(bars[1]).toMatchObject({ logged: true, kcal: 2000, P: 130 });
    expect(bars[0].logged).toBe(false);
  });
  it('補助関数', () => {
    const s = mk({}, ['2026-09-26', '2026-09-29']);
    expect(lastLoggedDate(s, TODAY)).toBe('2026-09-29');
    expect(proteinAvg(s, '2026-09-28', TODAY)).toBe(130);
  });
});

describe('目標プラン', () => {
  it('目的は目標体重との差で決まる', () => {
    expect(goalFor(65, 60)).toBe('cut');
    expect(goalFor(65, 70)).toBe('bulk');
    expect(goalFor(65, 65.4)).toBe('maintain');
    expect(signedPace('cut', 0.5)).toBe(-0.5);
    expect(signedPace('bulk', 0.5)).toBe(0.5);
    expect(signedPace('maintain', 0.5)).toBe(0);
  });
  it('操作の刻みと範囲', () => {
    const d0 = initialDraft(mk({ weight: { entries: [{ date: TODAY, kg: 65 }] } }), null);
    const d1 = withTarget(d0, 62.3, 65);
    expect(d1.targetWeight).toBe(62.5);
    expect(d1.pace).toBeLessThan(0);
    expect(withProtein(d0, 137).proteinG).toBe(135);
    expect(withFat(d0, 60).fatPct).toBe(40);
    expect(withFat(d0, 3).fatPct).toBe(10);
    expect(withPace(d0, 'bulk', 0.25).pace).toBe(0.25);
  });
  it('kcal は目標とペースから自動。Pは指定どおり、Cは残り', () => {
    const s = mk({ weight: { entries: [{ date: TODAY, kg: 65 }] } });
    const d = { targetWeight: 60, pace: -0.5, proteinG: 130, fatPct: 25, menuIds: [] };
    const p = previewPlan(d, s);
    expect(p.day.P).toBe(130);
    expect(p.day.C).toBe(Math.round((p.day.kcal - 4 * 130 - 9 * p.day.F) / 4));
    // 週の合計は、ペースが速いほど小さい
    expect(previewPlan({ ...d, pace: -0.75 }, s).weekKcal).toBeLessThan(p.weekKcal);
    expect(p.pPerKg).toBe(2);
    // 脂質の割合を上げるとFが増える
    expect(previewPlan({ ...d, fatPct: 35 }, s).day.F).toBeGreaterThan(p.day.F);
  });
  it('反映は翌日から（生徒のタイムゾーン）', () => {
    const s = mk();
    expect(effectiveFromFor(s, new Date('2026-09-30T14:59:00Z'))).toBe('2026-10-01'); // 日本 23:59
    expect(effectiveFromFor(s, new Date('2026-09-30T15:01:00Z'))).toBe('2026-10-02'); // 日本 翌0:01
  });
  it('有効なプランは、今日以前でいちばん新しいもの', () => {
    const p = (id: string, from: string, created: string): PlanRow => ({ id, user_id: 'u', coach_id: 'c', target_weight: 60, pace_per_week: -0.5, protein_g: 130, fat_pct: 25, menus: [], effective_from: from, created_at: created });
    const plans = [p('a', '2026-09-20', '1'), p('b', '2026-09-30', '2'), p('c', '2026-10-05', '3')];
    expect(activePlan(plans, '2026-09-29')?.id).toBe('a');
    expect(activePlan(plans, '2026-09-30')?.id).toBe('b');
    expect(activePlan(plans, '2026-09-10')).toBeNull();
    expect(profilePatchFromPlan({ target_weight: 60, pace_per_week: -0.5 }, 65)).toEqual({ goal: 'cut', pace: -0.5, goalWeightKg: 60 });
  });
});

describe('スナップショット（共有した項目だけ）', () => {
  const base = {
    now: new Date('2026-09-30T03:00:00Z'),
    tz: 'Asia/Tokyo',
    profile: { goal: 'cut' as const, goalWeightKg: 60, pace: -0.5, tdee: 2400, coef: { high: 1.15, normal: 1, off: 0.85 }, pk: 2 },
    managed: null,
    weekTypes: ['high', 'normal', 'off', 'high', 'normal', 'off', 'off'] as never,
    plannedPerWeek: 3,
    weekKcal: 15000,
    weights: { '2026-09-29': 61, '2026-01-01': 70 },
    meals: [
      { id: '1', date: '2026-09-29', slot: '朝', foodId: null, groupId: 'g1', groupName: 'ごはんと卵', name: 'ごはん', grams: 100, kcal: 150, P: 3, F: 1, C: 30, ai: false, photoUri: 'photos/secret.jpg', inputType: 'photo', createdAt: 1 },
      { id: '2', date: '2026-09-29', slot: '朝', foodId: null, groupId: 'g1', groupName: 'ごはんと卵', name: '卵', grams: 50, kcal: 70, P: 6, F: 5, C: 0, ai: false, photoUri: null, inputType: 'photo', createdAt: 2 },
    ] as never,
    sessions: [] as never,
    targets: {},
    weightKg: 61,
  };
  it('共有しない項目は入らず、写真のパスも入らない', () => {
    const s = buildSnapshot({ ...base, share: { meals: true, weight: false, training: false } });
    expect(s.weight).toBeUndefined();
    expect(s.training).toBeUndefined();
    expect(s.meals?.days[0]).toMatchObject({ date: '2026-09-29', kcal: 220, P: 9 });
    expect(JSON.stringify(s)).not.toContain('secret.jpg');
    expect(s.meals?.recent).toHaveLength(1); // 同じまとまりは1行
    expect(s.meals?.recent[0]).toMatchObject({ name: 'ごはんと卵', kcal: 220 });
  });
  it('古すぎる体重は送らない', () => {
    const s = buildSnapshot({ ...base, share: { meals: false, weight: true, training: false } });
    expect(s.weight?.entries).toEqual([{ date: '2026-09-29', kg: 61 }]);
    expect(s.meals).toBeUndefined();
  });
  it('自己ベストの更新を判定する', () => {
    const mkS = (id: string, t: number, e1rm: number) => ({ id, startedAt: t, best: { name: 'ベンチ', e1rm } }) as never;
    const f = prFlags([mkS('a', 1, 80), mkS('b', 2, 85), mkS('c', 3, 82)]);
    expect([f.get('a'), f.get('b'), f.get('c')]).toEqual([false, true, false]);
  });
});
