import { create } from 'zustand';
import * as repo from '../db/repo';
import { seedIfNeeded } from '../db/seed';
import { addDays, dateKey, slotOf, weekStart } from '../domain/dates';
import { DEFAULT_PROFILE, clampPace, correctTdee, defaultPace, defaultPk, initialTdee, type Goal, type Sex } from '../domain/nutrition';
import type { Exercise, ExerciseLog, FoodItem, MealEntry, MealSet, ProfileData, SessionRecord, Slot, WorkoutTemplate } from '../domain/models';
import { searchKey } from '../domain/foodSearch';
import { bestSet, decideDayType, median, volumeScore, DEFAULT_MEDIAN_VOLUME } from '../domain/training';
import type { Coef, DayType, Pfc } from '../domain/types';
import { scaleMealEntry } from '../domain/meals';
import { uuid } from '../lib/id';

export interface Session {
  templateId: string | null;
  name: string;
  defaultDayType: DayType;
  cur: number;
  sel: number;
  startedAt: number;
  ex: ExerciseLog[];
}

export interface Toast {
  id: number;
  text: string;
  undo?: () => void;
}

/** 食事に追加する1品（記録時の値を持つ） */
export interface MealItemInput {
  foodId: string | null;
  name: string;
  grams: number | null;
  kcal: number;
  P: number;
  F: number;
  C: number;
}

const log = (e: unknown) => console.warn('[plate:db]', e);
/** DBへの書き込み（画面は待たない。失敗は記録して握りつぶす） */
const persist = (p: Promise<unknown>) => void p.catch(log);

let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let restTimer: ReturnType<typeof setInterval> | undefined;

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const round1 = (n: number) => Math.round(n * 10) / 10;

const DEFAULT_PROFILE_DATA = (): ProfileData => ({ ...DEFAULT_PROFILE, pk: defaultPk(DEFAULT_PROFILE.goal), coef: { high: 1.15, normal: 1.0, off: 0.85 }, tdee: 2600, tdeeWeek: null, onboarded: false });

interface State {
  ready: boolean;
  bootError: string | null;

  profile: ProfileData;
  weights: Record<string, number>;
  weightSources: Record<string, 'manual' | 'healthkit'>;
  bodyFat: Record<string, number>;
  meals: MealEntry[];
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  weekPlan: (string | null)[];
  sessions: SessionRecord[];
  mealSets: MealSet[];
  myFoods: FoodItem[];
  aiUsed: Record<string, number>;
  /** 予定と違う今日の日タイプ（日付ごと） */
  dayTypes: Record<string, DayType>;
  trialStartedAt: number | null;
  paid: boolean;
  /** 「ログインせずに始める」を選んだか */
  loginSkipped: boolean;
  account: { userId: string; email: string | null } | null;
  /** 起動時にログイン状態を確かめ終えたか（確かめるまでは、どの画面を出すか決められない） */
  authChecked: boolean;
  lastTargets: Record<string, { dayType: DayType; kcal: number; reason: string }>;

  session: Session | null;
  rest: number;
  restMax: number;
  doneOpen: boolean;
  toast: Toast | null;

  bootstrap(): Promise<void>;
  reload(): Promise<void>;

  // プロフィール
  completeOnboarding(input: { sex: Sex; birthYear: number; heightCm: number; activity: number; goal: Goal; pace: number; weight: number }): void;
  updateProfile(patch: Partial<Pick<ProfileData, 'sex' | 'birthYear' | 'heightCm' | 'activity'>> & { goal?: Goal; pace?: number }, weightKg: number): void;
  setCoef(t: keyof Coef, delta: number): void;
  setCoefTo(t: keyof Coef, value: number): void;
  setCoefs(c: Coef): void;
  setPk(delta: number): void;
  setPkTo(value: number): void;
  maybeUpdateTdee(now: Date): void;
  recordTarget(date: string, target: { dayType: DayType; kcal: number; P: number; F: number; C: number }, reason: string): void;

