/**
 * コーチ画面の集計（純粋関数）。スナップショットと「今日（生徒のタイムゾーン）」から、
 * 一覧の週バー・警告バッジ・並び順・KPI・体重の推移を出す。Web 管理画面からも同じものを使う。
 */
import { addKey, diffDays, todayIn, weekStartKey } from './dateKeys';
import type { PlanRow, Snapshot, SnapshotDay, SnapshotSession, StudentRow } from './types';

/** 警告の条件（README_coach.md） */
export const STALE_DAYS = 3;
export const P_SHORT_RATIO = 0.85;

export type DayMark = 'train' | 'log' | 'none';

const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export const snapshotToday = (s: Snapshot, now: Date = new Date()) => todayIn(s.tz || 'Asia/Tokyo', now);

const dayMap = (s: Snapshot) => new Map<string, SnapshotDay>((s.meals?.days ?? []).map((d) => [d.date, d]));
const weightMap = (s: Snapshot) => new Map<string, number>((s.weight?.entries ?? []).map((e) => [e.date, e.kg]));

/** その日に記録があるか。食事を見せていれば食事、見せていなければ体重で数える */
export function isLogged(s: Snapshot, date: string): boolean {
  if (s.meals) return (dayMap(s).get(date)?.kcal ?? 0) > 0;
  if (s.weight) return weightMap(s).has(date);
  return false;
}
export const hasTrained = (s: Snapshot, date: string) => !!s.training?.sessions.some((x) => x.date === date);

/** 月曜から7日分のバー：トレーニング日 / 記録のみ / 記録なし */
export function weekMarks(s: Snapshot, ws: string): DayMark[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = addKey(ws, i);
    return hasTrained(s, d) ? 'train' : isLogged(s, d) ? 'log' : 'none';
  });
}
/** 記録した日の数（トレーニングだけの日は数えない） */
export function daysLogged(s: Snapshot, ws: string, until?: string): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addKey(ws, i);
    if (until && d > until) break;
    if (isLogged(s, d)) n++;
  }
  return n;
}

export function lastLoggedDate(s: Snapshot, todayKey: string): string | null {
  const dates = new Set<string>();
  for (const d of s.meals?.days ?? []) if (d.kcal > 0) dates.add(d.date);
  if (!s.meals) for (const e of s.weight?.entries ?? []) dates.add(e.date);
  const past = [...dates].filter((d) => d <= todayKey).sort();
  return past.length ? past[past.length - 1] : null;
}

/** 記録した日のたんぱく質の平均（g）。その週に記録した日がなければ null */
export function proteinAvg(s: Snapshot, ws: string, until?: string): number | null {
  const m = dayMap(s);
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addKey(ws, i);
    if (until && d > until) break;
    const day = m.get(d);
    if (day && day.kcal > 0) v.push(day.P);
  }
  return v.length ? Math.round(sum(v) / v.length) : null;
}

/** その日を終点とする7日間の体重平均（記録が1日でもあれば出す） */
export function weightAvg7(s: Snapshot, end: string): number | null {
  const m = weightMap(s);
  const v: number[] = [];
  for (let i = 0; i < 7; i++) {
    const w = m.get(addKey(end, -i));
    if (w !== undefined) v.push(w);
  }
  return v.length ? round1(sum(v) / v.length) : null;
}

export interface Warning {
  /** 記録が止まっている日数（3日以上のときだけ） */
  staleDays: number | null;
  pShort: boolean;
}
/** 警告バッジの条件。joinedKey は、まだ記録がない人の「何日 記録なし」の起点 */
export function warningsOf(s: Snapshot, todayKey: string, joinedKey?: string): Warning {
  const last = lastLoggedDate(s, todayKey) ?? joinedKey ?? null;
  const gap = last ? diffDays(todayKey, last) : null;
  const staleDays = gap !== null && gap >= STALE_DAYS ? gap : null;
  const avg = proteinAvg(s, weekStartKey(todayKey), todayKey);
  const pShort = !!s.meals && avg !== null && s.profile.proteinG > 0 && avg < s.profile.proteinG * P_SHORT_RATIO;
  return { staleDays, pShort };
}
export function badgeText(w: Warning): string | null {
  if (w.staleDays !== null) return `${w.staleDays}日 記録なし`;
  return w.pShort ? 'P 不足' : null;
}

export interface StudentSummary {
  row: StudentRow;
  snapshot: Snapshot | null;
  today: string;
  marks: DayMark[];
  days: number;
  badge: string | null;
  lastLogged: string | null;
  paused: boolean;
}

export function summarize(row: StudentRow, now: Date = new Date()): StudentSummary {
  const s = row.payload;
  if (!s || row.status === 'paused') {
    return { row, snapshot: null, today: todayIn('Asia/Tokyo', now), marks: Array(7).fill('none'), days: 0, badge: null, lastLogged: null, paused: row.status === 'paused' };
  }
  const today = snapshotToday(s, now);
  const ws = weekStartKey(today);
  const joined = row.joinedAt ? row.joinedAt.slice(0, 10) : undefined;
  return {
    row,
    snapshot: s,
    today,
    marks: weekMarks(s, ws),
    days: daysLogged(s, ws, today),
    badge: badgeText(warningsOf(s, today, joined)),
    lastLogged: lastLoggedDate(s, today),
    paused: false,
  };
}

