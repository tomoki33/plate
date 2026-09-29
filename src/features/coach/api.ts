/**
 * コーチモードのサーバー呼び出し（Supabase の RPC とテーブル）。
 * 失敗は例外にせず { ok:false, error } で返す（画面にそのまま出せる日本語）。
 */
import { supabase } from '../../services/supabase';
import type { CoachInfo, CoachMenu, Inbox, MyLink, PlanRow, ShareFlags, Snapshot, StudentRow } from './types';
import type { PlanDraft } from './plan';

export type Res<T> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  invalid_code: 'このコードは見つかりませんでした。もう一度確かめてください。',
  too_many_attempts: '間違いが続いたため、しばらく使えません。1時間ほどあけて、もう一度お試しください。',
  own_code: '自分の招待コードは使えません。',
  coach_full: 'このコーチは、受け入れられる生徒の上限に達しています。',
  already_linked: 'すでに別のコーチとつながっています。先に共有をやめてください。',
  not_linked: 'この生徒とはつながっていません。',
  not_a_coach: 'コーチとして登録されていません。',
  not_authenticated: 'ログインしてください。',
};
const friendly = (m: string) => MESSAGES[m] ?? (/network|fetch|failed/i.test(m) ? '通信できませんでした。もう一度お試しください。' : m);
const NOT_READY: Res<never> = { ok: false, error: 'ログインしてください。' };

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<Res<T>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { data, error } = await c.rpc(name, args as never);
  if (error) return { ok: false, error: friendly(error.message) };
  // 業務上の失敗は { error } で返ってくる（例外にすると失敗回数が巻き戻るため）
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in (data as object) && typeof (data as { error: unknown }).error === 'string') {
    return { ok: false, error: friendly((data as { error: string }).error) };
  }
  return { ok: true, data: data as T };
}

// ---- コーチ ----

export async function createCoach(name: string): Promise<Res<CoachInfo>> {
  return rpc<CoachInfo>('create_coach', { p_name: name });
}
export async function fetchCoach(): Promise<Res<CoachInfo | null>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { data, error } = await c.from('coaches').select('id,name,invite_code').maybeSingle();
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: (data as CoachInfo | null) ?? null };
}
export const rotateInviteCode = () => rpc<string>('rotate_invite_code');
export const fetchStudents = () => rpc<StudentRow[]>('coach_students');

export async function setGoalPlan(userId: string, d: PlanDraft, menus: CoachMenu[], effectiveFrom: string): Promise<Res<PlanRow>> {
  return rpc<PlanRow>('set_goal_plan', {
    p_user_id: userId,
    p_target_weight: d.targetWeight,
    p_pace: d.pace,
    p_protein_g: d.proteinG,
    p_fat_pct: d.fatPct,
    p_menus: menus,
    p_effective_from: effectiveFrom,
  });
}
export const sendNote = (userId: string, weekStart: string, body: string) => rpc<unknown>('send_note', { p_user_id: userId, p_week_start: weekStart, p_body: body });

// ---- メニュー（コーチのひな形） ----

interface MenuRow {
  id: string;
  name: string;
  default_day_type: CoachMenu['defaultDayType'];
  exercises: CoachMenu['exercises'];
  sort_order: number;
}
const toMenu = (r: MenuRow): CoachMenu => ({ id: r.id, name: r.name, defaultDayType: r.default_day_type, exercises: r.exercises ?? [], sortOrder: r.sort_order });

export async function fetchMenus(): Promise<Res<CoachMenu[]>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { data, error } = await c.from('coach_menus').select('id,name,default_day_type,exercises,sort_order').order('sort_order').order('created_at');
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: ((data ?? []) as MenuRow[]).map(toMenu) };
}
export async function saveMenu(coachId: string, m: Omit<CoachMenu, 'id' | 'sortOrder'> & { id?: string; sortOrder?: number }): Promise<Res<CoachMenu>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const row = { coach_id: coachId, name: m.name, default_day_type: m.defaultDayType, exercises: m.exercises, sort_order: m.sortOrder ?? 0, ...(m.id ? { id: m.id } : {}) };
  const { data, error } = await c.from('coach_menus').upsert(row as never).select('id,name,default_day_type,exercises,sort_order').single();
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: toMenu(data as MenuRow) };
}
export async function deleteMenu(id: string): Promise<Res<true>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { error } = await c.from('coach_menus').delete().eq('id', id);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: true };
}

// ---- 生徒 ----

export const previewInvite = (code: string) => rpc<{ coachName: string }>('preview_invite', { p_code: code });
export const acceptInvite = (code: string, studentName: string, share: ShareFlags) =>
  rpc<{ coachName: string }>('accept_invite', { p_code: code, p_student_name: studentName, p_meals: share.meals, p_weight: share.weight, p_training: share.training });
export const updateMyLink = (share: ShareFlags, status: 'active' | 'paused') =>
  rpc<unknown>('update_my_link', { p_meals: share.meals, p_weight: share.weight, p_training: share.training, p_status: status });
export const revokeMyLink = () => rpc<null>('revoke_my_link');
export async function fetchInbox(): Promise<Res<Inbox>> {
  const r = await rpc<{ link: MyLink | null; plans: PlanRow[]; notes: Inbox['notes'] }>('my_coach_inbox');
  return r;
}

/** 共有するスナップショットを置く（自分の行だけ書ける） */
export async function publishSnapshot(userId: string, snapshot: Snapshot): Promise<Res<true>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { error } = await c.from('coach_shares').upsert({ user_id: userId, payload: snapshot, updated_at: new Date().toISOString() } as never);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: true };
}
export async function deleteSnapshot(userId: string): Promise<Res<true>> {
  const c = supabase();
  if (!c) return NOT_READY;
  const { error } = await c.from('coach_shares').delete().eq('user_id', userId);
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: true };
}