  // 食事
  /** date を省くと今日、slot を省くと今の時刻の時間帯 */
  addMealItems(groupName: string, items: MealItemInput[], opts?: { ai?: boolean; mealSetId?: string; date?: string; slot?: Slot }): string;
  /** 食事（同じ操作で追加したまとまり）の量と時間帯を直す。量は、その行の栄養を比例で計算し直す */
  updateMealGroup(groupId: string, patch: { slot?: Slot; grams?: Record<string, number> }): void;
  removeMealGroup(groupId: string): void;
  addFromMealSet(set: MealSet, foods: FoodItem[], opts?: { date?: string; slot?: Slot }): void;
  saveMealSet(name: string, items: { foodId: string; g: number }[], slotHint?: string | null): void;
  deleteMealSet(id: string): void;
  saveMyFood(f: { id?: string; name: string; kcal: number; p: number; f: number; c: number; defaultG?: number | null; unitG?: number | null }): string;
  deleteMyFood(id: string): void;

  // 体重・日タイプ
  setWeight(date: string, kg: number, opts?: { source?: 'manual' | 'healthkit'; bodyFat?: number | null; silent?: boolean }): void;
  setDayType(date: string, t: DayType | null): void;
  consumeAi(date: string): void;

  // トレの設定
  setWeekPlan(weekday: number, templateId: string | null): void;
  saveTemplate(t: WorkoutTemplate): void;
  deleteTemplate(id: string): void;
  addCustomExercise(name: string, part: Exercise['part']): string;
  deleteSession(id: string): void;

  // トレの記録
  startSession(templateId: string | null): void;
  cancelSession(): void;
  selectExercise(i: number): void;
  selectSet(i: number): void;
  adjustSet(field: 'kg' | 'reps', delta: number): void;
  setSetValue(field: 'kg' | 'reps', value: number): void;
  setRir(rir: number | null): void;
  toggleSet(i: number): void;
  addSet(): void;
  removeSet(): void;
  addExerciseToSession(exerciseId: string): void;
  nextExercise(): void;
  finishSession(): SessionRecord | null;
  tickRest(): void;
  startRest(): void;
  addRest(): void;
  skipRest(): void;
  setDoneOpen(v: boolean): void;

  // ログイン
  skipLogin(): void;
  setAccount(a: State['account']): void;

  // 課金
  setPaid(v: boolean): void;

  showToast(text: string, undo?: () => void): void;
  hideToast(): void;
  eraseAllData(): Promise<void>;
}

