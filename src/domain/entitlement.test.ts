import { describe, expect, it } from 'vitest';
import { featuresOf, planOf, trialDaysLeft, TRIAL_DAYS } from './entitlement';

const DAY = 24 * 60 * 60 * 1000;
const t0 = 1_700_000_000_000;

describe('プランの判定', () => {
  it('課金していれば有料', () => expect(planOf(t0, null, true)).toBe('paid'));
  it('体験開始から4週間は体験中', () => {
    expect(planOf(t0 + 27 * DAY, t0, false)).toBe('trial');
    expect(planOf(t0 + TRIAL_DAYS * DAY, t0, false)).toBe('view_only');
  });
  it('体験を始めていなければ見るだけ', () => expect(planOf(t0, null, false)).toBe('view_only'));
  it('体験の残り日数', () => {
    expect(trialDaysLeft(t0 + 1 * DAY, t0)).toBe(27);
    expect(trialDaysLeft(t0 + 40 * DAY, t0)).toBe(0);
    expect(trialDaysLeft(t0, null)).toBe(0);
  });
});

describe('機能差', () => {
  it('見るだけ：新しい記録はできない。AIの上限は変わらない', () => {
    expect(featuresOf('view_only', false)).toEqual({ canRecord: false, aiLimit: 3 });
  });
  it('体験中・購入済みは新しい記録ができる', () => {
    expect(featuresOf('trial', false)).toEqual({ canRecord: true, aiLimit: 3 });
    expect(featuresOf('paid', false)).toEqual({ canRecord: true, aiLimit: 3 });
  });
  it('AIプラスは、体験・購入の状態にかかわらずAIの上限が増える', () => {
    expect(featuresOf('view_only', true).aiLimit).toBe(30);
    expect(featuresOf('trial', true).aiLimit).toBe(30);
  });
});
