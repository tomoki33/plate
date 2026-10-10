import { eq } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import { backupFoods } from '../domain/backupFoods';
import type { Db } from './client';
import * as s from './schema';

/** バックアップの形式の版。互換のない変更をしたら上げる */
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  version: number;
  createdAt: number;
  /**
   * 'merge'：端末の記録は消さず、入っていない行だけ足す（他のシステムからの移行用。含まれるテーブルだけを足す）。
   * 省略または 'replace'：端末の記録をバックアップの内容に置き換える。
   */
  mode?: 'replace' | 'merge';
  tables: Record<string, unknown[]>;
}

/**
 * バックアップに入れるテーブルの一覧（JSON のキー → テーブル）。
 * テーブルを足したら、ここにも足す（schema の全テーブルが入っているかは restore.test.ts が確かめる）。
 * 並びは復元で入れる順。消すときは逆順。
 */
export const BACKUP_TABLES = [
  { key: 'profile', table: s.profile },
  { key: 'exercise', table: s.exercise },
  { key: 'workout_template', table: s.workoutTemplate },
  { key: 'week_plan', table: s.weekPlan },
  // 食品は自作とAIだけ。成分表・カタログはアプリに入っているので戻さない（古いバックアップに入っていても読み飛ばす）
  { key: 'food', table: s.food },
  { key: 'meal_set', table: s.mealSet },
  { key: 'body_log', table: s.bodyLog },
  { key: 'meal_entry', table: s.mealEntry },
  { key: 'workout_session', table: s.workoutSession },
  { key: 'workout_set', table: s.workoutSet },
  { key: 'day_target', table: s.dayTarget },
  { key: 'pace_suggestion', table: s.paceSuggestion },
  { key: 'kv', table: s.kv },
] as const satisfies readonly { key: string; table: SQLiteTable }[];

/** 'merge' で足すテーブル（現状は体重と食事の記録だけ） */
export const MERGE_KEYS: readonly string[] = ['body_log', 'meal_entry'];

/** トランザクションを張る関数（本番は expo-sqlite の withTransactionAsync、テストではメモリDBの BEGIN/COMMIT） */
export type WithTransaction = (fn: () => Promise<void>) => Promise<void>;

/** 計測の同意とIDは、アカウントのバックアップに入れない（アカウントと結び付けない約束のため。機種変更後は、あらためて選んでもらう） */
const backupKv = <T extends { key: string }>(rows: T[]): T[] => rows.filter((r) => !r.key.startsWith('analytics_'));

export async function buildPayloadFrom(db: Db, now = Date.now()): Promise<BackupPayload> {
  const tables: Record<string, unknown[]> = {};
  for (const { key, table } of BACKUP_TABLES) {
    const rows = (await db.select().from(table as never)) as { source?: string }[];
    tables[key] = key === 'food' ? backupFoods(rows as { source: string }[]) : key === 'kv' ? backupKv(rows as { key: string }[]) : rows;
  }
  return { version: BACKUP_VERSION, createdAt: now, tables };
}

export async function applyPayloadTo(db: Db, withTransaction: WithTransaction, p: BackupPayload): Promise<{ ok: boolean; error?: string }> {
  if (!p || p.version !== BACKUP_VERSION || typeof p.tables !== 'object' || p.tables === null || Array.isArray(p.tables)) return { ok: false, error: '対応していないバックアップです' };
  // 破壊的な置き換えの前に、渡されたテーブルがすべて配列か確かめる（配列でないと行が入らないまま消すだけになる）
  if (Object.values(p.tables).some((rows) => !Array.isArray(rows))) return { ok: false, error: '対応していないバックアップです' };
  const t = p.tables as Record<string, never[]>;
  const insertChunks = async (table: SQLiteTable, rows: never[], ignoreDup: boolean) => {
    for (let i = 0; i < rows.length; i += 50) {
      const q = db.insert(table).values(rows.slice(i, i + 50) as never);
      await (ignoreDup ? q.onConflictDoNothing() : q);
    }
  };
  try {
    if (p.mode === 'merge') {
      await withTransaction(async () => {
        for (const { key, table } of BACKUP_TABLES) {
          if (MERGE_KEYS.includes(key)) await insertChunks(table, t[key] ?? [], true);
        }
      });
      return { ok: true };
    }
    await withTransaction(async () => {
      for (const { key, table } of [...BACKUP_TABLES].reverse()) {
        if (key === 'food') {
          await db.delete(s.food).where(eq(s.food.source, '自作'));
          await db.delete(s.food).where(eq(s.food.source, 'AI'));
        } else {
          await db.delete(table);
        }
      }
      for (const { key, table } of BACKUP_TABLES) {
        const rows = t[key] ?? [];
        await insertChunks(table, key === 'food' ? (backupFoods(rows as unknown as { source: string }[]) as never[]) : rows, false);
      }
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
