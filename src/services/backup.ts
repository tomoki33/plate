import { eq } from 'drizzle-orm';
import { db, sqlite } from '../db/client';
import * as s from '../db/schema';
import { supabase } from './supabase';

/**
 * バックアップと復元。端末の全テーブルを1つのJSONにまとめて Supabase の `backups` テーブルに置く。
 * （同期は後回し。複数端末のリアルタイム同期はしない）
 *
 * 成分表（source=成分表）は本体に同梱されているので含めない。復元は「端末の記録を置き換える」。
 *
 * Supabase 側のテーブル（supabase/migrations/0001_backups.sql）:
 *   backups(user_id uuid pk, payload jsonb, updated_at timestamptz)  + RLS: 本人の行だけ読み書きできる
 */
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  createdAt: number;
  tables: Record<string, unknown[]>;
}

export async function buildPayload(): Promise<BackupPayload> {
  const foods = (await db.select().from(s.food)).filter((f) => f.source !== '成分表');
  return {
    version: BACKUP_VERSION,
    createdAt: Date.now(),
    tables: {
      profile: await db.select().from(s.profile),
      body_log: await db.select().from(s.bodyLog),
      exercise: await db.select().from(s.exercise),
      workout_template: await db.select().from(s.workoutTemplate),
      week_plan: await db.select().from(s.weekPlan),
      workout_session: await db.select().from(s.workoutSession),
      workout_set: await db.select().from(s.workoutSet),
      food: foods,
      meal_set: await db.select().from(s.mealSet),
      meal_entry: await db.select().from(s.mealEntry),
      day_target: await db.select().from(s.dayTarget),
      pace_suggestion: await db.select().from(s.paceSuggestion),
      kv: await db.select().from(s.kv),
    },
  };
}

export async function backupNow(): Promise<{ ok: boolean; error?: string; at?: number }> {
  const c = supabase();
  if (!c) return { ok: false, error: 'Supabase が設定されていません' };
  const { data: u } = await c.auth.getUser();
  if (!u.user) return { ok: false, error: 'ログインしてください' };
  const payload = await buildPayload();
  const { error } = await c.from('backups').upsert({ user_id: u.user.id, payload, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: error.message } : { ok: true, at: payload.createdAt };
}

export async function latestBackupAt(): Promise<number | null> {
  const c = supabase();
  if (!c) return null;
  const { data: u } = await c.auth.getUser();
  if (!u.user) return null;
  const { data } = await c.from('backups').select('updated_at').eq('user_id', u.user.id).maybeSingle();
  return data?.updated_at ? new Date(data.updated_at).getTime() : null;
}

/** 復元：端末の記録をバックアップの内容に置き換える（成分表は残す） */
export async function restoreLatest(): Promise<{ ok: boolean; error?: string }> {
  const c = supabase();
  if (!c) return { ok: false, error: 'Supabase が設定されていません' };
  const { data: u } = await c.auth.getUser();
  if (!u.user) return { ok: false, error: 'ログインしてください' };
  const { data, error } = await c.from('backups').select('payload').eq('user_id', u.user.id).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'バックアップがありません' };
  return applyPayload(data.payload as BackupPayload);
}

export async function applyPayload(p: BackupPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p || p.version !== BACKUP_VERSION || typeof p.tables !== 'object') return { ok: false, error: '対応していないバックアップです' };
  const t = p.tables as Record<string, never[]>;
  try {
    await sqlite.withTransactionAsync(async () => {
      const tx = db;
      await tx.delete(s.mealEntry);
      await tx.delete(s.bodyLog);
      await tx.delete(s.workoutSet);
      await tx.delete(s.workoutSession);
      await tx.delete(s.dayTarget);
      await tx.delete(s.paceSuggestion);
      await tx.delete(s.mealSet);
      await tx.delete(s.kv);
      await tx.delete(s.weekPlan);
      await tx.delete(s.workoutTemplate);
      await tx.delete(s.exercise);
      await tx.delete(s.profile);
      await tx.delete(s.food).where(eq(s.food.source, '自作'));
      await tx.delete(s.food).where(eq(s.food.source, 'AI'));
      const ins = async (table: never, rows: never[]) => {
        for (let i = 0; i < rows.length; i += 50) await tx.insert(table).values(rows.slice(i, i + 50) as never);
      };
      await ins(s.profile as never, t.profile ?? []);
      await ins(s.exercise as never, t.exercise ?? []);
      await ins(s.workoutTemplate as never, t.workout_template ?? []);
      await ins(s.weekPlan as never, t.week_plan ?? []);
      await ins(s.food as never, t.food ?? []);
      await ins(s.mealSet as never, t.meal_set ?? []);
      await ins(s.bodyLog as never, t.body_log ?? []);
      await ins(s.mealEntry as never, t.meal_entry ?? []);
      await ins(s.workoutSession as never, t.workout_session ?? []);
      await ins(s.workoutSet as never, t.workout_set ?? []);
      await ins(s.dayTarget as never, t.day_target ?? []);
      await ins(s.paceSuggestion as never, t.pace_suggestion ?? []);
      await ins(s.kv as never, t.kv ?? []);
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