/** 「止まっている順」＝今週の記録日数が少ない順。同数は最終記録が古い順。一時停止中は最後 */
export function sortStalled(list: StudentSummary[]): StudentSummary[] {
  return [...list].sort((a, b) => {
    if (a.paused !== b.paused) return a.paused ? 1 : -1;
    if (a.days !== b.days) return a.days - b.days;
    return (a.lastLogged ?? '').localeCompare(b.lastLogged ?? '');
  });
}
export const sortJoined = (list: StudentSummary[]) => [...list].sort((a, b) => a.row.joinedAt.localeCompare(b.row.joinedAt));
export const needCount = (list: StudentSummary[]) => list.filter((x) => x.badge).length;

// ---- 生徒詳細 ----

export interface Kpi {
  key: 'logged' | 'weight' | 'protein' | 'training';
  label: string;
  value: string;
  unit: string;
  note: string;
  /** しきい値を下回っているか（数字を #E85C31、補足を #B5421C にする） */
  low: boolean;
  /** 共有されていない項目 */
  hidden: boolean;
}

export function kpisOf(s: Snapshot, ws: string, todayKey: string): Kpi[] {
  const end = todayKey < addKey(ws, 6) ? todayKey : addKey(ws, 6);
  const elapsed = Math.max(1, diffDays(end, ws) + 1);
  const hiddenKpi = (key: Kpi['key'], label: string, unit: string): Kpi => ({ key, label, value: '非公開', unit: '', note: unit, low: false, hidden: true });

  const out: Kpi[] = [];
  if (s.meals || s.weight) {
    const n = daysLogged(s, ws, end);
    out.push({ key: 'logged', label: '記録した日', value: `${n}`, unit: '/7', note: elapsed < 7 ? `${elapsed}日経過` : '', low: n / elapsed < 0.6, hidden: false });
  } else out.push(hiddenKpi('logged', '記録した日', ''));

  if (s.weight) {
    const now = weightAvg7(s, end);
    const prev = weightAvg7(s, addKey(end, -7));
    const diff = now !== null && prev !== null ? round1(now - prev) : null;
    out.push({ key: 'weight', label: '体重7日平均', value: now !== null ? now.toFixed(1) : '—', unit: 'kg', note: diff !== null ? `先週比 ${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff).toFixed(1)}` : '先週の記録なし', low: false, hidden: false });
  } else out.push(hiddenKpi('weight', '体重7日平均', ''));

  if (s.meals) {
    const p = proteinAvg(s, ws, end);
    const goal = s.profile.proteinG;
    out.push({ key: 'protein', label: 'P平均', value: p !== null ? `${p}` : '—', unit: 'g', note: `目標 ${goal}g`, low: p !== null && goal > 0 && p < goal * P_SHORT_RATIO, hidden: false });
  } else out.push(hiddenKpi('protein', 'P平均', ''));

  if (s.training) {
    const n = s.training.sessions.filter((x) => x.date >= ws && x.date <= end).length;
    const planned = s.profile.plannedPerWeek;
    out.push({ key: 'training', label: 'トレーニング', value: `${n}`, unit: planned ? `/${planned}回` : '回', note: '', low: planned > 0 && n < Math.floor((planned * elapsed) / 7), hidden: false });
  } else out.push(hiddenKpi('training', 'トレーニング', ''));
  return out;
}

export interface MealBar {
  date: string;
  kcal: number | null;
  P: number | null;
  targetKcal: number | null;
  dayType: SnapshotDay['dayType'];
  logged: boolean;
}
export function mealBars(s: Snapshot, ws: string): MealBar[] {
  const m = dayMap(s);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addKey(ws, i);
    const day = m.get(d);
    const logged = !!day && day.kcal > 0;
    return { date: d, kcal: logged ? day!.kcal : null, P: logged ? day!.P : null, targetKcal: day?.targetKcal ?? null, dayType: day?.dayType ?? s.profile.weekTypes[i] ?? null, logged };
  });
}

/** 7日平均の推移：週の終わり（今週は今日）ごと、古い順。記録がない週は null */
export function weightSeries(s: Snapshot, todayKey: string, weeks = 8): (number | null)[] {
  return Array.from({ length: weeks }, (_, i) => weightAvg7(s, addKey(todayKey, -7 * (weeks - 1 - i))));
}

export function trainingHistory(s: Snapshot, limit = 20): SnapshotSession[] {
  return [...(s.training?.sessions ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** 直近で食事が記録された日（昨日以前を優先）の一覧 */
export function recentMealDay(s: Snapshot, todayKey: string): { date: string; meals: NonNullable<Snapshot['meals']>['recent'] } | null {
  const list = s.meals?.recent ?? [];
  const dates = [...new Set(list.map((m) => m.date))].sort().reverse();
  const yesterday = addKey(todayKey, -1);
  const pick = dates.find((d) => d <= yesterday) ?? dates[0];
  return pick ? { date: pick, meals: list.filter((m) => m.date === pick) } : null;
}

/** そのメニューが、いま何人に送られているか（各生徒の最新の目標プランに含まれる数） */
export function menuUsage(rows: StudentRow[], menuId: string): number {
  return rows.filter((r) => r.plan?.menus.some((m) => m.id === menuId)).length;
}
export const latestPlan = (r: StudentRow): PlanRow | null => r.plan;
