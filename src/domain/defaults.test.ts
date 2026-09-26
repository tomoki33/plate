import { describe, expect, it } from 'vitest';
import { SEED_EXERCISES, SEED_TEMPLATES, SEED_WEEK_PLAN } from './defaults';

describe('初期データ', () => {
  it('種目は約80個（80以上）', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(80);
  });
  it('種目の id と名前は重複しない', () => {
    expect(new Set(SEED_EXERCISES.map((e) => e.id)).size).toBe(SEED_EXERCISES.length);
    expect(new Set(SEED_EXERCISES.map((e) => e.name)).size).toBe(SEED_EXERCISES.length);
  });
  it('全部位が入っている', () => {
    expect(new Set(SEED_EXERCISES.map((e) => e.part))).toEqual(new Set(['脚', '背中', '胸', '肩', '腕', '腹']));
  });
  it('テンプレートは実在する種目だけを参照する', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    for (const t of SEED_TEMPLATES) for (const e of t.exercises) expect(ids.has(e.exerciseId), `${t.name}: ${e.exerciseId}`).toBe(true);
  });
  it('週間スケジュールは7日で、実在するテンプレートかオフ', () => {
    expect(SEED_WEEK_PLAN).toHaveLength(7);
    const ids = new Set(SEED_TEMPLATES.map((t) => t.id));
    SEED_WEEK_PLAN.forEach((p) => expect(p === null || ids.has(p)).toBe(true));
  });
});
