import { removeAllPhotos } from '../services/photos';
import { create } from 'zustand';
import * as repo from '../db/repo';
import { seedIfNeeded } from '../db/seed';
import { addDays, dateKey, slotOf, weekStart } from '../domain/dates';
import { DEFAULT_PROFILE, clampPace, correctTdee, defaultPace, defaultPk, initialTdee, type Goal, type Sex } from '../domain/nutrition';
import type { Exercise, ExerciseLog, FoodItem, InputType, MealEntry, MealSet, ProfileData, SessionRecord, Slot, WorkoutTemplate } from '../domain/models';
import { searchKey } from '../domain/foodSearch';
import { bestSet, decideDayType, median, volumeScore, DEFAULT_MEDIAN_VOLUME } from '../domain/training';
import type { Coef, DayType, Pfc } from '../domain/types';
import { signOut } from '../services/supabase';
import { FREE_LAUNCH } from '../lib/flags';
import { COACH_KV_KEYS, isManagedNow, useCoach } from './coachStore';
import { startTrial as purchaseTrial } from '../services/billing';
import { trackDayLogged, trackFirstTrainingCompleted, trackTrialStarted, type LoggedKind } from '../services/analytics';
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

export type UsualSlot = '朝' | '昼' | '夜';
export const USUAL_SLOTS: UsualSlot[] = ['朝', '昼', '夜'];

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
const WD = ['日', '月', '火', '水', '木', '金', '土'];
/** 「9/25（金）」 */
const dayLabelOf = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return `${m}/${d}（${WD[new Date(y, m - 1, d).getDay()]}）`;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

