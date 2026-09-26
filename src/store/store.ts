import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AI_LIMIT_FREE } from '../domain/estimate';
import { bestSet, decideDayType, median, TEMPLATES, volumeScore, type ExerciseLog, type Part } from '../domain/training';
import type { Coef, DayType, Pfc } from '../domain/types';
import { dateKey, slotOf } from '../domain/dates';
import { kvStorage } from './storage';

export interface Meal extends Pfc {
  id: string;
  date: string;
  slot: '朝' | '昼' | '間食' | '夜';
  name: string;
  ai?: boolean;
  createdAt: number;
}

export interface WorkoutRecord {
  id: string;
  date: string;
  templateId: string;
  name: string;
  finishedAt: number;
  exercises: ExerciseLog[];
  volume: number;
  doneSets: number;
  best: { name: string; e1rm: number } | null;
  dayType: DayType;
}

export interface Settings {
  goal: '減量' | '維持' | '増量';
  pace: string;
  weekKcal: number;
  coef: Coef;
  pk: number;
  /** 月曜=0。null はオフ */
  plan: (string | null)[];
}

export interface Session {
  templateId: string;
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

const DEFAULT_SETTINGS: Settings = {
  goal: '減量',
  pace: '−0.5 kg/週',
  weekKcal: 17500,
  coef: { high: 1.15, normal: 1.0, off: 0.85 },
  pk: 2.2,
  plan: ['chest', null, 'legs', null, 'legs', 'back', null],
};

interface PersistedState {
  settings: Settings;
  weights: Record<string, number>;
  meals: Meal[];
  todayTypes: Record<string, DayType>;
  workouts: WorkoutRecord[];
  aiUsed: Record<string, number>;
}

interface State extends PersistedState {
  session: Session | null;
  rest: number;
  restMax: number;
  doneOpen: boolean;
  toast: Toast | null;

  addMeal(name: string, v: Pfc, ai?: boolean): string;
  removeMeal(id: string): void;
  setWeight(date: string, kg: number): void;
  setTodayType(date: string, t: DayType | null): void;
  consumeAi(date: string): void;
  setCoef(t: keyof Coef, delta: number): void;
  setPk(delta: number): void;
  setWeekKcal(delta: number): void;

  startSession(templateId: string): void;
  cancelSession(): void;
  selectExercise(i: number): void;
  selectSet(i: number): void;
  adjustSet(field: 'kg' | 'reps', delta: number): void;
  toggleSet(i: number): void;
  nextExercise(): void;
  finishSession(): WorkoutRecord | null;
  tickRest(): void;
  startRest(): void;
  addRest(): void;
  skipRest(): void;
  setDoneOpen(v: boolean): void;

