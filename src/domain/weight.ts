import { addDays, dateKey } from './dates';

/**
 * 体重まわりの計算（純粋関数）。
 * - 7日平均：その日から過去7日の記録の平均（記録がない日は飛ばす）。Pの計算に使う体重もこれ
 * - ペース(kg/週) = （今日の7日平均 − 14日前の7日平均）÷ 2
 * - 到達予測 = （7日平均 − 目標）÷ ペース
 */
export type WeightLog = Record<string, number>;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function avg7(weights: WeightLog, end: Date): number | null {
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const w = weights[dateKey(addDays(end, -i))];
    if (w !== undefined) v.push(w);
  }
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Pの計算に使う体重：7日平均。記録がなければ、いちばん新しい記録。何もなければ null */
export function weightForProtein(weights: WeightLog, today: Date): number | null {
  const a = avg7(weights, today);
  if (a !== null) return round1(a);
  const keys = Object.keys(weights).filter((k) => k <= dateKey(today)).sort();
  return keys.length ? weights[keys[keys.length - 1]] : null;
}

/** 直近2週のペース（kg/週）。どちらかの7日平均が出せなければ null */
export function paceKgPerWeek(weights: WeightLog, today: Date): number | null {
  const now = avg7(weights, today);
  const before = avg7(weights, addDays(today, -14));
  if (now === null || before === null) return null;
  return round1((now - before) / 2);
}

/** 先週との差（今日の7日平均 − 7日前の7日平均） */
export function weekDiff(weights: WeightLog, today: Date): number | null {
  const now = avg7(weights, today);
  const prev = avg7(weights, addDays(today, -7));
  return now === null || prev === null ? null : now - prev;
}

/** 「+0.3」「−0.5」「±0.0」（0.04以内は±） */
export const signed1 = (v: number) => `${v > 0.04 ? '+' : v < -0.04 ? '−' : '±'}${Math.abs(v).toFixed(1)}`;

export type Eta = { kind: 'reached' } | { kind: 'never' } | { kind: 'date'; date: Date };

/**
 * 目標体重に届く日。direction は目標へ向かう向き（減量＝'down'、増量＝'up'）。
 * すでに目標を越えていれば到達済み。ペースが向きと逆（または止まっている）なら「届かない」。
 */
export function etaTo(avg: number, goal: number, pace: number, today: Date, direction: 'down' | 'up' = avg >= goal ? 'down' : 'up'): Eta {
  const reached = direction === 'down' ? avg <= goal + 0.05 : avg >= goal - 0.05;
  if (reached) return { kind: 'reached' };
  const wrongWay = direction === 'down' ? pace > -0.05 : pace < 0.05;
  if (wrongWay) return { kind: 'never' };
  return { kind: 'date', date: addDays(today, Math.round(((goal - avg) / pace) * 7)) };
}

/** 「2027年1月上旬」「今のままでは届かない」「到達済み」 */
export function etaLabel(e: Eta): string {
  if (e.kind === 'reached') return '到達済み';
  if (e.kind === 'never') return '今のままでは届かない';
  const d = e.date.getDate();
  return `${e.date.getFullYear()}年${e.date.getMonth() + 1}月${d <= 10 ? '上旬' : d <= 20 ? '中旬' : '下旬'}`;
}

// ---- ペースの見直し ----

export const PACE_STEP_KCAL = 700;

export interface PaceSuggestion {
  /** 週の合計に足す量（減量なら −700、増量なら +700） */
  deltaKcal: number;
  /** 画面に出す文 */
  message: string;
}

/**
 * 7日平均の2週間の動きが、予定のペースより 0.1kg/週 以上遅いとき（増量のときは逆）に、週の合計の見直しを提案する。
 * 勝手には変えない。同じ週に答え済みなら出さない。
 * @param planned 予定のペース（kg/週。減量はマイナス）。0（維持）のときは出さない
 */
export function suggestPace(input: { planned: number; actual: number | null; answeredThisWeek: boolean }): PaceSuggestion | null {
  const { planned, actual, answeredThisWeek } = input;
  if (answeredThisWeek || actual === null || Math.abs(planned) < 0.05) return null;
  const cutting = planned < 0;
  const slower = cutting ? actual - planned >= 0.1 - 1e-9 : planned - actual >= 0.1 - 1e-9;
  if (!slower) return null;
  const delta = cutting ? -PACE_STEP_KCAL : PACE_STEP_KCAL;
  const perDay = Math.round(PACE_STEP_KCAL / 7 / 10) * 10;
  const verb = cutting ? '減り' : '増え';
  return {
    deltaKcal: delta,
    message: `2週続けて、${verb}方が予定より遅めです（${signed1(actual)}kg/週、予定 ${signed1(planned)}）。週の合計を${PACE_STEP_KCAL}kcal${cutting ? '減らし' : '増やし'}ますか？（1日あたり約${cutting ? '−' : '+'}${perDay}kcal）`,
  };
}

// ---- グラフの座標 ----

export interface ChartPoint {
  x: number;
  y: number;
}
export interface WeightChart {
  dots: ChartPoint[];
  avg: ChartPoint[];
  /** 今のペースの見込み（今日から右へ）。fut が 0 なら null */
  proj: { from: ChartPoint; to: ChartPoint } | null;
  goalY: number | null;
  todayX: number;
  ticks: { y: number; label: string }[];
  startDate: Date;
  /** 何も描けない（記録がない） */
  empty: boolean;
}

/**
 * 体重グラフの座標を作る。N 日前から今日までを描き、fut 日ぶん右に余白をとって見込みの線を伸ばす。
 * 左端 padL は目盛りの幅。y は上が大きい値。
 */
export function buildWeightChart(o: { weights: WeightLog; today: Date; days: number; fut: number; goal: number | null; pace: number; W: number; H: number; padL: number }): WeightChart {
  const { weights, today, days: N, fut, goal, pace, W, H, padL } = o;
  const span = N + fut;
  const x = (d: number) => padL + ((N - d) / span) * (W - padL - 4);
  const pts: { d: number; v: number }[] = [];
  const avgs: { d: number; v: number }[] = [];
  for (let d = N; d >= 0; d--) {
    const w = weights[dateKey(addDays(today, -d))];
    if (w !== undefined) pts.push({ d, v: w });
    const a = avg7(weights, addDays(today, -d));
    if (a !== null) avgs.push({ d, v: a });
  }
  const startDate = addDays(today, -N);
  if (!pts.length) return { dots: [], avg: [], proj: null, goalY: null, todayX: x(0), ticks: [], startDate, empty: true };

  const last = avg7(weights, today) ?? avgs[avgs.length - 1].v;
  const end = last + (pace * fut) / 7;
  const vals = [...pts.map((p) => p.v), ...(goal !== null ? [goal] : []), ...(fut ? [end] : [])];
  const lo = Math.min(...vals) - 0.3;
  const hi = Math.max(...vals) + 0.3;
  const y = (v: number) => 8 + ((hi - v) / (hi - lo)) * (H - 30);
  const ticks = [hi - 0.3, (hi + lo) / 2, lo + 0.3].map((t) => ({ y: y(t), label: t.toFixed(1) }));
  return {
    dots: pts.map((p) => ({ x: x(p.d), y: y(p.v) })),
    avg: avgs.map((p) => ({ x: x(p.d), y: y(p.v) })),
    proj: fut ? { from: { x: x(0), y: y(last) }, to: { x: x(-fut), y: y(end) } } : null,
    goalY: goal !== null ? y(goal) : null,
    todayX: x(0),
    ticks,
    startDate,
    empty: false,
  };
}