export const useStore = create<State>()((set, get) => {
  const saveProfileNow = () => persist(repo.saveProfile(get().profile));

  return {
    ready: false,
    bootError: null,
    profile: DEFAULT_PROFILE_DATA(),
    weights: {},
    weightSources: {},
    bodyFat: {},
    meals: [],
    exercises: [],
    templates: [],
    weekPlan: [null, null, null, null, null, null, null],
    sessions: [],
    mealSets: [],
    myFoods: [],
    aiUsed: {},
    dayTypes: {},
    trialStartedAt: null,
    paid: false,
    loginSkipped: false,
    account: null,
    authChecked: false,
    lastTargets: {},
    session: null,
    rest: 0,
    restMax: 120,
    doneOpen: false,
    toast: null,

    async bootstrap() {
      try {
        await seedIfNeeded();
        await get().reload();
      } catch (e) {
        log(e);
        set({ bootError: e instanceof Error ? e.message : String(e) });
      }
    },

    async reload() {
      const d = await repo.loadAll();
      const dayTypes: Record<string, DayType> = {};
      for (const [k, v] of Object.entries(d.kv)) if (k.startsWith('dt:')) dayTypes[k.slice(3)] = v as DayType;
      set({
        ready: true,
        bootError: null,
        profile: d.profile,
        weights: d.weights,
        weightSources: d.weightSources,
        bodyFat: d.bodyFat,
        meals: d.meals,
        exercises: d.exercises,
        templates: d.templates,
        weekPlan: d.weekPlan,
        sessions: d.sessions,
        mealSets: d.mealSets,
        myFoods: d.myFoods,
        aiUsed: d.aiUsed,
        dayTypes,
        trialStartedAt: d.kv.trial_started_at ? Number(d.kv.trial_started_at) : null,
        paid: d.kv.paid === '1',
        loginSkipped: d.kv.login_skipped === '1',
        lastTargets: d.lastTargets,
      });
    },

    // ------------------------------------------------------------ プロフィール

    completeOnboarding(input) {
      const now = new Date();
      const pace = clampPace(input.goal, input.weight, input.pace);
      const profile: ProfileData = {
        sex: input.sex,
        birthYear: input.birthYear,
        heightCm: input.heightCm,
        activity: input.activity,
        goal: input.goal,
        pace,
        pk: defaultPk(input.goal),
        coef: get().profile.coef,
        tdee: Math.round(initialTdee({ ...DEFAULT_PROFILE, ...input, pace }, input.weight, now)),
        tdeeWeek: null,
        onboarded: true,
      };
      const isNewTrial = get().trialStartedAt === null;
      set({ profile, trialStartedAt: get().trialStartedAt ?? now.getTime() });
      saveProfileNow();
      if (isNewTrial) persist(repo.setKv('trial_started_at', String(now.getTime())));
      get().setWeight(dateKey(now), input.weight, { silent: true });
    },

    updateProfile(patch, weightKg) {
      const cur = get().profile;
      const next: ProfileData = { ...cur, ...patch };
      const goalChanged = patch.goal !== undefined && patch.goal !== cur.goal;
      if (goalChanged) {
        next.pk = defaultPk(next.goal);
        next.pace = defaultPace(next.goal, weightKg);
      } else if (patch.pace !== undefined) {
        next.pace = clampPace(next.goal, weightKg, patch.pace);
      }
      // 基本情報が変わったら、維持カロリーの推定は式から出し直す（実データによる補正はやり直し）
      if (patch.sex !== undefined || patch.birthYear !== undefined || patch.heightCm !== undefined || patch.activity !== undefined) {
        next.tdee = Math.round(initialTdee(next, weightKg, new Date()));
        next.tdeeWeek = null;
      }
      set({ profile: next });
      saveProfileNow();
    },

    setCoef(t, delta) {
      set((s) => ({ profile: { ...s.profile, coef: { ...s.profile.coef, [t]: Math.round(Math.min(1.4, Math.max(0.6, s.profile.coef[t] + delta)) * 100) / 100 } } }));
      saveProfileNow();
    },
    setCoefTo(t, value) {
      set((s) => ({ profile: { ...s.profile, coef: { ...s.profile.coef, [t]: Math.round(Math.min(1.4, Math.max(0.6, value)) * 100) / 100 } } }));
      saveProfileNow();
    },
    setCoefs(c) {
      set((s) => ({ profile: { ...s.profile, coef: { high: c.high, normal: c.normal, off: c.off } } }));
      saveProfileNow();
    },
    setPkTo(value) {
      set((s) => ({ profile: { ...s.profile, pk: Math.min(3, Math.max(1.6, round1(value))) } }));
      saveProfileNow();
    },
    setPk(delta) {
      set((s) => ({ profile: { ...s.profile, pk: Math.min(3, Math.max(1.6, round1(s.profile.pk + delta))) } }));
      saveProfileNow();
    },

    /** 週が変わったら、直近14日の実データでTDEEを補正する（3週目以降、記録が足りているとき） */
    maybeUpdateTdee(now) {
      const { profile, meals, weights } = get();
      if (!profile.onboarded) return;
      const week = dateKey(weekStart(now));
      if (profile.tdeeWeek === week) return;
      const intake: Record<string, number> = {};
      for (const m of meals) intake[m.date] = (intake[m.date] ?? 0) + m.kcal;
      const r = correctTdee({ prevTdee: profile.tdee, today: now, intake, weights });
      // 補正できたときだけ更新する（記録が足りないあいだは、起動のたびに確かめ直す）
      if (!r.applied) return;
      set({ profile: { ...profile, tdee: r.tdee, tdeeWeek: week } });
      saveProfileNow();
    },

    recordTarget(date, t, reason) {
      const last = get().lastTargets[date];
      if (last && last.dayType === t.dayType && Math.abs(last.kcal - t.kcal) < 1) return;
      set((s) => ({ lastTargets: { ...s.lastTargets, [date]: { dayType: t.dayType, kcal: t.kcal, reason } } }));
      persist(repo.insertDayTarget({ id: uuid(), date, dayType: t.dayType, kcal: t.kcal, p: t.P, f: t.F, c: t.C, reason }));
    },

    // ------------------------------------------------------------ 食事

    addMealItems(groupName, items, opts = {}) {
      const now = new Date();
      const groupId = uuid();
      const slot: Slot = slotOf(now);
      const rows: MealEntry[] = items.map((it, i) => ({
        id: uuid(),
        date: opts.date ?? dateKey(now),
        slot: opts.slot ?? slot,
        foodId: it.foodId,
        groupId,
        groupName,
        name: it.name,
        grams: it.grams,
        kcal: it.kcal,
        P: it.P,
        F: it.F,
        C: it.C,
        ai: !!opts.ai,
        createdAt: now.getTime() + i,
      }));
      set((s) => ({ meals: [...s.meals, ...rows] }));
      persist(repo.insertMeals(rows));
      get().showToast(`${groupName} を追加`, () => {
        set((s) => ({ meals: s.meals.filter((m) => m.groupId !== groupId) }));
        persist(repo.softDeleteMealGroup(groupId));
      });
      return groupId;
    },

    updateMealGroup(groupId, patch) {
      const before = get().meals.filter((m) => m.groupId === groupId);
      if (!before.length) return;
      const after = before.map((m) => {
        const g = patch.grams?.[m.id];
        const moved = { ...m, slot: patch.slot ?? m.slot };
        return g === undefined ? moved : scaleMealEntry(moved, g);
      });
      const byId = new Map(after.map((m) => [m.id, m]));
      set((s) => ({ meals: s.meals.map((m) => byId.get(m.id) ?? m) }));
      persist(repo.updateMealEntries(after));
      get().showToast(`${before[0].groupName} を直しました`, () => {
        const old = new Map(before.map((m) => [m.id, m]));
        set((s) => ({ meals: s.meals.map((m) => old.get(m.id) ?? m) }));
        persist(repo.updateMealEntries(before));
      });
    },

    removeMealGroup(groupId) {
      const rows = get().meals.filter((m) => m.groupId === groupId);
      if (!rows.length) return;
      set((s) => ({ meals: s.meals.filter((m) => m.groupId !== groupId) }));
      persist(repo.softDeleteMealGroup(groupId));
      get().showToast(`${rows[0].groupName} を削除`, () => {
        set((s) => ({ meals: [...s.meals, ...rows].sort((a, b) => a.createdAt - b.createdAt) }));
        persist(repo.restoreMealGroup(groupId));
      });
    },

    addFromMealSet(ms, foods, opts = {}) {
      const byId = new Map(foods.map((f) => [f.id, f]));
      const items: MealItemInput[] = ms.items.flatMap((it) => {
        const f = byId.get(it.foodId);
        if (!f) return [];
        const k = it.g / 100;
        return [{ foodId: f.id, name: f.name, grams: it.g, kcal: Math.round(f.kcal * k), P: round1(f.p * k), F: round1(f.f * k), C: round1(f.c * k) }];
      });
      if (!items.length) return;
      get().addMealItems(ms.name, items, { mealSetId: ms.id, ...opts });
      const next: MealSet = { ...ms, useCount: ms.useCount + 1, lastUsedAt: Date.now() };
      set((s) => ({ mealSets: s.mealSets.map((m) => (m.id === ms.id ? next : m)) }));
      persist(repo.saveMealSet(next));
    },

    saveMealSet(name, items, slotHint = null) {
      const ms: MealSet = { id: uuid(), name, items, useCount: 1, lastUsedAt: Date.now(), slotHint };
      set((s) => ({ mealSets: [...s.mealSets, ms] }));
      persist(repo.saveMealSet(ms));
      get().showToast(`マイセット「${name}」を登録`);
    },
    deleteMealSet(id) {
      set((s) => ({ mealSets: s.mealSets.filter((m) => m.id !== id) }));
      persist(repo.deleteMealSet(id));
    },

    saveMyFood(f) {
      const id = f.id ?? uuid();
      const item: FoodItem = { id, name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, source: '自作', defaultG: f.defaultG ?? 100, unitG: f.unitG ?? null };
      set((s) => ({ myFoods: s.myFoods.some((x) => x.id === id) ? s.myFoods.map((x) => (x.id === id ? item : x)) : [...s.myFoods, item] }));
      persist(repo.saveMyFood({ ...item, search: searchKey(item.name) }));
      return id;
    },
    deleteMyFood(id) {
      set((s) => ({ myFoods: s.myFoods.filter((x) => x.id !== id) }));
      persist(repo.deleteMyFood(id));
    },

    // ------------------------------------------------------------ 体重・日タイプ

    setWeight(date, kg, opts = {}) {
      const source = opts.source ?? 'manual';
      const prev = get().weights[date];
      const prevSource = get().weightSources[date];
      // ヘルスケアの値で、手入力済みの日を上書きしない
      if (source === 'healthkit' && prevSource === 'manual') return;
      set((s) => ({ weights: { ...s.weights, [date]: kg }, weightSources: { ...s.weightSources, [date]: source }, bodyFat: opts.bodyFat != null ? { ...s.bodyFat, [date]: opts.bodyFat } : s.bodyFat }));
      persist(repo.saveBodyLog(uuid(), date, kg, source, opts.bodyFat ?? null));
      if (!opts.silent && source === 'manual')
        get().showToast(`体重 ${kg.toFixed(1)}kg を記録`, () => {
          set((s) => {
            const w = { ...s.weights };
            if (prev === undefined) delete w[date];
            else w[date] = prev;
            return { weights: w };
          });
          if (prev === undefined) persist(repo.deleteBodyLog(date, 'manual'));
          else persist(repo.saveBodyLog(uuid(), date, prev, 'manual', null));
        });
    },

    setDayType(date, t) {
      set((s) => {
        const d = { ...s.dayTypes };
        if (t) d[date] = t;
        else delete d[date];
        return { dayTypes: d };
      });
      persist(t ? repo.setKv(`dt:${date}`, t) : repo.deleteKv(`dt:${date}`));
    },

    consumeAi(date) {
      const n = (get().aiUsed[date] ?? 0) + 1;
      set((s) => ({ aiUsed: { ...s.aiUsed, [date]: n } }));
      persist(repo.setKv(`ai:${date}`, String(n)));
    },

    // ------------------------------------------------------------ トレの設定

    setWeekPlan(weekday, templateId) {
      const plan = get().weekPlan.slice();
      plan[weekday] = templateId;
      set({ weekPlan: plan });
      persist(repo.saveWeekPlan(plan));
    },
    saveTemplate(t) {
      set((s) => ({ templates: s.templates.some((x) => x.id === t.id) ? s.templates.map((x) => (x.id === t.id ? t : x)) : [...s.templates, { ...t, sortOrder: s.templates.length }] }));
      persist(repo.saveTemplate(t));
    },
    deleteTemplate(id) {
      set((s) => ({ templates: s.templates.filter((t) => t.id !== id), weekPlan: s.weekPlan.map((p) => (p === id ? null : p)) }));
      persist(repo.deleteTemplate(id));
    },
    addCustomExercise(name, part) {
      const ex: Exercise = { id: uuid(), name, part, coef: { 脚: 1.5, 背中: 1.2, 胸: 1.0, 肩: 1.0, 腕: 0.6, 腹: 0.6 }[part], isCustom: true };
      set((s) => ({ exercises: [...s.exercises, ex] }));
      persist(repo.saveExercise(ex));
      return ex.id;
    },
    deleteSession(id) {
      set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) }));
      persist(repo.deleteSession(id));
    },

    // ------------------------------------------------------------ トレの記録

    startSession(templateId) {
      clearInterval(restTimer);
      const { templates, exercises, sessions } = get();
      const tpl = templates.find((t) => t.id === templateId) ?? null;
      const exBy = new Map(exercises.map((e) => [e.id, e]));
      // 前回の値：その種目の直近の記録（なければテンプレートの初期値）
      const lastOf = (exerciseId: string) => {
        for (let i = sessions.length - 1; i >= 0; i--) {
          const ex = sessions[i].exercises.find((e) => e.exerciseId === exerciseId);
          const done = ex?.sets.filter((x) => x.done);
          if (done && done.length) return { kg: done[done.length - 1].kg, reps: done[done.length - 1].reps };
        }
        return null;
      };
      const ex: ExerciseLog[] = (tpl?.exercises ?? []).flatMap((te) => {
        const def = exBy.get(te.exerciseId);
        if (!def) return [];
        const prev = lastOf(te.exerciseId) ?? { kg: te.kg, reps: te.reps };
        return [{ exerciseId: def.id, name: def.name, part: def.part, coef: def.coef, prevKg: prev.kg, prevReps: prev.reps, sets: Array.from({ length: te.sets }, () => ({ kg: prev.kg, reps: prev.reps, done: false })) }];
      });
      set({ doneOpen: false, rest: 0, session: { templateId: tpl?.id ?? null, name: tpl?.name ?? 'フリートレ', defaultDayType: tpl?.defaultDayType ?? 'normal', cur: 0, sel: 0, startedAt: Date.now(), ex } });
    },
    cancelSession() {
      clearInterval(restTimer);
      set({ session: null, rest: 0 });
    },
    selectExercise(i) {
      set((s) => {
        if (!s.session) return s;
        const sel = Math.max(0, s.session.ex[i].sets.findIndex((x) => !x.done));
        return { session: { ...s.session, cur: i, sel } };
      });
    },
    selectSet(i) {
      set((s) => (s.session ? { session: { ...s.session, sel: i } } : s));
    },
    adjustSet(field, delta) {
      set((s) => {
        if (!s.session || !s.session.ex.length) return s;
        const ses = clone(s.session);
        const st = ses.ex[ses.cur].sets[ses.sel];
        if (!st) return s;
        st[field] = field === 'kg' ? Math.max(0, Math.round((st.kg + delta) * 10) / 10) : Math.max(1, st.reps + delta);
        return { session: ses };
      });
    },
    setSetValue(field, value) {
      set((s) => {
        if (!s.session || !s.session.ex.length) return s;
        const ses = clone(s.session);
        const st = ses.ex[ses.cur].sets[ses.sel];
        if (!st) return s;
        st[field] = field === 'kg' ? Math.max(0, Math.round(value * 10) / 10) : Math.max(1, Math.round(value));
        return { session: ses };
      });
    },
    setRir(rir) {
      set((s) => {
        if (!s.session || !s.session.ex.length) return s;
        const ses = clone(s.session);
        const st = ses.ex[ses.cur].sets[ses.sel];
        if (!st) return s;
        st.rir = rir;
        return { session: ses };
      });
    },
    toggleSet(i) {
      const before = get().session;
      if (!before) return;
      const on = !before.ex[before.cur].sets[i].done;
      set((s) => {
        const ses = clone(s.session!);
        const sets = ses.ex[ses.cur].sets;
        sets[i].done = on;
        if (on) {
          const nx = sets.findIndex((z) => !z.done);
          ses.sel = nx < 0 ? i : nx;
        }
        return { session: ses };
      });
      if (on) get().startRest();
    },
    addSet() {
      set((s) => {
        if (!s.session || !s.session.ex.length) return s;
        const ses = clone(s.session);
        const sets = ses.ex[ses.cur].sets;
        const last = sets[sets.length - 1];
        sets.push({ kg: last?.kg ?? ses.ex[ses.cur].prevKg, reps: last?.reps ?? ses.ex[ses.cur].prevReps, done: false });
        ses.sel = sets.length - 1;
        return { session: ses };
      });
    },
    removeSet() {
      set((s) => {
        if (!s.session || !s.session.ex.length) return s;
        const ses = clone(s.session);
        const sets = ses.ex[ses.cur].sets;
        if (sets.length <= 1) return s;
        sets.splice(ses.sel, 1);
        ses.sel = Math.min(ses.sel, sets.length - 1);
        return { session: ses };
      });
    },
    addExerciseToSession(exerciseId) {
      const { exercises, sessions } = get();
      const def = exercises.find((e) => e.id === exerciseId);
      if (!def) return;
      let prev = { kg: 20, reps: 10 };
      for (let i = sessions.length - 1; i >= 0; i--) {
        const done = sessions[i].exercises.find((e) => e.exerciseId === exerciseId)?.sets.filter((x) => x.done);
        if (done && done.length) {
          prev = { kg: done[done.length - 1].kg, reps: done[done.length - 1].reps };
          break;
        }
      }
      set((s) => {
        if (!s.session) return s;
        const ses = clone(s.session);
        ses.ex.push({ exerciseId: def.id, name: def.name, part: def.part, coef: def.coef, prevKg: prev.kg, prevReps: prev.reps, sets: [0, 1, 2].map(() => ({ kg: prev.kg, reps: prev.reps, done: false })) });
        ses.cur = ses.ex.length - 1;
        ses.sel = 0;
        return { session: ses };
      });
    },
    nextExercise() {
      set((s) => (s.session ? { session: { ...s.session, cur: Math.min(s.session.ex.length - 1, s.session.cur + 1), sel: 0 } } : s));
    },
    finishSession() {
      const { session, sessions } = get();
      if (!session) return null;
      clearInterval(restTimer);
      const doneEx: ExerciseLog[] = session.ex.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length);
      if (!doneEx.length) {
        set({ session: null, rest: 0 });
        get().showToast('完了したセットがないため、記録しませんでした');
        return null;
      }
      const now = new Date();
      const volume = volumeScore(doneEx);
      // 本人の中央値：記録が3回未満のあいだは標準値を使う
      const med = sessions.length >= 3 ? median(sessions.map((w) => w.volume)) : DEFAULT_MEDIAN_VOLUME;
      const dayType = decideDayType(session.defaultDayType, volume, med);
      const rec: SessionRecord = {
        id: uuid(),
        date: dateKey(now),
        templateId: session.templateId,
        name: session.name,
        startedAt: session.startedAt,
        endedAt: now.getTime(),
        volume,
        dayType,
        doneSets: doneEx.reduce((a, e) => a + e.sets.length, 0),
        best: bestSet(doneEx),
        exercises: doneEx,
      };
      set((s) => ({ session: null, rest: 0, doneOpen: true, sessions: [...s.sessions, rec], dayTypes: { ...s.dayTypes, [rec.date]: dayType } }));
      persist(repo.saveSession(rec, rec.exercises.flatMap((e) => e.sets.map(() => uuid()))));
      persist(repo.setKv(`dt:${rec.date}`, dayType));
      return rec;
    },
    startRest() {
      clearInterval(restTimer);
      set({ rest: 120, restMax: 120 });
      restTimer = setInterval(() => get().tickRest(), 1000);
    },
    tickRest() {
      const r = get().rest;
      if (r <= 1) {
        clearInterval(restTimer);
        set({ rest: 0 });
      } else set({ rest: r - 1 });
    },
    addRest() {
      set((s) => ({ rest: s.rest + 30, restMax: Math.max(s.restMax, s.rest + 30) }));
    },
    skipRest() {
      clearInterval(restTimer);
      set({ rest: 0 });
    },
    setDoneOpen(v) {
      set({ doneOpen: v });
    },

    skipLogin() {
      set({ loginSkipped: true });
      persist(repo.setKv('login_skipped', '1'));
    },
    setAccount(a) {
      set({ account: a, authChecked: true });
    },

    setPaid(v) {
      set({ paid: v });
      persist(v ? repo.setKv('paid', '1') : repo.deleteKv('paid'));
    },

    showToast(text, undo) {
      clearTimeout(toastTimer);
      set({ toast: { id: ++toastSeq, text, undo } });
      toastTimer = setTimeout(() => set({ toast: null }), 3500);
    },
    hideToast() {
      clearTimeout(toastTimer);
      set({ toast: null });
    },

    /** データ削除：端末内の記録をすべて消し、初期状態（オンボーディング前）に戻す */
    async eraseAllData() {
      clearInterval(restTimer);
      await repo.wipeUserData();
      await seedIfNeeded();
      set({ session: null, rest: 0, doneOpen: false, toast: null });
      await get().reload();
    },
  };
});

export const addDaysKey = (d: Date, n: number) => dateKey(addDays(d, n));
export type { Pfc };