  showToast(text: string, undo?: () => void): void;
  hideToast(): void;
  resetAll(): void;
}

let uid = 0;
const newId = () => `${Date.now().toString(36)}${(uid++).toString(36)}`;
let toastSeq = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let restTimer: ReturnType<typeof setInterval> | undefined;

const initial = (): PersistedState => ({
  settings: DEFAULT_SETTINGS,
  weights: {},
  meals: [],
  todayTypes: {},
  workouts: [],
  aiUsed: {},
});

/** そのテンプレートの前回の値（直近の記録があればそれ、なければ既定） */
function buildExercises(templateId: string, workouts: WorkoutRecord[]): ExerciseLog[] {
  const t = TEMPLATES[templateId];
  const last = workouts.slice().reverse();
  return t.exercises.map((def) => {
    let kg = def.kg;
    let reps = def.reps;
    for (const w of last) {
      const ex = w.exercises.find((e) => e.name === def.name);
      const done = ex?.sets.filter((s) => s.done);
      if (done && done.length) {
        kg = done[done.length - 1].kg;
        reps = done[done.length - 1].reps;
        break;
      }
    }
    return { name: def.name, part: def.part as Part, prevKg: kg, prevReps: reps, sets: [0, 1, 2].map(() => ({ kg, reps, done: false })) };
  });
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const round1 = (n: number) => Math.round(n * 10) / 10;

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      session: null,
      rest: 0,
      restMax: 120,
      doneOpen: false,
      toast: null,

      addMeal(name, v, ai) {
        const now = new Date();
        const id = newId();
        const meal: Meal = { id, date: dateKey(now), slot: slotOf(now), name, ai, createdAt: now.getTime(), kcal: v.kcal, P: v.P, F: v.F, C: v.C };
        set((s) => ({ meals: [...s.meals, meal] }));
        get().showToast(`${name} を追加`, () => set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })));
        return id;
      },
      removeMeal(id) {
        const meal = get().meals.find((m) => m.id === id);
        if (!meal) return;
        set((s) => ({ meals: s.meals.filter((m) => m.id !== id) }));
        get().showToast(`${meal.name} を削除`, () => set((s) => ({ meals: [...s.meals, meal].sort((a, b) => a.createdAt - b.createdAt) })));
      },
      setWeight(date, kg) {
        const prev = get().weights[date];
        set((s) => ({ weights: { ...s.weights, [date]: kg } }));
        get().showToast(`体重 ${kg.toFixed(1)}kg を記録`, () =>
          set((s) => {
            const w = { ...s.weights };
            if (prev === undefined) delete w[date];
            else w[date] = prev;
            return { weights: w };
          }),
        );
      },
      setTodayType(date, t) {
        set((s) => {
          const tt = { ...s.todayTypes };
          if (t) tt[date] = t;
          else delete tt[date];
          return { todayTypes: tt };
        });
      },
      consumeAi(date) {
        set((s) => ({ aiUsed: { ...s.aiUsed, [date]: (s.aiUsed[date] ?? 0) + 1 } }));
      },
      setCoef(t, delta) {
        set((s) => ({ settings: { ...s.settings, coef: { ...s.settings.coef, [t]: Math.round(Math.min(1.4, Math.max(0.6, s.settings.coef[t] + delta)) * 100) / 100 } } }));
      },
      setPk(delta) {
        set((s) => ({ settings: { ...s.settings, pk: Math.min(3, Math.max(1.6, round1(s.settings.pk + delta))) } }));
      },
      setWeekKcal(delta) {
        set((s) => ({ settings: { ...s.settings, weekKcal: Math.min(30000, Math.max(8000, s.settings.weekKcal + delta)) } }));
      },

      startSession(templateId) {
        clearInterval(restTimer);
        set((s) => ({
          doneOpen: false,
          rest: 0,
          session: { templateId, cur: 0, sel: 0, startedAt: Date.now(), ex: buildExercises(templateId, s.workouts) },
        }));
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
          if (!s.session) return s;
          const ses = clone(s.session);
          const st = ses.ex[ses.cur].sets[ses.sel];
          st[field] = field === 'kg' ? Math.max(0, Math.round((st.kg + delta) * 10) / 10) : Math.max(1, st.reps + delta);
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
      nextExercise() {
        set((s) => (s.session ? { session: { ...s.session, cur: Math.min(s.session.ex.length - 1, s.session.cur + 1), sel: 0 } } : s));
      },
      finishSession() {
        const { session, workouts, settings } = get();
        if (!session) return null;
        clearInterval(restTimer);
        const template = TEMPLATES[session.templateId];
        const now = new Date();
        const volume = volumeScore(session.ex);
        const med = median(workouts.map((w) => w.volume));
        const dayType = decideDayType(template, volume, med);
        const record: WorkoutRecord = {
          id: newId(),
          date: dateKey(now),
          templateId: session.templateId,
          name: template.name,
          finishedAt: now.getTime(),
          exercises: session.ex,
          volume,
          doneSets: session.ex.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0),
          best: bestSet(session.ex),
          dayType,
        };
        void settings;
        set((s) => ({
          session: null,
          rest: 0,
          doneOpen: true,
          workouts: [...s.workouts, record],
          todayTypes: { ...s.todayTypes, [record.date]: dayType },
        }));
        return record;
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

      showToast(text, undo) {
        clearTimeout(toastTimer);
        set({ toast: { id: ++toastSeq, text, undo } });
        toastTimer = setTimeout(() => set({ toast: null }), 3500);
      },
      hideToast() {
        clearTimeout(toastTimer);
        set({ toast: null });
      },
      resetAll() {
        clearInterval(restTimer);
        set({ ...initial(), session: null, rest: 0, doneOpen: false, toast: null });
      },
    }),
    {
      name: 'plate-v1',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s): PersistedState => ({
        settings: s.settings,
        weights: s.weights,
        meals: s.meals,
        todayTypes: s.todayTypes,
        workouts: s.workouts,
        aiUsed: s.aiUsed,
      }),
    },
  ),
);

export const aiRemaining = (used: number | undefined) => Math.max(0, AI_LIMIT_FREE - (used ?? 0));
