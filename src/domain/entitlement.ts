/**
 * 課金モデル（README_onboarding「課金の実装」）。
 *
 * 本体は買い切り。無料体験（4週間）のあと、購入していなければ「記録を見るだけ」になる
 * （過去の記録は見られるが、新しい記録は追加できない。永続的な無料プランはない）。
 * AIプラス（任意のサブスク）は、体験・購入の状態とは別に、写真・文章からの推定回数だけを増やす。
 */
export type Plan = 'trial' | 'paid' | 'view_only';

export const TRIAL_DAYS = 28;
export const AI_LIMIT_BASE = 3;
export const AI_LIMIT_PLUS = 30;
/** 無料公開モードでの1日の回数（課金がないので、AIプラス相当までは開けない） */
export const AI_LIMIT_FREE_LAUNCH = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export function planOf(now: number, trialStartedAt: number | null, paid: boolean): Plan {
  if (paid) return 'paid';
  if (trialStartedAt !== null && now < trialStartedAt + TRIAL_DAYS * DAY_MS) return 'trial';
  return 'view_only';
}

export const trialDaysLeft = (now: number, trialStartedAt: number | null): number =>
  trialStartedAt === null ? 0 : Math.max(0, Math.ceil((trialStartedAt + TRIAL_DAYS * DAY_MS - now) / DAY_MS));

export interface Features {
  /** 新しい記録（食事・トレーニング・体重）を追加できるか。false は「見るだけ」 */
  canRecord: boolean;
  /** 写真・文章からの推定の1日の回数上限 */
  aiLimit: number;
}

export const featuresOf = (plan: Plan, aiPlus: boolean, freeLaunch = false): Features => ({
  canRecord: plan !== 'view_only',
  aiLimit: aiPlus ? AI_LIMIT_PLUS : freeLaunch ? AI_LIMIT_FREE_LAUNCH : AI_LIMIT_BASE,
});
