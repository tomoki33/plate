/**
 * コーチモードの状態。既存の store とは分けて持つ（コーチをオンにしていない人には何も増えない）。
 * 端末に残すのは、オン／オフ・最後のモード・コーチ名・反映済みの目標プランなどの小さな値だけ（kv）。
 * 生徒一覧などはサーバーから取り、端末には保存しない。
 */
import { useMemo } from 'react';
import { create } from 'zustand';
import * as repo from '../db/repo';
import * as api from '../features/coach/api';
import { COACH_MODE } from '../lib/flags';
import type { CoachInfo, CoachMenu, Inbox, MyLink, NoteRow, PlanRow, StudentRow, Mode } from '../features/coach/types';

/** 端末に反映済みの、コーチが決めた目標 */
export interface Managed {
  planId: string;
  coachName: string;
  proteinG: number;
  fatPct: number;
  targetWeight: number;
  pace: number;
  appliedAt: number;
  effectiveFrom: string;
  /** 端末に入れたメニューのテンプレート id */
  templateIds: string[];
}

const KV = {
  enabled: 'coach_enabled',
  mode: 'coach_mode',
  name: 'coach_name',
  managed: 'coach_managed',
  seenNote: 'coach_seen_note',
  seenPlan: 'coach_seen_plan',
  link: 'coach_link',
} as const;
/** データ削除・ログアウトで消す（コーチの設定は端末の記録ではなくアカウントに付くもの） */
export const COACH_KV_KEYS: string[] = Object.values(KV);

