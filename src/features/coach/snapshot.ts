/**
 * 生徒 → コーチに送るスナップショットを作る（純粋関数）。
 * 共有を許した項目だけを入れる。写真・メモ・生年月日などのプロフィールは入れない。
 */
import type { MealEntry, SessionRecord } from '../../domain/models';
import type { Goal } from '../../domain/nutrition';
import type { Coef, DayType } from '../../domain/types';
import { addKey, todayIn } from './dateKeys';
import type { Snapshot, SnapshotDay, SnapshotSession, ShareFlags } from './types';

export const SNAPSHOT_WEEKS = 9;

export interface SnapshotSource {
  now: Date;
  tz: string;
  share: ShareFlags;
  profile: { goal: Goal; goalWeightKg: number | null; pace: number; tdee: number; coef: Coef; pk: number };
  managed: { proteinG: number; fatPct: number } | null;
  /** 週の予定（月〜日）の日タイプと、トレーニングの日数 */
  weekTypes: DayType[];
  plannedPerWeek: number;
  weekKcal: number;
  weights: Record<string, number>;
  meals: MealEntry[];
  sessions: SessionRecord[];
  /** 日ごとの目標（記録があれば） */
  targets: Record<string, { dayType: DayType; kcal: number }>;
  /** 体重（P の計算用）。なければ null */
  weightKg: number | null;
}

/** 推定1RM で自己ベストを更新したセッションか（同じ種目名の、それ以前の最大より大きい） */
export function prFlags(sessions: SessionRecord[]): Map<string, boolean> {
  const bestBefore = new Map<string, number>();
  const out = new Map<string, boolean>();
  for (const s of [...sessions].sort((a, b) => a.startedAt - b.startedAt)) {
    let pr = false;
    if (s.best) {
      const prev = bestBefore.get(s.best.name);
      pr = prev !== undefined && s.best.e1rm > prev;
      bestBefore.set(s.best.name, Math.max(prev ?? 0, s.best.e1rm));
    }
    out.set(s.id, pr);
  }
  return out;
}

export function buildSnapshot(src: SnapshotSource): Snapshot {
  const today = todayIn(src.tz, src.now);
  const from = addKey(today, -(SNAPSHOT_WEEKS * 7));
  const proteinG = src.managed?.proteinG ?? (src.weightKg ? Math.round(src.weightKg * src.profile.pk) : 0);
  const snap: Snapshot = {
    v: 1,
    tz: src.tz,
    updatedAt: src.now.getTime(),
    today,
    profile: {
      goal: src.profile.goal,
      goalWeightKg: src.profile.goalWeightKg,
      pace: src.profile.pace,
      proteinG,
      fatPct: src.managed?.fatPct ?? null,
      tdee: Math.round(src.profile.tdee),
      weekKcal: Math.round(src.weekKcal),
      coef: src.profile.coef,
      weekTypes: src.weekTypes,
      plannedPerWeek: src.plannedPerWeek,
      managed: !!src.managed,
    },
  };

  if (src.share.meals) {
    const byDate = new Map<string, SnapshotDay>();
    for (const m of src.meals) {
      if (m.date < from || m.date > today) continue;
      const t = src.targets[m.date];
      const d = byDate.get(m.date) ?? { date: m.date, kcal: 0, P: 0, F: 0, C: 0, targetKcal: t?.kcal ?? null, dayType: t?.dayType ?? null };
      d.kcal += m.kcal;
      d.P += m.P;
      d.F += m.F;
      d.C += m.C;
      byDate.set(m.date, d);
    }
    const days = [...byDate.values()].map((d) => ({ ...d, kcal: Math.round(d.kcal), P: Math.round(d.P), F: Math.round(d.F), C: Math.round(d.C) })).sort((a, b) => a.date.localeCompare(b.date));
    const recentFrom = addKey(today, -7);
    const recent = src.meals
      .filter((m) => m.date >= recentFrom && m.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      // 名前はまとまり（グループ）の名前。写真・メモは入れない
      .map((m) => ({ date: m.date, slot: m.slot, name: m.groupName || m.name, kcal: Math.round(m.kcal), P: Math.round(m.P), F: Math.round(m.F), C: Math.round(m.C), input: m.inputType }));
    // 同じまとまりは1行にする
    const seen = new Set<string>();
    const merged: typeof recent = [];
    for (const r of recent) {
      const k = `${r.date}|${r.slot}|${r.name}`;
      const ex = merged.find((x) => `${x.date}|${x.slot}|${x.name}` === k);
      if (ex && seen.has(k)) {
        ex.kcal += r.kcal;
        ex.P += r.P;
        ex.F += r.F;
        ex.C += r.C;
      } else {
        seen.add(k);
        merged.push({ ...r });
      }
    }
    snap.meals = { days, recent: merged };
  }

  if (src.share.weight) {
    snap.weight = {
      entries: Object.entries(src.weights)
        .filter(([d]) => d >= from && d <= today)
        .map(([date, kg]) => ({ date, kg }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  if (src.share.training) {
    const pr = prFlags(src.sessions);
    const sessions: SnapshotSession[] = src.sessions
      .filter((s) => s.date >= from && s.date <= today)
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(-60)
      .map((s) => ({
        date: s.date,
        name: s.name,
        best: s.best ? { name: s.best.name, e1rm: Math.round(s.best.e1rm), pr: pr.get(s.id) ?? false } : null,
        exercises: s.exercises.map((e) => ({ name: e.name, sets: e.sets.filter((x) => x.done).map((x) => ({ kg: x.kg, reps: x.reps })) })).filter((e) => e.sets.length),
      }));
    snap.training = { sessions };
  }
  return snap;
}
