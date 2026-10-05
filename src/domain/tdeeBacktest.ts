import { KCAL_PER_KG, correctTdee, weightTrend, type CorrectionParams } from './nutrition';

/**
 * 維持カロリー（TDEE）補正のバックテスト（純粋関数）。
 * 本当の TDEE が分かっている合成データを作り、アプリと同じ correctTdee を週に1回かけて、
 *  - 予測した体重変化（摂取と推定 TDEE から）と、実測（7日平均の動き）の差
 *  - 推定 TDEE と本当の TDEE の差
 * を数字にする。個人の記録は使わない（乱数は種つきで、同じ種なら同じ結果）。
 */

export interface Scenario {
  name: string;
  /** 本当の TDEE（kcal/日）。day は開始からの日数（適応で変わる場合を表せる） */
  trueTdee: (day: number) => number;
  /** 最初に設定されている TDEE（式からの推定のずれを表す） */
  initialTdee: number;
  /** 狙いの摂取 = 推定 TDEE − deficit（kcal/日） */
  deficit: number;
  /** 食事の記録の偏り（−0.1 なら 1 割少なく記録する） */
  loggingBias?: number;
}

export interface SimOptions {
  seed?: number;
  days?: number;
  startWeightKg?: number;
  /** 体重計の日々のぶれ（kg の標準偏差。水分など） */
  weightNoiseKg?: number;
  /** 食事量の日々のぶれ（割合の標準偏差） */
  intakeNoise?: number;
  /** 体重を測り忘れる確率 */
  weightMissRate?: number;
  /** 食事の記録を忘れる確率 */
  intakeMissRate?: number;
}

const DEFAULTS: Required<SimOptions> = { seed: 1, days: 140, startWeightKg: 75, weightNoiseKg: 0.4, intakeNoise: 0.1, weightMissRate: 0.15, intakeMissRate: 0.1 };

/** mulberry32（種つき乱数） */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

const START = new Date(2026, 0, 1);
const at = (n: number) => new Date(START.getFullYear(), START.getMonth(), START.getDate() + n);
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Check {
  day: number;
  tdeeBefore: number;
  tdeeAfter: number;
  trueTdee: number;
  applied: boolean;
  /** 予測した、これから14日の体重変化（kg）。推定 TDEE と、これから14日に記録される摂取から */
  predictedKg: number | null;
  /** 実測の、これから14日の体重変化（7日平均の差）。出せなければ null */
  actualKg: number | null;
}

export interface SimResult {
  checks: Check[];
}

/** 1 つのシナリオを動かす。週に1回（7日ごと）補正を試し、その時点の推定 TDEE で先の14日を予測する */
export function simulate(sc: Scenario, params: CorrectionParams | null, opt: SimOptions = {}): SimResult {
  const o = { ...DEFAULTS, ...opt };
  const r = rng(o.seed);
  let tdee = sc.initialTdee;
  let trueW = o.startWeightKg;
  const weights: Record<string, number> = {};
  const intake: Record<string, number> = {};
  const checks: Check[] = [];
  const pending: { check: Check; day: number }[] = [];
  const loggedByDay: (number | undefined)[] = [];
  const trueWs: number[] = [];

  // 先に全日を作る。摂取の狙いは、その日の時点の推定 TDEE から決まるので、補正と交互に進める
  for (let d = 0; d < o.days; d++) {
    const date = at(d);
    if (d >= 14 && d % 7 === 0) {
      const before = tdee;
      if (params) {
        const res = correctTdee({ prevTdee: tdee, today: date, intake, weights }, params);
        if (res.applied) tdee = res.tdee;
      }
      const c: Check = { day: d, tdeeBefore: before, tdeeAfter: tdee, trueTdee: sc.trueTdee(d), applied: tdee !== before, predictedKg: null, actualKg: null };
      checks.push(c);
      pending.push({ check: c, day: d });
    }
    const target = tdee - sc.deficit;
    const eaten = Math.max(800, target * (1 + o.intakeNoise * normal(r)));
    trueW += (eaten - sc.trueTdee(d)) / KCAL_PER_KG;
    trueWs.push(trueW);
    const logged = eaten * (1 + (sc.loggingBias ?? 0));
    loggedByDay.push(r() < o.intakeMissRate ? undefined : logged);
    if (loggedByDay[d] !== undefined) intake[key(date)] = loggedByDay[d]!;
    if (r() >= o.weightMissRate) weights[key(date)] = trueW + o.weightNoiseKg * normal(r);
  }

  for (const { check, day } of pending) {
    if (day + 14 >= o.days) continue;
    const future = loggedByDay.slice(day, day + 14).filter((v): v is number => v !== undefined);
    if (future.length >= 10) {
      const avg = future.reduce((a, b) => a + b, 0) / future.length;
      check.predictedKg = ((avg - check.tdeeAfter) * 14) / KCAL_PER_KG;
    }
    const a = weightTrend(weights, at(day));
    const b = weightTrend(weights, at(day + 14));
    if (a !== null && b !== null) check.actualKg = b - a;
  }
  return { checks };
}

