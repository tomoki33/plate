/**
 * 週カロリー目標の算出（設計書「目標エンジン仕様」1）。
 * 初期TDEE = Mifflin-St Jeor × 活動係数。3週目以降は実データで補正する。
 */
export type Sex = 'male' | 'female';
export type Goal = 'cut' | 'maintain' | 'bulk';

export const GOAL_JP: Record<Goal, string> = { cut: '減量', maintain: '維持', bulk: '増量' };
export const KCAL_PER_KG = 7700;

export interface ActivityLevel {
  value: number;
  label: string;
  note: string;
}
export const ACTIVITY_LEVELS: ActivityLevel[] = [
  { value: 1.375, label: '低め', note: '週1〜2回の運動、デスクワーク中心' },
  { value: 1.55, label: '標準', note: '週3〜5回のトレーニング、立ち仕事も少し' },
  { value: 1.725, label: '高め', note: '週5回以上のトレーニング、体を使う仕事' },
];

export interface Profile {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  activity: number;
  goal: Goal;
  /** kg/週。減量はマイナス */
  pace: number;
}

export const DEFAULT_PROFILE: Profile = { sex: 'male', birthYear: 1997, heightCm: 172, activity: 1.55, goal: 'cut', pace: -0.35 };

export const ageOf = (birthYear: number, now: Date) => Math.max(15, now.getFullYear() - birthYear);

/** 基礎代謝（Mifflin-St Jeor） */
export function bmr(p: Pick<Profile, 'sex' | 'heightCm'>, weightKg: number, age: number): number {
  return 10 * weightKg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161);
}

export const initialTdee = (p: Profile, weightKg: number, now: Date) => bmr(p, weightKg, ageOf(p.birthYear, now)) * p.activity;

/** kcal_week = 7 × (TDEE + r × 7700 / 7) */
export const weekKcalOf = (tdee: number, paceKgPerWeek: number) => Math.round(7 * (tdee + (paceKgPerWeek * KCAL_PER_KG) / 7));

