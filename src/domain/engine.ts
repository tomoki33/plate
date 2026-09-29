import type { DayTarget, DayType, EngineInput, EngineResult } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * 目標エンジン（設計書「目標エンジン仕様」2〜5）。
 *
 * - kcal_i = 週合計 × m_i / Σm（週合計は日タイプの並びによらず一定）
 * - 今日の日タイプが予定と変わったら、今日〜日曜を係数で配り直す
 * - 過去の日に過不足が出たら、残りの日に係数比で配る。ただし各日の変化は元の値の±10%まで。
 *   超えた分は追わない（取り返すための極端な制限を促さない）
 * - P = 体重 × P係数（毎日同じ）、F = トレ日20%・オフ日25%（下限は体重×0.6g）、C = 残り全部
 */
export function computeTargets(input: EngineInput): EngineResult {
  const { weekKcal, coef, pk, weight, todayIndex: ti, plan, todayType, actuals = [], linked = true, fixedP, fatPct } = input;
  const m = (t: DayType) => (linked ? coef[t] : 1);

  const toPfc = (kcal: number, type: DayType): DayTarget => {
    const P = fixedP ?? Math.round(weight * pk);
    const fRatio = fatPct !== undefined ? fatPct / 100 : type === 'off' ? 0.25 : 0.2;
    const F = Math.max(Math.round((kcal * fRatio) / 9), Math.round(weight * 0.6));
    return { kcal: Math.round(kcal), P, F, C: Math.round((kcal - 4 * P - 9 * F) / 4), type };
  };

  const allPlan = plan.reduce((a, t) => a + m(t), 0);
  const orig = plan.map((t) => (weekKcal * m(t)) / allPlan);

  if (!linked) {
    // 無料版：毎日同じ固定目標
    const flat = weekKcal / 7;
    // Fの割合も日タイプで変えず、毎日まったく同じPFCにする
    const days = plan.map((t) => ({ ...toPfc(flat, 'normal'), type: t }));
    return { days, orig: days };
  }

  const types = plan.slice();
  if (todayType) types[ti] = todayType;
  const changed = types[ti] !== plan[ti];
  const allNew = types.reduce((a, t) => a + m(t), 0);
  const refNew = types.map((t) => (weekKcal * m(t)) / allNew);

  // 過去の日：食べた実績（なければ目標どおり）を差し引いた残りを、残りの日で分ける
  const spent = orig.slice(0, ti).reduce((a, kc, i) => a + (actuals[i] ?? kc), 0);
  const remaining = weekKcal - spent;
  const restIdx = plan.map((_, i) => i).filter((i) => i >= ti);
  const restSum = restIdx.reduce((a, i) => a + m(types[i]), 0);

  const k = orig.slice();
  for (const i of restIdx) {
    const raw = (remaining * m(types[i])) / restSum;
    if (i === ti) {
      // 今日：日タイプが変わったなら、新しいタイプの基準値の±10%
      const ref = changed ? refNew[ti] : orig[ti];
      k[i] = clamp(raw, ref * 0.9, ref * 1.1);
    } else {
      k[i] = clamp(raw, orig[i] * 0.9, orig[i] * 1.1);
    }
  }

  return { days: k.map((kc, i) => toPfc(kc, types[i])), orig: orig.map((kc, i) => toPfc(kc, plan[i])) };
}
