import { db, sqlite } from '../db/client';
import { applyPayloadTo, BACKUP_VERSION, buildPayloadFrom, type BackupPayload } from '../db/restore';
import { downloadPhotos, uploadPhotos } from './photoSync';
import { supabase } from './supabase';

/**
 * バックアップと復元。端末の全テーブルを1つのJSONにまとめて Supabase の `backups` テーブルに置く。
 * （同期は後回し。複数端末のリアルタイム同期はしない）
 *
 * 成分表（source=成分表）は本体に同梱されているので含めない。復元は「端末の記録を置き換える」。
 *
 * Supabase 側のテーブル（supabase/migrations/20260928190100_backups.sql）:
 *   backups(user_id uuid pk, payload jsonb, updated_at timestamptz)  + RLS: 本人の行だけ読み書きできる
 */
export { BACKUP_VERSION, type BackupPayload };

export function buildPayload(): Promise<BackupPayload> {
  return buildPayloadFrom(db);
}

export async function backupNow(): Promise<{ ok: boolean; error?: string; at?: number }> {
  const c = supabase();
  if (!c) return { ok: false, error: 'Supabase が設定されていません' };
  const { data: u } = await c.auth.getUser();
  if (!u.user) return { ok: false, error: 'ログインしてください' };
  const payload = await buildPayload();
  const { error } = await c.from('backups').upsert({ user_id: u.user.id, payload, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  // 写真は、記録のバックアップとは別に上げる（失敗しても、記録のバックアップは成功のまま。次回に続きから上げる）
  try {
    await uploadPhotos(u.user.id);
  } catch (e) {
    return { ok: true, at: payload.createdAt, error: `写真のバックアップは未完了です（${e instanceof Error ? e.message : String(e)}）` };
  }
  return { ok: true, at: payload.createdAt };
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
  const r = await applyPayload(data.payload as BackupPayload);
  if (r.ok) await downloadPhotos(u.user.id).catch(() => 0);
  return r;
}

export function applyPayload(p: BackupPayload): Promise<{ ok: boolean; error?: string }> {
  return applyPayloadTo(db, (fn) => sqlite.withTransactionAsync(fn), p);
}