const DEFAULT_PROFILE_DATA = (): ProfileData => ({ ...DEFAULT_PROFILE, pk: defaultPk(DEFAULT_PROFILE.goal), coef: { high: 1.15, normal: 1.0, off: 0.85 }, tdee: 2600, tdeeWeek: null, onboarded: false, goalWeightKg: null, weekAdjustKcal: 0 });

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
  /** 初めて起動した日時（計測のD7・D30の基準。README_launch 5章） */
  firstOpenAt: number | null;
  trialStartedAt: number | null;
  /** 本体（買い切り）を購入済みか */
  paid: boolean;
  /** AIプラス（任意のサブスク）が有効か */
  aiPlus: boolean;
  /** 課金なしで使える許可リストの状態（サーバーの comp_access）。paid・aiPlus は、これと購入状態の合算 */
  comp: { paid: boolean; aiPlus: boolean };
  /** 体験終了の案内（19c）を、もう見せたか */
  trialEndedSeen: boolean;
  /** 通知の許可の前の案内（19f）を、もう見せたか */
  notifyPromptSeen: boolean;
  /** 直前にトレーニングを完了したか（通知の案内を出すための一度きりの合図。永続化しない） */
  justCompletedSession: boolean;
  /** 「ログインせずに始める」を選んだか */
  loginSkipped: boolean;
  account: { userId: string; email: string | null; provider: string } | null;
  /** 最後にバックアップした時刻 */
  lastBackupAt: number | null;
  /** 起動時にログイン状態を確かめ終えたか（確かめるまでは、どの画面を出すか決められない） */
  authChecked: boolean;
  lastTargets: Record<string, { dayType: DayType; kcal: number; reason: string }>;
  /** ペースの見直しに答えた週（週の月曜 → 答え） */
  paceAnswers: Record<string, 'accepted' | 'dismissed'>;
  /** ヘルスケア連携（体重の自動取り込み）がオンか */
  healthSync: boolean;
  /** 開発用：サンプルを自動で入れ済みか */
  sampleInserted: boolean;
  /** 「いつも通り」で入れる食事（時間帯 → マイセットのid。null は「なし」） */
  usualMeals: Record<UsualSlot, string | null>;

  session: Session | null;
  rest: number;
  restMax: number;
  doneOpen: boolean;
  toast: Toast | null;

  bootstrap(): Promise<void>;
  reload(): Promise<void>;

  // プロフィール
  completeOnboarding(input: { sex: Sex; birthYear: number; heightCm: number; activity: number; goal: Goal; pace: number; weight: number; goalWeight?: number | null }): void;
  updateProfile(patch: Partial<Pick<ProfileData, 'sex' | 'birthYear' | 'heightCm' | 'activity'>> & { goal?: Goal; pace?: number }, weightKg: number): void;
  setCoef(t: keyof Coef, delta: number): void;
  setCoefTo(t: keyof Coef, value: number): void;
  setCoefs(c: Coef): void;
  setPk(delta: number): void;
  setPkTo(value: number): void;
  /** 値をそのまま反映する（コーチの目標プランの反映用。範囲の丸めや初期化をしない） */
  patchProfile(patch: Partial<Pick<ProfileData, 'goal' | 'pace' | 'goalWeightKg' | 'pk'>>): void;
  maybeUpdateTdee(now: Date): void;
  recordTarget(date: string, target: { dayType: DayType; kcal: number; P: number; F: number; C: number }, reason: string): void;

  // 食事
  /** date を省くと今日、slot を省くと今の時刻の時間帯 */
  addMealItems(groupName: string, items: MealItemInput[], opts?: { ai?: boolean; mealSetId?: string; date?: string; slot?: Slot; inputType?: InputType; photoUri?: string | null }): string;
  /** 食事（同じ操作で追加したまとまり）の量と時間帯を直す。量は、その行の栄養を比例で計算し直す */
  updateMealGroup(groupId: string, patch: { slot?: Slot; grams?: Record<string, number> }): void;
  removeMealGroup(groupId: string): void;
  addFromMealSet(set: MealSet, foods: FoodItem[], opts?: { date?: string; slot?: Slot }): string | null;
  /** 設定の「いつもの食事」を入れる。朝と昼 → 夜の順に、まだ記録していない時間帯の分だけ */
  addUsualMeals(date: string): Promise<void>;
  setUsualMeal(slot: UsualSlot, mealSetId: string | null): void;
  saveMealSet(name: string, items: { foodId: string; g: number }[], slotHint?: string | null): void;
  deleteMealSet(id: string): void;
  saveMyFood(f: { id?: string; name: string; kcal: number; p: number; f: number; c: number; defaultG?: number | null; unitG?: number | null }): string;
  deleteMyFood(id: string): void;

  // 目標体重・週の合計・ペースの見直し
  setGoalWeight(kg: number): void;
  /** 週の合計に増減を足す（取消できる）。kcal は週あたり */
  addWeekAdjust(deltaKcal: number, toastText: string): void;
  /** ペースの見直しの提案に答える。accepted なら週の合計を deltaKcal だけ動かす */
  answerPaceSuggestion(weekStart: string, deltaKcal: number, answer: 'accepted' | 'dismissed', toastText?: string): void;

  // ヘルスケア連携
  setHealthSync(on: boolean): void;
  markSampleInserted(): void;

  // 体重・日タイプ
  setWeight(date: string, kg: number, opts?: { source?: 'manual' | 'healthkit'; bodyFat?: number | null; silent?: boolean }): void;
  deleteWeight(date: string): void;
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
  /** 間違えて完了したとき：今日の最後のトレーニングを記録中に戻す */
  resumeSession(): void;
  setSessionMemo(id: string, memo: string): void;
  tickRest(): void;
  startRest(): void;
  addRest(): void;
  subRest(): void;
  skipRest(): void;
  setDoneOpen(v: boolean): void;

  // ログイン
  skipLogin(): void;
  setAccount(a: State['account']): void;
  setLastBackupAt(t: number): void;

  // 課金
  /** 本体（買い切り）の購入状態を反映する */
  setPaid(v: boolean): void;
  /** AIプラス（サブスク）の状態を反映する */
  setAiPlus(v: boolean): void;
  /** 課金の記録（RevenueCat）から、体験の開始日・購入・AIプラスをまとめて反映する */
  applyEntitlements(e: { trialStartedAt: number | null; paid: boolean; aiPlus: boolean }): void;
  /** 許可リストの状態を反映する（購入状態とは別に覚え、有効な間は paid・aiPlus を立てる） */
  applyComp(c: { paid: boolean; aiPlus: boolean }): Promise<void>;
  markTrialEndedSeen(): void;
  markNotifyPromptSeen(): void;
  clearJustCompletedSession(): void;

  showToast(text: string, undo?: () => void): void;
  hideToast(): void;
  eraseAllData(): Promise<void>;
  /** 開発用：ログアウトし、端末の中身をすべて消して、初めて入れた人の状態に戻す */
  devResetToFresh(): Promise<void>;
  /** ログアウト。wipe なら、この端末の記録も消す。ログイン画面へ戻れるよう、「ログインせずに始める」の選択は外す */
  logout(wipe: boolean): Promise<void>;
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
    firstOpenAt: null,
    trialStartedAt: null,
    paid: false,
    aiPlus: false,
    comp: { paid: false, aiPlus: false },
    trialEndedSeen: false,
    notifyPromptSeen: false,
    justCompletedSession: false,
    loginSkipped: false,
    account: null,
    lastBackupAt: null,
    authChecked: false,
    lastTargets: {},
    paceAnswers: {},
    healthSync: false,
    sampleInserted: false,
    usualMeals: { 朝: null, 昼: null, 夜: null },
    session: null,
    rest: 0,
    restMax: 120,
    doneOpen: false,
    toast: null,

    async bootstrap() {
      try {
        await seedIfNeeded();
        await get().reload();
        if (get().firstOpenAt === null) {
          const t = Date.now();
          set({ firstOpenAt: t });
          persist(repo.setKv('first_open_at', String(t)));
        }
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
        firstOpenAt: d.kv.first_open_at ? Number(d.kv.first_open_at) : null,
        trialStartedAt: d.kv.trial_started_at ? Number(d.kv.trial_started_at) : null,
        paid: FREE_LAUNCH || d.kv.paid === '1' || d.kv.comp_paid === '1',
        aiPlus: d.kv.ai_plus === '1' || d.kv.comp_ai === '1',
        comp: { paid: d.kv.comp_paid === '1', aiPlus: d.kv.comp_ai === '1' },
        trialEndedSeen: d.kv.trial_ended_seen === '1',
        notifyPromptSeen: d.kv.notify_prompt_seen === '1',
        loginSkipped: d.kv.login_skipped === '1',
        lastTargets: d.lastTargets,
        paceAnswers: d.paceAnswers,
        healthSync: d.kv.health_sync === '1',
        sampleInserted: d.kv.sample_inserted === '1',
        usualMeals: Object.fromEntries(
          USUAL_SLOTS.map((sl) => {
            const v = d.kv[`usual:${sl}`];
            // 未設定なら、その時間帯向けのマイセットを初期値にする（「なし」を選んだら空文字で覚えている）
            return [sl, v === undefined ? (d.mealSets.find((m) => m.slotHint === sl)?.id ?? null) : v || null];
          }),
        ) as Record<UsualSlot, string | null>,
        lastBackupAt: d.kv.last_backup_at ? Number(d.kv.last_backup_at) : null,
      });
      // 復元のあとにも、コーチの設定（オン／オフ・つながり）を読み直す
      void useCoach.getState().hydrate();
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
        goalWeightKg: input.goalWeight ?? null,
        weekAdjustKcal: 0,
      };
      const isNewTrial = get().trialStartedAt === null;
      const trialStartedAt = get().trialStartedAt ?? now.getTime();
      set({ profile, trialStartedAt });
      saveProfileNow();
      if (isNewTrial) {
        persist(repo.setKv('trial_started_at', String(trialStartedAt)));
        trackTrialStarted();
        // 課金の設定が済んでいれば、0円の買い切り商品（4週間の無料体験）の購入記録に開始日を合わせる
        void purchaseTrial().then((t) => {
          if (t !== null && t !== get().trialStartedAt) get().applyEntitlements({ trialStartedAt: t, paid: get().paid, aiPlus: get().aiPlus });
        });
      }
      get().setWeight(dateKey(now), input.weight, { silent: true });
    },

    updateProfile(patchIn, weightKg) {
      // コーチが目標を管理している間は、目的とペースは変えられない
      const patch = { ...patchIn };
      if (isManagedNow()) {
        delete patch.goal;
        delete patch.pace;
      }
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
    patchProfile(patch) {
      set((s) => ({ profile: { ...s.profile, ...patch } }));
      saveProfileNow();
    },
    setPkTo(value) {
      if (isManagedNow()) return;
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
      const date = opts.date ?? dateKey(now);
      const inputType: InputType = opts.inputType ?? (opts.mealSetId ? 'set' : 'search');
      const rows: MealEntry[] = items.map((it, i) => ({
        id: uuid(),
        date,
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
        photoUri: opts.photoUri ?? null,
        inputType,
        createdAt: now.getTime() + i,
      }));
      set((s) => ({ meals: [...s.meals, ...rows] }));
      persist(repo.insertMeals(rows));
      trackDayLogged(date, inputType as LoggedKind);
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
      if (!items.length) return null;
      const groupId = get().addMealItems(ms.name, items, { mealSetId: ms.id, ...opts });
      const next: MealSet = { ...ms, useCount: ms.useCount + 1, lastUsedAt: Date.now() };
      set((s) => ({ mealSets: s.mealSets.map((m) => (m.id === ms.id ? next : m)) }));
      persist(repo.saveMealSet(next));
      return groupId;
    },

    async addUsualMeals(date) {
      const { usualMeals, mealSets, meals } = get();
      const has = (sl: Slot) => meals.some((m) => m.date === date && m.slot === sl);
      const configured = USUAL_SLOTS.filter((sl) => usualMeals[sl] && mealSets.some((m) => m.id === usualMeals[sl]));
      if (!configured.length) return get().showToast('設定の「いつもの食事」を選ぶと、ここから一度に入れられます');
      const ok = (sl: UsualSlot) => configured.includes(sl) && !has(sl);
      const add: UsualSlot[] = ok('朝') || ok('昼') ? (['朝', '昼'] as UsualSlot[]).filter(ok) : ok('夜') ? ['夜'] : [];
      if (!add.length) return get().showToast('いつも通りの分は記録済み');
      const sets = add.map((sl) => mealSets.find((m) => m.id === usualMeals[sl])!);
      const foods = await repo.getFoodsByIds([...new Set(sets.flatMap((m) => m.items.map((i) => i.foodId)))]);
      const ids: string[] = [];
      add.forEach((sl, i) => {
        const id = get().addFromMealSet(sets[i], foods, { date, slot: sl });
        if (id) ids.push(id);
      });
      if (!ids.length) return;
      get().showToast(`${add.join('・')}をいつも通りで記録`, () => {
        set((s) => ({ meals: s.meals.filter((m) => !ids.includes(m.groupId)) }));
        ids.forEach((id) => persist(repo.softDeleteMealGroup(id)));
      });
    },
    setUsualMeal(slot, mealSetId) {
      set((s) => ({ usualMeals: { ...s.usualMeals, [slot]: mealSetId } }));
      persist(repo.setKv(`usual:${slot}`, mealSetId ?? ''));
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
        get().showToast(`${dayLabelOf(date)} ${kg.toFixed(1)}kg を記録`, () => {
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

    deleteWeight(date) {
      const prev = get().weights[date];
      if (prev === undefined) return;
      const prevSource = get().weightSources[date] ?? 'manual';
      const prevFat = get().bodyFat[date] ?? null;
      set((s) => {
        const w = { ...s.weights };
        delete w[date];
        const src = { ...s.weightSources };
        delete src[date];
        return { weights: w, weightSources: src };
      });
      persist(repo.deleteWeightOn(date));
      get().showToast(`${date.slice(5).replace('-', '/')} の体重の記録を削除`, () => {
        set((s) => ({ weights: { ...s.weights, [date]: prev }, weightSources: { ...s.weightSources, [date]: prevSource } }));
        persist(repo.saveBodyLog(uuid(), date, prev, prevSource, prevFat));
      });
    },

    setGoalWeight(kg) {
      if (isManagedNow()) return;
      set((s) => ({ profile: { ...s.profile, goalWeightKg: Math.round(Math.min(200, Math.max(30, kg)) * 10) / 10 } }));
      saveProfileNow();
    },

    addWeekAdjust(delta, toastText) {
      const before = get().profile.weekAdjustKcal;
      set((s) => ({ profile: { ...s.profile, weekAdjustKcal: before + delta } }));
      saveProfileNow();
      get().showToast(toastText, () => {
        set((s) => ({ profile: { ...s.profile, weekAdjustKcal: before } }));
        saveProfileNow();
      });
    },

    answerPaceSuggestion(weekStart, delta, answer, toastText) {
      set((s) => ({ paceAnswers: { ...s.paceAnswers, [weekStart]: answer } }));
      persist(repo.savePaceAnswer(weekStart, delta, answer));
      if (answer === 'accepted') {
        const before = get().profile.weekAdjustKcal;
        set((s) => ({ profile: { ...s.profile, weekAdjustKcal: before + delta } }));
        saveProfileNow();
        get().showToast(toastText ?? '週の合計を変更しました', () => {
          set((s) => {
            const a = { ...s.paceAnswers };
            delete a[weekStart];
            return { profile: { ...s.profile, weekAdjustKcal: before }, paceAnswers: a };
          });
          saveProfileNow();
          persist(repo.deletePaceAnswer(weekStart));
        });
      }
    },

    markSampleInserted() {
      set({ sampleInserted: true });
      persist(repo.setKv('sample_inserted', '1'));
    },

    setHealthSync(on) {
      set({ healthSync: on });
      persist(on ? repo.setKv('health_sync', '1') : repo.deleteKv('health_sync'));
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
      if (isManagedNow()) return;
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
      const ex: Exercise = { id: uuid(), name, part, coef: { 脚: 1.5, 背中: 1.2, 胸: 1.0, 肩: 1.0, 腕: 0.6, 腹: 0.6 }[part], isCustom: true, aliases: '自分で作成' };
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
          if (done && done.length) return { kg: done[done.length - 1].kg, reps: done[done.length - 1].reps, repsList: done.map((x) => x.reps) };
        }
        return null;
      };
      const ex: ExerciseLog[] = (tpl?.exercises ?? []).flatMap((te) => {
        const def = exBy.get(te.exerciseId);
        if (!def) return [];
        const last = lastOf(te.exerciseId);
        const prev = last ?? { kg: te.kg, reps: te.reps, repsList: Array.from({ length: te.sets }, () => te.reps) };
        // 前回、すべてのセットで目標の回数ができていたら、次は +2.5kg
        const up = !!last && last.kg > 0 && last.repsList.every((r) => r >= te.reps);
        const kg = up ? Math.round((prev.kg + 2.5) * 10) / 10 : prev.kg;
        return [{ exerciseId: def.id, name: def.name, part: def.part, coef: def.coef, prevKg: prev.kg, prevReps: prev.reps, prevRepsList: prev.repsList, tip: up ? '+2.5kg' : '', sets: Array.from({ length: te.sets }, () => ({ kg, reps: prev.reps, done: false })) }];
      });
      set({ doneOpen: false, rest: 0, session: { templateId: tpl?.id ?? null, name: tpl?.name ?? 'フリートレーニング', defaultDayType: tpl?.defaultDayType ?? 'normal', cur: 0, sel: 0, startedAt: Date.now(), ex } });
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
        ses.ex.push({ exerciseId: def.id, name: def.name, part: def.part, coef: def.coef, prevKg: prev.kg, prevReps: prev.reps, prevRepsList: [prev.reps, prev.reps, prev.reps], tip: '', sets: [0, 1, 2].map(() => ({ kg: prev.kg, reps: prev.reps, done: false })) });
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
      const date = dateKey(now);
      // 本人の中央値：記録が3回未満のあいだは標準値を使う
      const med = sessions.length >= 3 ? median(sessions.map((w) => w.volume)) : DEFAULT_MEDIAN_VOLUME;
      // 1日に複数回のトレーニングは、その日のボリュームを合わせて日タイプを決める（どれかが「高」のメニューなら高）
      const sameDay = sessions.filter((x) => x.date === date);
      const dayVolume = volume + sameDay.reduce((a, x) => a + x.volume, 0);
      const anyHigh = session.defaultDayType === 'high' || sameDay.some((x) => x.templateId && get().templates.find((t) => t.id === x.templateId)?.defaultDayType === 'high');
      const dayType = decideDayType(anyHigh ? 'high' : 'normal', dayVolume, med);
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
        memo: '',
        exercises: doneEx,
      };
      set((s) => ({ session: null, rest: 0, doneOpen: true, justCompletedSession: true, sessions: [...s.sessions, rec], dayTypes: { ...s.dayTypes, [rec.date]: dayType } }));
      persist(repo.saveSession(rec, rec.exercises.flatMap((e) => e.sets.map(() => uuid()))));
      persist(repo.setKv(`dt:${rec.date}`, dayType));
      if (sessions.length === 0) {
        const firstOpenAt = get().firstOpenAt;
        trackFirstTrainingCompleted(firstOpenAt !== null ? Math.max(0, Math.floor((now.getTime() - firstOpenAt) / 86400000)) : 0);
      }
      return rec;
    },
    resumeSession() {
      const { sessions, exercises } = get();
      const today = dateKey(new Date());
      const rec = sessions.filter((x) => x.date === today).slice(-1)[0];
      if (!rec) return;
      clearInterval(restTimer);
      const tpl = get().templates.find((t) => t.id === rec.templateId);
      const remaining = sessions.filter((x) => x.id !== rec.id);
      // 記録を取り消して、セッションとして開き直す。もう一度完了したら、目標を計算し直す
      const ex: ExerciseLog[] = rec.exercises.map((e) => ({ ...e, coef: exercises.find((d) => d.id === e.exerciseId)?.coef ?? e.coef, sets: e.sets.map((x) => ({ ...x, done: true })) }));
      const sameDay = remaining.filter((x) => x.date === today);
      const dayTypes = { ...get().dayTypes };
      if (sameDay.length) dayTypes[today] = sameDay[sameDay.length - 1].dayType;
      else delete dayTypes[today];
      set({ sessions: remaining, dayTypes, session: { templateId: rec.templateId, name: rec.name, defaultDayType: tpl?.defaultDayType ?? (rec.dayType === 'high' ? 'high' : 'normal'), cur: 0, sel: 0, startedAt: rec.startedAt, ex }, doneOpen: false, rest: 0 });
      persist(repo.deleteSession(rec.id));
      persist(sameDay.length ? repo.setKv(`dt:${today}`, dayTypes[today]) : repo.deleteKv(`dt:${today}`));
      get().showToast('続きから記録します');
    },
    setSessionMemo(id, memo) {
      set((s) => ({ sessions: s.sessions.map((x) => (x.id === id ? { ...x, memo } : x)) }));
      persist(repo.setSessionMemo(id, memo));
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
      set((s) => ({ rest: s.rest + 15, restMax: Math.max(s.restMax, s.rest + 15) }));
    },
    subRest() {
      set((s) => ({ rest: Math.max(0, s.rest - 15) }));
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
    setLastBackupAt(t) {
      set({ lastBackupAt: t });
      persist(repo.setKv('last_backup_at', String(t)));
    },
    setAccount(a) {
      set({ account: a, authChecked: true });
    },

    setPaid(v) {
      set({ paid: v });
      persist(v ? repo.setKv('paid', '1') : repo.deleteKv('paid'));
    },
    setAiPlus(v) {
      set({ aiPlus: v });
      persist(v ? repo.setKv('ai_plus', '1') : repo.deleteKv('ai_plus'));
    },
    applyEntitlements(e) {
      const comp = get().comp;
      set({ trialStartedAt: e.trialStartedAt ?? get().trialStartedAt, paid: FREE_LAUNCH || e.paid || comp.paid, aiPlus: e.aiPlus || comp.aiPlus });
      if (e.trialStartedAt !== null) persist(repo.setKv('trial_started_at', String(e.trialStartedAt)));
      persist(e.paid ? repo.setKv('paid', '1') : repo.deleteKv('paid'));
      persist(e.aiPlus ? repo.setKv('ai_plus', '1') : repo.deleteKv('ai_plus'));
    },
    async applyComp(c) {
      const prev = get().comp;
      if (prev.paid === c.paid && prev.aiPlus === c.aiPlus) return;
      persist(c.paid ? repo.setKv('comp_paid', '1') : repo.deleteKv('comp_paid'));
      persist(c.aiPlus ? repo.setKv('comp_ai', '1') : repo.deleteKv('comp_ai'));
      // 許可が外れたときは、購入状態（kv に残っている RevenueCat の値）に戻す
      const kv = await repo.getAllKv();
      set({ comp: c, paid: FREE_LAUNCH || kv.paid === '1' || c.paid, aiPlus: kv.ai_plus === '1' || c.aiPlus });
    },
    markTrialEndedSeen() {
      set({ trialEndedSeen: true });
      persist(repo.setKv('trial_ended_seen', '1'));
    },
    markNotifyPromptSeen() {
      set({ notifyPromptSeen: true });
      persist(repo.setKv('notify_prompt_seen', '1'));
    },
    clearJustCompletedSession() {
      set({ justCompletedSession: false });
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
    async devResetToFresh() {
      clearInterval(restTimer);
      await signOut().catch(() => {});
      await repo.wipeEverything();
      removeAllPhotos();
      await seedIfNeeded();
      useCoach.getState().reset();
      set({ account: null, loginSkipped: false, session: null, rest: 0, doneOpen: false, toast: null, trialStartedAt: null, paid: FREE_LAUNCH, aiPlus: false, comp: { paid: false, aiPlus: false }, trialEndedSeen: false, notifyPromptSeen: false, firstOpenAt: null, lastBackupAt: null });
      await get().reload();
    },
    async eraseAllData() {
      clearInterval(restTimer);
      await repo.wipeUserData();
      removeAllPhotos();
      await seedIfNeeded();
      useCoach.getState().setManaged(null);
      set({ session: null, rest: 0, doneOpen: false, toast: null });
      await get().reload();
    },

    async logout(wipe) {
      await signOut().catch(() => {});
      set({ account: null, loginSkipped: false });
      persist(repo.deleteKv('login_skipped'));
      // コーチの設定・共有はアカウントに付くもの。ログアウトしたら端末から外す（サーバー側の共有は、再ログインで戻る）
      useCoach.getState().reset();
      for (const k of COACH_KV_KEYS) persist(repo.deleteKv(k));
      if (wipe) await get().eraseAllData();
    },
  };
});

export const addDaysKey = (d: Date, n: number) => dateKey(addDays(d, n));
export type { Pfc };