/** 目標ペースの範囲（体重比）。減量 0.5〜1%/週、増量 0.25〜0.5%/週 */
export function paceBounds(goal: Goal, weightKg: number): { min: number; max: number } {
  if (goal === 'cut') return { min: 0.005 * weightKg, max: 0.01 * weightKg };
  if (goal === 'bulk') return { min: 0.0025 * weightKg, max: 0.005 * weightKg };
  return { min: 0, max: 0 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 選べるペースの候補（kg/週、符号つき）。維持は 0 のみ */
export function paceOptions(goal: Goal, weightKg: number): number[] {
  if (goal === 'maintain') return [0];
  const { min, max } = paceBounds(goal, weightKg);
  const sign = goal === 'cut' ? -1 : 1;
  const out: number[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) out.push(sign * round2(min + ((max - min) * i) / (n - 1)));
  return out;
}

export function clampPace(goal: Goal, weightKg: number, pace: number): number {
  if (goal === 'maintain') return 0;
  const { min, max } = paceBounds(goal, weightKg);
  const sign = goal === 'cut' ? -1 : 1;
  return sign * round2(Math.min(max, Math.max(min, Math.abs(pace))));
}

/** 目標（設定が変わったときの初期ペース）＝範囲の下限側から少し上 */
export function defaultPace(goal: Goal, weightKg: number): number {
  return paceOptions(goal, weightKg)[1] ?? 0;
}

export const defaultPk = (goal: Goal) => (goal === 'cut' ? 2.2 : 2.0);

export interface Warning {
  code: 'below-floor' | 'pace-too-fast';
  text: string;
}

/**
 * 極端な減量の助長を避けるための警告。
 * 1日平均が基礎代謝を下回る、またはペースが体重の1%/週を超える場合。
 */
export function checkWarnings(p: Profile, weightKg: number, weekKcal: number, now: Date): Warning[] {
  const out: Warning[] = [];
  const floor = Math.max(1200, bmr(p, weightKg, ageOf(p.birthYear, now)));
  if (weekKcal / 7 < floor) out.push({ code: 'below-floor', text: `1日平均 ${Math.round(weekKcal / 7)}kcal は基礎代謝の目安（${Math.round(floor)}kcal）を下回ります。ペースをゆるめてください。` });
  if (p.goal === 'cut' && Math.abs(p.pace) > 0.01 * weightKg + 1e-6) out.push({ code: 'pace-too-fast', text: '減量ペースが体重の1%/週を超えています。' });
  return out;
}

export interface CorrectionInput {
  prevTdee: number;
  today: Date;
  /** yyyy-mm-dd → その日の摂取kcal（記録がある日だけ） */
  intake: Record<string, number>;
  /** yyyy-mm-dd → 体重 */
  weights: Record<string, number>;
}
export interface CorrectionResult {
  tdee: number;
  applied: boolean;
  reason?: string;
  measured?: number;
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shift = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** その日を終点とする7日間の体重平均（記録が3日以上あるときだけ） */
export function weightTrend(weights: Record<string, number>, end: Date): number | null {
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const w = weights[key(shift(end, -i))];
    if (w !== undefined) v.push(w);
  }
  return v.length >= 3 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export const BLEND_NEW = 0.3;
const MIN_INTAKE_DAYS = 10;
const MAX_STEP = 0.15;

/**
 * 実データによるTDEE補正。
 * TDEE = 直近14日の平均摂取kcal − ΔW_trend[kg] × 7700 / 14
 * 急変を避けるため、前回値との加重平均（新30%）をとり、1回の変化は±15%までにする。
 * 摂取の記録が14日中10日未満、または体重トレンドが出せないときは補正しない。
 */
export function correctTdee(inp: CorrectionInput): CorrectionResult {
  const days = Array.from({ length: 14 }, (_, i) => key(shift(inp.today, -i)));
  const logged = days.filter((d) => inp.intake[d] !== undefined && inp.intake[d] > 0);
  if (logged.length < MIN_INTAKE_DAYS) return { tdee: inp.prevTdee, applied: false, reason: '食事の記録が足りません' };
  const now = weightTrend(inp.weights, inp.today);
  const before = weightTrend(inp.weights, shift(inp.today, -14));
  if (now === null || before === null) return { tdee: inp.prevTdee, applied: false, reason: '体重の記録が足りません' };
  const avgKcal = logged.reduce((a, d) => a + inp.intake[d], 0) / logged.length;
  const measured = avgKcal - ((now - before) * KCAL_PER_KG) / 14;
  const blended = inp.prevTdee * (1 - BLEND_NEW) + measured * BLEND_NEW;
  const lo = inp.prevTdee * (1 - MAX_STEP);
  const hi = inp.prevTdee * (1 + MAX_STEP);
  return { tdee: Math.round(Math.min(hi, Math.max(lo, blended))), applied: true, measured: Math.round(measured) };
}

// ---- 日ごとの食べる量（日タイプ係数を、利用者向けに言い換えたもの） ----

export type SpreadPreset = 'small' | 'standard' | 'large';

/**
 * 「差を小さく／標準／差を大きく」。通常の日を基準(1.00)に、高い日とオフの日をどれだけ動かすか。
 * 標準は設計書の初期値（高 1.15／オフ 0.85）。
 */
export const SPREAD_PRESETS: Record<SpreadPreset, { label: string; high: number; off: number }> = {
  small: { label: '差を小さく', high: 1.07, off: 0.93 },
  standard: { label: '標準', high: 1.15, off: 0.85 },
  large: { label: '差を大きく', high: 1.25, off: 0.75 },
};

export const SPREAD_LIMITS = { highMax: 40, offMax: 40 } as const;

const near = (a: number, b: number) => Math.abs(a - b) < 0.005;

/** いまの係数がどの3段階に当てはまるか（細かく調整して外れたら null） */
export function matchSpreadPreset(c: { high: number; normal: number; off: number }): SpreadPreset | null {
  if (!near(c.normal, 1)) return null;
  for (const [k, p] of Object.entries(SPREAD_PRESETS) as [SpreadPreset, (typeof SPREAD_PRESETS)[SpreadPreset]][]) {
    if (near(c.high, p.high) && near(c.off, p.off)) return k;
  }
  return null;
}

/** 通常の日を基準にした増減（%）。高い日は +、オフの日は − */
export function spreadPercents(c: { high: number; normal: number; off: number }): { high: number; off: number } {
  return { high: Math.round((c.high / c.normal - 1) * 100), off: Math.round((1 - c.off / c.normal) * 100) };
}

/** 増減（%）から係数へ。通常の日は 1.00 に固定する */
export function coefFromPercents(highPct: number, offPct: number): { high: number; normal: number; off: number } {
  const h = Math.min(SPREAD_LIMITS.highMax, Math.max(0, Math.round(highPct)));
  const o = Math.min(SPREAD_LIMITS.offMax, Math.max(0, Math.round(offPct)));
  return { high: Math.round((1 + h / 100) * 100) / 100, normal: 1, off: Math.round((1 - o / 100) * 100) / 100 };
}

/** 1日のたんぱく質（g）。体重 × P係数 */
export const dailyProtein = (weightKg: number, pk: number) => Math.round(weightKg * pk);
