/**
 * 無料／有料の機能差（設計書「課金設計」）。
 *
 * | 機能 | 無料 | 有料 |
 * | 目標 | 固定PFC目標のみ | 日タイプ連動・週内の再配分 |
 * | AIテキスト入力 | 1日3回 | 1日30回 |
 * | 週次レビュー・1RM推移 | 直近2週 | 全期間 |
 *
 * 初回は14日間の無料体験（体験中は有料と同じ）。
 */
export type Plan = 'free' | 'trial' | 'paid';

export const TRIAL_DAYS = 14;
export const AI_LIMIT_FREE = 3;
export const AI_LIMIT_PAID = 30;
export const REVIEW_WEEKS_FREE = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export function planOf(now: number, trialStartedAt: number | null, paid: boolean): Plan {
  if (paid) return 'paid';
  if (trialStartedAt !== null && now < trialStartedAt + TRIAL_DAYS * DAY_MS) return 'trial';
  return 'free';
}

export const trialDaysLeft = (now: number, trialStartedAt: number | null): number =>
  trialStartedAt === null ? 0 : Math.max(0, Math.ceil((trialStartedAt + TRIAL_DAYS * DAY_MS - now) / DAY_MS));

export interface Features {
  /** 日タイプ連動・週内の再配分 */
  linkedTargets: boolean;
  aiLimit: number;
  /** レビューで見られる週数。null は全期間 */
  reviewWeeks: number | null;
}

export const featuresOf = (plan: Plan): Features =>
  plan === 'free' ? { linkedTargets: false, aiLimit: AI_LIMIT_FREE, reviewWeeks: REVIEW_WEEKS_FREE } : { linkedTargets: true, aiLimit: AI_LIMIT_PAID, reviewWeeks: null };
