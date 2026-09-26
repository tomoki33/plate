import type { DayTarget, DayType, EngineInput, EngineResult } from './types';

/**
 * 目標エンジン。
 * kcal_i = 週合計 × m_i / Σm。今日の日タイプが予定と変わったら、過去の日は固定のまま
 * 残り（今日〜日曜）を係数で配り直す。今日より後の日は元の値の±10%で止め、超えた分は追わない。
 * P = 体重 × P係数（毎日同じ）。F は トレ日20%・オフ日25%、下限は体重×0.6g。C は残り全部。
 */
export function computeTargets(input: EngineInput): EngineResult {
  const { weekKcal, coef, pk, weight, todayIndex: ti, plan, todayType } = input;
  const m = (t: DayType) => coef[t];
  const all = plan.reduce((a, t) => a + m(t), 0);
  const orig = plan.map((t) => (weekKcal * m(t)) / all);

  const types = plan.slice();
  if (todayType) types[ti] = todayType;

  const spent = orig.slice(0, ti).reduce((a, b) => a + b, 0);
  const remaining = weekKcal - spent;
  const restIdx = plan.map((_, i) => i).filter((i) => i >= ti);
  const restSum = restIdx.reduce((a, i) => a + m(types[i]), 0);

  const k = orig.slice();
  restIdx.forEach((i) => {
    k[i] = (remaining * m(types[i])) / restSum;
    if (i > ti) k[i] = Math.min(orig[i] * 1.1, Math.max(orig[i] * 0.9, k[i]));
  });

  const toPfc = (kcal: number, type: DayType): DayTarget => {
    const P = Math.round(weight * pk);
    const F = Math.max(Math.round((kcal * (type === 'off' ? 0.25 : 0.2)) / 9), Math.round(weight * 0.6));
    return { kcal: Math.round(kcal), P, F, C: Math.round((kcal - 4 * P - 9 * F) / 4), type };
  };

  return {
    days: k.map((kc, i) => toPfc(kc, types[i])),
    orig: orig.map((kc, i) => toPfc(kc, plan[i])),
  };
}
