import { describe, expect, it } from 'vitest';
import { featuresOf, planOf, trialDaysLeft, TRIAL_DAYS } from './entitlement';

const DAY = 24 * 60 * 60 * 1000;
const t0 = 1_700_000_000_000;

describe('プランの判定', () => {
  it('課金していれば有料', () => expect(planOf(t0, null, true)).toBe('paid'));
  it('体験開始から14日間は体験中', () => {
    expect(planOf(t0 + 13 * DAY, t0, false)).toBe('trial');
    expect(planOf(t0 + TRIAL_DAYS * DAY, t0, false)).toBe('free');
  });
  it('体験を始めていなければ無料', () => expect(planOf(t0, null, false)).toBe('free'));
  it('体験の残り日数', () => {
    expect(trialDaysLeft(t0 + 1 * DAY, t0)).toBe(13);
    expect(trialDaysLeft(t0 + 20 * DAY, t0)).toBe(0);
    expect(trialDaysLeft(t0, null)).toBe(0);
  });
});

describe('機能差', () => {
  it('無料：固定目標・AI3回・レビュー2週', () => {
    expect(featuresOf('free')).toEqual({ linkedTargets: false, aiLimit: 3, reviewWeeks: 2 });
  });
  it('有料・体験中：連動・AI30回・全期間', () => {
    expect(featuresOf('paid')).toEqual({ linkedTargets: true, aiLimit: 30, reviewWeeks: null });
    expect(featuresOf('trial')).toEqual(featuresOf('paid'));
  });
});
