import { beforeEach, describe, expect, it, vi } from 'vitest';

// 端末 DB・通信・課金などネイティブ依存はモックする（kv だけ中身を持たせる）
const kv: Record<string, string> = {};
vi.mock('../db/repo', () => ({
  getAllKv: vi.fn(async () => ({ ...kv })),
  setKv: vi.fn(async (k: string, v: string) => void (kv[k] = v)),
  deleteKv: vi.fn(async (k: string) => void delete kv[k]),
  saveProfile: vi.fn(async () => {}),
  saveWeekPlan: vi.fn(async () => {}),
}));
vi.mock('../db/seed', () => ({ seedIfNeeded: vi.fn() }));
vi.mock('../services/photos', () => ({ removeAllPhotos: vi.fn() }));
vi.mock('../services/supabase', () => ({ signOut: vi.fn(), supabase: () => null }));
vi.mock('../services/billing', () => ({ startTrial: vi.fn() }));
vi.mock('../services/analytics', () => ({ trackDayLogged: vi.fn(), trackFirstTrainingCompleted: vi.fn(), trackTrialStarted: vi.fn() }));
vi.mock('../features/coach/api', () => ({}));
vi.mock('../lib/id', () => ({ uuid: () => 'id' }));
vi.mock('../lib/flags', () => ({ FREE_LAUNCH: false, COACH_MODE: true }));

/* eslint-disable import/first -- vi.mock は import より前に置く */
import { isManagedNow, useCoach, withCoachApply, type Managed } from './coachStore';
import { useStore } from './store';
import type { MyLink } from '../features/coach/types';

const managed = { planId: 'p', coachName: 'C', proteinG: 130, fatPct: 25, targetWeight: 60, pace: -0.5, appliedAt: 0, effectiveFrom: '2026-10-01', templateIds: [] } as Managed;
const link = (over: Partial<MyLink> = {}) => ({ managesGoals: true, status: 'active', ...over }) as MyLink;
const setCoach = (m: Managed | null, l: MyLink | null) => useCoach.setState({ managed: m, link: l });

beforeEach(() => {
  for (const k of Object.keys(kv)) delete kv[k];
  useStore.setState({ comp: { paid: false, aiPlus: false }, paid: false, aiPlus: false });
  setCoach(null, null);
});

describe('applyComp（許可リスト）', () => {
  it('付与：本体・AIプラスが有効になり kv に残る', async () => {
    await useStore.getState().applyComp({ paid: true, aiPlus: true });
    const s = useStore.getState();
    expect(s.comp).toEqual({ paid: true, aiPlus: true });
    expect(s.paid).toBe(true);
    expect(s.aiPlus).toBe(true);
    expect(kv.comp_paid).toBe('1');
    expect(kv.comp_ai).toBe('1');
  });

  it('解除：購入状態（kv の RevenueCat の値）が無ければ無効に戻る', async () => {
    await useStore.getState().applyComp({ paid: true, aiPlus: true });
    await useStore.getState().applyComp({ paid: false, aiPlus: false });
    const s = useStore.getState();
    expect(s.comp).toEqual({ paid: false, aiPlus: false });
    expect(s.paid).toBe(false);
    expect(s.aiPlus).toBe(false);
    expect(kv.comp_paid).toBeUndefined();
    expect(kv.comp_ai).toBeUndefined();
  });

  it('解除：実際に購入している分は残る', async () => {
    kv.paid = '1';
    await useStore.getState().applyComp({ paid: true, aiPlus: true });
    await useStore.getState().applyComp({ paid: false, aiPlus: false });
    const s = useStore.getState();
    expect(s.paid).toBe(true);
    expect(s.aiPlus).toBe(false);
  });

  it('一部だけの付与（本体のみ）', async () => {
    await useStore.getState().applyComp({ paid: true, aiPlus: false });
    const s = useStore.getState();
    expect(s.paid).toBe(true);
    expect(s.aiPlus).toBe(false);
    expect(kv.comp_ai).toBeUndefined();
  });

  it('変化がなければ何もしない', async () => {
    const { setKv } = await import('../db/repo');
    vi.mocked(setKv).mockClear();
    await useStore.getState().applyComp({ paid: false, aiPlus: false });
    expect(setKv).not.toHaveBeenCalled();
  });

  it('applyEntitlements は許可リストの分を落とさない', () => {
    useStore.setState({ comp: { paid: true, aiPlus: true } });
    useStore.getState().applyEntitlements({ trialStartedAt: null, paid: false, aiPlus: false });
    expect(useStore.getState().paid).toBe(true);
    expect(useStore.getState().aiPlus).toBe(true);
  });
});

describe('isManagedNow', () => {
  it('管理プランとリンクが揃って active のときだけ true', () => {
    expect(isManagedNow()).toBe(false);
    setCoach(managed, link());
    expect(isManagedNow()).toBe(true);
  });
  it.each([
    ['managed が無い', null, link()],
    ['link が無い', managed, null],
    ['目標を管理していない', managed, link({ managesGoals: false })],
    ['リンクが paused（active でない）', managed, link({ status: 'paused' })],
  ])('%s → false', (_n, m, l) => {
    setCoach(m, l);
    expect(isManagedNow()).toBe(false);
  });
  it('withCoachApply の中だけガードが外れ、例外でも戻る', () => {
    setCoach(managed, link());
    expect(withCoachApply(() => isManagedNow())).toBe(false);
    expect(() => withCoachApply(() => { throw new Error('x'); })).toThrow();
    expect(isManagedNow()).toBe(true);
  });
});

describe('store のガード（管理中は目的・ペースなどを変えられない）', () => {
  const profile = () => useStore.getState().profile;

  it('管理中：updateProfile で goal / pace が無視される（他の項目は通る）', () => {
    const before = { goal: profile().goal, pace: profile().pace };
    setCoach(managed, link());
    useStore.getState().updateProfile({ goal: before.goal === 'cut' ? 'bulk' : 'cut', pace: 0.9, heightCm: 171 }, 60);
    expect(profile().goal).toBe(before.goal);
    expect(profile().pace).toBe(before.pace);
    expect(profile().heightCm).toBe(171);
  });

  it('管理していなければ goal が変えられる', () => {
    const next = profile().goal === 'cut' ? 'bulk' : 'cut';
    useStore.getState().updateProfile({ goal: next }, 60);
    expect(profile().goal).toBe(next);
  });

  it('管理中：setPkTo / setGoalWeight / setWeekPlan は何もしない', () => {
    const pk = profile().pk;
    const gw = profile().goalWeightKg;
    const plan = useStore.getState().weekPlan.slice();
    setCoach(managed, link());
    useStore.getState().setPkTo(2.9);
    useStore.getState().setGoalWeight(55);
    useStore.getState().setWeekPlan(0, 'tpl');
    expect(profile().pk).toBe(pk);
    expect(profile().goalWeightKg).toBe(gw);
    expect(useStore.getState().weekPlan).toEqual(plan);
  });

  it('管理していなければ setPkTo / setGoalWeight が効く', () => {
    useStore.getState().setPkTo(2.5);
    useStore.getState().setGoalWeight(55);
    expect(profile().pk).toBe(2.5);
    expect(profile().goalWeightKg).toBe(55);
  });

  it('withCoachApply の中ならコーチ側の反映として変えられる', () => {
    setCoach(managed, link());
    withCoachApply(() => useStore.getState().setGoalWeight(55));
    expect(profile().goalWeightKg).toBe(55);
  });
});
