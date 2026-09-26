import { FOODS } from './foods';

export interface EstimateRow {
  /** 見つからなかった語は id が無い */
  id?: string;
  grams?: number;
  token: string;
}

/**
 * 文章から食品とgを推定する。現状は成分表とのローカル照合。
 * AI（LLM）に差し替えるときは同じ戻り値を返す関数にする。確認画面は必ず挟む。
 */
export function estimateMeal(text: string): EstimateRow[] {
  return text
    .split(/[\s、,，・\n]+/)
    .filter(Boolean)
    .map((token) => {
      const f = FOODS.find((f) => f.aliases.some((a) => token.includes(a)));
      if (!f) return { token };
      const mg = token.match(/(\d+(?:\.\d+)?)\s*(g|グラム)/);
      const mu = token.match(/(\d+)\s*(個|枚|杯|本|パック)/);
      const grams = mg ? Math.round(+mg[1]) : mu ? +mu[1] * (f.unitG ?? f.defaultG) : f.defaultG;
      return { id: f.id, grams, token };
    });
}

export const AI_LIMIT_FREE = 3;
export const AI_LIMIT_PAID = 30;