const persist = (p: Promise<unknown>) => void p.catch((e) => console.warn('[plate:coach]', e));
const parse = <T,>(v: string | undefined): T | null => {
  try {
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};

interface CoachState {
  hydrated: boolean;
  enabled: boolean;
  mode: Mode;
  coachName: string;
  coach: CoachInfo | null;
  students: StudentRow[];
  studentsAt: number | null;
  menus: CoachMenu[];
  busy: boolean;
  error: string | null;

  // 生徒側
  link: MyLink | null;
  plans: PlanRow[];
  notes: NoteRow[];
  managed: Managed | null;
  seenNoteId: string | null;
  seenPlanId: string | null;

  hydrate(): Promise<void>;
  setMode(m: Mode): void;
  /** コーチをオンにする（初回はコーチ名を登録して招待コードを発行） */
  enable(name: string): Promise<api.Res<CoachInfo>>;
  disable(): void;
  rename(name: string): Promise<api.Res<CoachInfo>>;
  rotateCode(): Promise<api.Res<string>>;
  refreshCoach(): Promise<void>;
  applyInbox(i: Inbox): void;
  setManaged(m: Managed | null): void;
  markNoteSeen(id: string): void;
  markPlanSeen(id: string): void;
  reset(): void;
}

export const useCoach = create<CoachState>((set, get) => ({
  hydrated: false,
  enabled: false,
  mode: 'self',
  coachName: '',
  coach: null,
  students: [],
  studentsAt: null,
  menus: [],
  busy: false,
  error: null,
  link: null,
  plans: [],
  notes: [],
  managed: null,
  seenNoteId: null,
  seenPlanId: null,

  async hydrate() {
    // コーチモードが無効のビルドでは、何も読み込まない（オフのまま）
    if (!COACH_MODE) return set({ hydrated: true });
    const kv = await repo.getAllKv();
    const enabled = kv[KV.enabled] === '1';
    set({
      hydrated: true,
      enabled,
      // コーチをオフにしている人は、必ず「自分」で開く
      mode: enabled && kv[KV.mode] === 'coach' ? 'coach' : 'self',
      coachName: kv[KV.name] ?? '',
      managed: parse<Managed>(kv[KV.managed]),
      seenNoteId: kv[KV.seenNote] || null,
      seenPlanId: kv[KV.seenPlan] || null,
      link: parse<MyLink>(kv[KV.link]),
    });
  },

  setMode(m) {
    if (m === 'coach' && !get().enabled) return;
    set({ mode: m });
    persist(repo.setKv(KV.mode, m));
  },

  async enable(name) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: 'コーチ名を入れてください。' };
    set({ busy: true, error: null });
    const r = await api.createCoach(trimmed);
    set({ busy: false });
    if (!r.ok) {
      set({ error: r.error });
      return r;
    }
    set({ enabled: true, coach: r.data, coachName: r.data.name });
    persist(repo.setKv(KV.enabled, '1'));
    persist(repo.setKv(KV.name, r.data.name));
    return r;
  },

  disable() {
    set({ enabled: false, mode: 'self', students: [], menus: [] });
    persist(repo.deleteKv(KV.enabled));
    persist(repo.setKv(KV.mode, 'self'));
  },

  async rename(name) {
    const r = await api.createCoach(name.trim());
    if (r.ok) {
      set({ coach: r.data, coachName: r.data.name });
      persist(repo.setKv(KV.name, r.data.name));
    }
    return r;
  },

  async rotateCode() {
    const r = await api.rotateInviteCode();
    if (r.ok) set((s) => (s.coach ? { coach: { ...s.coach, invite_code: r.data } } : {}));
    return r;
  },

  async refreshCoach() {
    set({ busy: true, error: null });
    const [c, st, mn] = await Promise.all([api.fetchCoach(), api.fetchStudents(), api.fetchMenus()]);
    set({
      busy: false,
      coach: c.ok ? c.data : get().coach,
      students: st.ok ? st.data : get().students,
      studentsAt: st.ok ? Date.now() : get().studentsAt,
      menus: mn.ok ? mn.data : get().menus,
      error: !st.ok ? st.error : null,
    });
  },

  applyInbox(i) {
    set({ link: i.link, plans: i.plans, notes: i.notes });
    persist(i.link ? repo.setKv(KV.link, JSON.stringify(i.link)) : repo.deleteKv(KV.link));
  },

  setManaged(m) {
    set({ managed: m });
    persist(m ? repo.setKv(KV.managed, JSON.stringify(m)) : repo.deleteKv(KV.managed));
  },
  markNoteSeen(id) {
    set({ seenNoteId: id });
    persist(repo.setKv(KV.seenNote, id));
  },
  markPlanSeen(id) {
    set({ seenPlanId: id });
    persist(repo.setKv(KV.seenPlan, id));
  },

  reset() {
    set({ enabled: false, mode: 'self', coachName: '', coach: null, students: [], studentsAt: null, menus: [], link: null, plans: [], notes: [], managed: null, seenNoteId: null, seenPlanId: null });
  },
}));

/** ワードマークの矢印と、モードごとの画面を出すか */
export const useCoachEnabled = () => useCoach((s) => s.enabled);
export const useIsManaged = () => useCoach((s) => !!s.managed && !!s.link?.managesGoals && s.link.status === 'active');

/** コーチが目標を管理しているときの、目標エンジンへの上書き（P の g と 脂質の割合）。管理していなければ空 */
export function useEngineOverrides(): { fixedP?: number; fatPct?: number } {
  const managed = useCoach((s) => s.managed);
  const active = useCoach((s) => !!s.link?.managesGoals && s.link.status === 'active');
  return useMemo(() => (managed && active ? { fixedP: managed.proteinG, fatPct: managed.fatPct } : {}), [managed, active]);
}

let applying = false;
/** コーチの目標プランを反映している最中は、下の「管理中」のガードを外す */
export function withCoachApply<T>(fn: () => T): T {
  applying = true;
  try {
    return fn();
  } finally {
    applying = false;
  }
}
/** コーチが目標を管理していて、生徒が直せない状態か（画面の外・ストアの操作から使う） */
export function isManagedNow(): boolean {
  if (applying) return false;
  const s = useCoach.getState();
  return !!s.managed && !!s.link?.managesGoals && s.link.status === 'active';
}