export interface Metrics {
  /** 予測と実測を比べられた回数 */
  n: number;
  /** 予測した体重変化と実測の差の平均の大きさ（kg / 14日） */
  maeKg: number;
  /** 予測 − 実測 の平均（kg / 14日）。+ なら体重が減る／増えるのを、実際より多く見込んでいる */
  biasKg: number;
  /** 推定 TDEE と本当の TDEE の差の平均の大きさ（kcal/日）。最後の半分の期間 */
  tdeeMae: number;
  /** 1回の補正での TDEE の動きの平均の大きさ（kcal/日）。大きいほど表示が揺れる */
  jitter: number;
}

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN);

export function metricsOf(checks: Check[]): Metrics {
  const pairs = checks.filter((c) => c.predictedKg !== null && c.actualKg !== null);
  const errs = pairs.map((c) => c.predictedKg! - c.actualKg!);
  const half = checks.slice(Math.floor(checks.length / 2));
  return {
    n: pairs.length,
    maeKg: mean(errs.map(Math.abs)),
    biasKg: mean(errs),
    tdeeMae: mean(half.map((c) => Math.abs(c.tdeeAfter - c.trueTdee))),
    jitter: mean(checks.map((c) => Math.abs(c.tdeeAfter - c.tdeeBefore))),
  };
}

/** 種を変えて何回か動かし、全体の平均をとる */
export function backtest(sc: Scenario, params: CorrectionParams | null, seeds: number[], opt: SimOptions = {}): Metrics {
  const all = seeds.map((seed) => metricsOf(simulate(sc, params, { ...opt, seed }).checks));
  return {
    n: all.reduce((a, m) => a + m.n, 0),
    maeKg: mean(all.map((m) => m.maeKg)),
    biasKg: mean(all.map((m) => m.biasKg)),
    tdeeMae: mean(all.map((m) => m.tdeeMae)),
    jitter: mean(all.map((m) => m.jitter)),
  };
}

export const SCENARIOS: Scenario[] = [
  { name: '初期値が高い（+400）', trueTdee: () => 2400, initialTdee: 2800, deficit: 400 },
  { name: '初期値が低い（−400）', trueTdee: () => 2400, initialTdee: 2000, deficit: 400 },
  { name: '初期値が合っている', trueTdee: () => 2400, initialTdee: 2400, deficit: 400 },
  { name: '途中で消費が落ちる（−250）', trueTdee: (d) => (d < 70 ? 2400 : 2150), initialTdee: 2400, deficit: 400 },
  { name: '食事を1割少なく記録する', trueTdee: () => 2400, initialTdee: 2400, deficit: 400, loggingBias: -0.1 },
];

export const DEFAULT_SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
