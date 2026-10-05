import { getTableName, is } from 'drizzle-orm';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from './client';
import { createMemoryDb } from './memoryDb';
import { applyPayloadTo, BACKUP_TABLES, BACKUP_VERSION, buildPayloadFrom, MERGE_KEYS, type BackupPayload, type WithTransaction } from './restore';
import * as s from './schema';

let db: Db;
let tx: WithTransaction;
beforeEach(async () => {
  ({ db, withTransaction: tx } = await createMemoryDb());
});

const base = { updatedAt: 1, deletedAt: null };
const foodRow = (id: string, source: string, code: string | null = null) => ({ ...base, id, name: id, search: id, kcal: 100, p: 1, f: 1, c: 1, source, code, unitG: null, defaultG: null });
const body = (id: string, date: string, kg = 60) => ({ ...base, id, date, weightKg: kg, bodyFatPct: null, source: 'manual' });
const meal = (id: string, date = '2026-10-01') => ({
  ...base, id, date, slot: '朝', foodId: null, groupId: 'g', groupName: 'g', name: id, grams: 100, kcal: 100, p: 1, f: 1, c: 1, ai: false, photoUri: null, inputType: 'search', createdAt: 1,
});
const payload = (tables: Record<string, unknown[]>, extra: Partial<BackupPayload> = {}): BackupPayload => ({ version: BACKUP_VERSION, createdAt: 1, tables, ...extra });
/** 列挙型の列に string を渡すテスト用の行を、そのまま insert する */
const put = (t: SQLiteTable, rows: object | object[]) => db.insert(t).values(rows as never);
const ids = async (t: typeof s.food | typeof s.bodyLog | typeof s.mealEntry) => (await db.select().from(t as never) as { id: string }[]).map((r) => r.id).sort();

describe('バックアップの対象テーブル', () => {
  it('schema の全テーブルが BACKUP_TABLES に入っている（テーブルを足したら、ここで気づく）', () => {
    const all = (Object.values(s) as unknown[]).filter((v) => is(v, SQLiteTable)).map((t) => getTableName(t as SQLiteTable)).sort();
    const covered = BACKUP_TABLES.map((b) => getTableName(b.table)).sort();
    expect(covered).toEqual(all);
  });
  it('JSON のキーは重複せず、テーブル名と一致する', () => {
    const keys = BACKUP_TABLES.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const b of BACKUP_TABLES) expect(b.key).toBe(getTableName(b.table));
    for (const k of MERGE_KEYS) expect(keys).toContain(k);
  });
});

