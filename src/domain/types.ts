export type DayType = 'high' | 'normal' | 'off';
export type Macro = 'P' | 'F' | 'C';

export interface Pfc {
  kcal: number;
  P: number;
  F: number;
  C: number;
}

export interface DayTarget extends Pfc {
  type: DayType;
}

export interface PlanDay {
  /** テンプレートID。null はオフ */
  templateId: string | null;
  type: DayType;
}

export interface Coef {
  high: number;
  normal: number;
  off: number;
}

export interface EngineInput {
  weekKcal: number;
  coef: Coef;
  /** P係数（g/kg） */
  pk: number;
  weight: number;
  /** 月曜=0 */
  todayIndex: number;
  plan: DayType[];
  /** 今日の実際の日タイプ（予定と違うとき） */
  todayType: DayType | null;
}

export interface EngineResult {
  days: DayTarget[];
  orig: DayTarget[];
}

export const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const;
export const DAY_TYPE_JP: Record<DayType, string> = { high: '高', normal: '通常', off: 'オフ' };
