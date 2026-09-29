/** アプリ（src/features/coach/api.ts）と同じ RPC を、ブラウザから呼ぶ。失敗は { ok:false, error } で返す */
import type { CoachInfo, CoachMenu, PlanRow, StudentRow } from '@core/features/coach/types';
import type { PlanDraft } from '@core/features/coach/plan';
import { supabase } from './supabase';

export type Res<T> = { ok: true; data: T } | { ok: false; error: string };
const MESSAGES: Record<string, string> = {
  not_linked: 'この生徒とはつながっていません。',
  not_a_coach: 'コーチとして登録されていません。アプリの 設定 →「コーチとして使う」をオンにしてください。',
  not_authenticated: 'ログインしてください。',
};
const friendly = (m: string) => MESSAGES[m] ?? m;

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<Res<T>> {
  const { data, error } = await supabase().rpc(name, args as never);
  if (error) return { ok: false, error: friendly(error.message) };
  return { ok: true, data: data as T };
}

export async function fetchCoach(): Promise<Res<CoachInfo | null>> {
  const { data, error } = await supabase().from('coaches').select('id,name,invite_code').maybeSingle();
  return error ? { ok: false, error: friendly(error.message) } : { ok: true, data: (data as CoachInfo | null) ?? null };
}
export const fetchStudents = () => rpc<StudentRow[]>('coach_students');
export async function fetchMenus(): Promise<Res<CoachMenu[]>> {
  const { data, error } = await supabase().from('coach_menus').select('id,name,default_day_type,exercises,sort_order').order('sort_order').order('created_at');
  if (error) return { ok: false, error: error.message };
  type Row = { id: string; name: string; default_day_type: CoachMenu['defaultDayType']; exercises: CoachMenu['exercises']; sort_order: number };
  return { ok: true, data: ((data ?? []) as Row[]).map((r) => ({ id: r.id, name: r.name, defaultDayType: r.default_day_type, exercises: r.exercises ?? [], sortOrder: r.sort_order })) };
}
export const setGoalPlan = (userId: string, d: PlanDraft, menus: CoachMenu[], effectiveFrom: string) =>
  rpc<PlanRow>('set_goal_plan', { p_user_id: userId, p_target_weight: d.targetWeight, p_pace: d.pace, p_protein_g: d.proteinG, p_fat_pct: d.fatPct, p_menus: menus, p_effective_from: effectiveFrom });
export const sendNote = (userId: string, weekStart: string, body: string) => rpc<unknown>('send_note', { p_user_id: userId, p_week_start: weekStart, p_body: body });