describe('復元（置き換え）', () => {
  it('全テーブルの行が戻り、buildPayload と往復して同じになる', async () => {
    const rows: Record<string, unknown[]> = {
      profile: [{ ...base, id: 'p', sex: 'male', birthYear: 1990, heightCm: 170, activity: 1.5, goal: 'cut', paceKgPerWeek: 0.5, pk: 2, coefHigh: 1.1, coefNormal: 1, coefOff: 0.9, tdee: 2400, tdeeWeek: null, onboarded: true, goalWeightKg: null, weekAdjustKcal: 0 }],
      body_log: [body('b1', '2026-10-01')],
      exercise: [{ ...base, id: 'e1', name: 'スクワット', part: '脚', coef: 1, isCustom: false, aliases: '' }],
      workout_template: [{ ...base, id: 't1', name: 'A', exercises: [{ exerciseId: 'e1', sets: 3, kg: 50, reps: 10 }], defaultDayType: 'high', sortOrder: 0 }],
      week_plan: [{ ...base, id: 'w1', weekday: 0, templateId: 't1' }],
      workout_session: [{ ...base, id: 'ws1', date: '2026-10-01', templateId: 't1', name: 'A', startedAt: 1, endedAt: 2, volumeScore: 10, dayType: 'high', memo: '' }],
      workout_set: [{ ...base, id: 'st1', sessionId: 'ws1', exerciseId: 'e1', weightKg: 50, reps: 10, rir: null, order: 0 }],
      food: [foodRow('f1', '自作'), foodRow('f2', 'AI')],
      meal_set: [{ ...base, id: 'ms1', name: 'セット', items: [{ foodId: 'f1', g: 100 }], useCount: 1, lastUsedAt: null, slotHint: null }],
      meal_entry: [meal('m1')],
      day_target: [{ ...base, id: 'd1', date: '2026-10-01', dayType: 'high', kcal: 2000, p: 1, f: 1, c: 1, reason: 'x' }],
      pace_suggestion: [{ ...base, id: '2026-09-28', weekStart: '2026-09-28', deltaKcal: -700, answer: 'accepted' }],
      kv: [{ key: 'k', value: 'v', updatedAt: 1 }],
    };
    expect(Object.keys(rows).sort()).toEqual(BACKUP_TABLES.map((b) => b.key).sort());
    const r = await applyPayloadTo(db, tx, payload(rows));
    expect(r).toEqual({ ok: true });
    const out = await buildPayloadFrom(db, 1);
    expect(out.tables).toEqual(rows);
  });

  it('端末にあった自作・記録は置き換わるが、成分表・カタログは残る', async () => {
    await put(s.food, [foodRow('old', '自作'), foodRow('cat', 'カタログ', 'C1'), foodRow('std', '成分表', '01001')]);
    await put(s.bodyLog, body('old-b', '2026-09-01'));
    const r = await applyPayloadTo(db, tx, payload({ food: [foodRow('new', '自作')], body_log: [body('new-b', '2026-10-01')] }));
    expect(r.ok).toBe(true);
    expect(await ids(s.food)).toEqual(['cat', 'new', 'std']);
    expect(await ids(s.bodyLog)).toEqual(['new-b']);
  });

  it('カタログ入りの古いバックアップでも失敗せず、カタログは読み飛ばす（Failed query の回帰）', async () => {
    await put(s.food, [foodRow('cat', 'カタログ', 'C1'), foodRow('std', '成分表', '01001')]);
    const old = payload({ food: [foodRow('cat', 'カタログ', 'C1'), foodRow('std', '成分表', '01001'), foodRow('mine', '自作')], meal_entry: [meal('m1')] });
    expect(await applyPayloadTo(db, tx, old)).toEqual({ ok: true });
    expect(await ids(s.food)).toEqual(['cat', 'mine', 'std']);
    expect(await ids(s.mealEntry)).toEqual(['m1']);
  });

  it('空のバックアップ（tables が空）は、自作・記録を消して成分表・カタログを残す', async () => {
    await put(s.food, [foodRow('mine', '自作'), foodRow('cat', 'カタログ', 'C1')]);
    await put(s.mealEntry, meal('m1'));
    expect(await applyPayloadTo(db, tx, payload({}))).toEqual({ ok: true });
    expect(await ids(s.food)).toEqual(['cat']);
    expect(await ids(s.mealEntry)).toEqual([]);
  });

  it('50行を超える行も、分割して全部入る', async () => {
    const rows = Array.from({ length: 120 }, (_, i) => body(`b${i}`, '2026-10-01'));
    expect(await applyPayloadTo(db, tx, payload({ body_log: rows }))).toEqual({ ok: true });
    expect(await ids(s.bodyLog)).toHaveLength(120);
  });

  it('途中で失敗したら、全体を巻き戻す（端末の記録が消えたままにならない）', async () => {
    await put(s.bodyLog, body('keep', '2026-09-01'));
    // meal_entry の id 重複で失敗させる
    const bad = payload({ body_log: [body('new', '2026-10-01')], meal_entry: [meal('dup'), meal('dup')] });
    const r = await applyPayloadTo(db, tx, bad);
    expect(r.ok).toBe(false);
    expect(await ids(s.bodyLog)).toEqual(['keep']);
  });

  it('版が違う・形が壊れたバックアップは、何も変えずに断る', async () => {
    await put(s.bodyLog, body('keep', '2026-09-01'));
    for (const bad of [payload({}, { version: 999 }), null, { version: BACKUP_VERSION, createdAt: 1 }, { version: BACKUP_VERSION, createdAt: 1, tables: null }]) {
      expect(await applyPayloadTo(db, tx, bad as never)).toEqual({ ok: false, error: '対応していないバックアップです' });
    }
    expect(await ids(s.bodyLog)).toEqual(['keep']);
  });
});

describe('復元（merge）', () => {
  it('端末の記録は消さず、入っていない行だけ足す。同じ id は端末を優先', async () => {
    await put(s.bodyLog, body('b1', '2026-10-01', 60));
    await put(s.mealEntry, meal('m1'));
    await put(s.food, foodRow('mine', '自作'));
    const r = await applyPayloadTo(db, tx, payload({ body_log: [body('b1', '2026-10-01', 99), body('b2', '2026-10-02')], meal_entry: [meal('m2')], food: [foodRow('other', '自作')] }, { mode: 'merge' }));
    expect(r).toEqual({ ok: true });
    expect(await ids(s.bodyLog)).toEqual(['b1', 'b2']);
    expect((await db.select().from(s.bodyLog)).find((b) => b.id === 'b1')?.weightKg).toBe(60);
    expect(await ids(s.mealEntry)).toEqual(['m1', 'm2']);
    // merge で足すのは体重と食事の記録だけ
    expect(await ids(s.food)).toEqual(['mine']);
  });

  it('空の merge は何も変えない。同じ merge を2回やっても増えない', async () => {
    await put(s.bodyLog, body('b1', '2026-10-01'));
    expect(await applyPayloadTo(db, tx, payload({}, { mode: 'merge' }))).toEqual({ ok: true });
    expect(await ids(s.bodyLog)).toEqual(['b1']);
    const m = payload({ body_log: [body('b2', '2026-10-02')] }, { mode: 'merge' });
    await applyPayloadTo(db, tx, m);
    await applyPayloadTo(db, tx, m);
    expect(await ids(s.bodyLog)).toEqual(['b1', 'b2']);
  });
});

describe('バックアップの作成', () => {
  it('食品は自作とAIだけ入る', async () => {
    await put(s.food, [foodRow('a', '成分表', '1'), foodRow('b', 'カタログ', '2'), foodRow('c', '自作'), foodRow('d', 'AI')]);
    const p = await buildPayloadFrom(db, 5);
    expect(p).toMatchObject({ version: BACKUP_VERSION, createdAt: 5 });
    expect((p.tables.food as { id: string }[]).map((f) => f.id).sort()).toEqual(['c', 'd']);
  });
});
