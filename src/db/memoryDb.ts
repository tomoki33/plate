/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import initSqlJs from 'sql.js';
import type { Db } from './client';
import * as schema from './schema';

/**
 * テスト用のメモリ上の SQLite（sql.js）。本番と同じマイグレーションを適用し、client.ts と同じ
 * Drizzle の sqlite-proxy で包む。expo-sqlite に依存しないので vitest で動く。
 */
export async function createMemoryDb(): Promise<{ db: Db; withTransaction: (fn: () => Promise<void>) => Promise<void> }> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const dir = fileURLToPath(new URL('../../drizzle', import.meta.url));
  for (const f of readdirSync(dir).filter((n: string) => n.endsWith('.sql')).sort()) {
    for (const st of readFileSync(join(dir, f), 'utf8').split('--> statement-breakpoint')) if (st.trim()) raw.run(st);
  }
  const db = drizzle(
    async (sql, params, method) => {
      const stmt = raw.prepare(sql);
      try {
        stmt.bind(params as never[]);
        const rows: unknown[][] = [];
        while (stmt.step()) rows.push(stmt.get() as unknown[]);
        if (method === 'run') return { rows: [] };
        return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
      } finally {
        stmt.free();
      }
    },
    { schema },
  );
  const withTransaction = async (fn: () => Promise<void>) => {
    raw.run('BEGIN');
    try {
      await fn();
      raw.run('COMMIT');
    } catch (e) {
      raw.run('ROLLBACK');
      throw e;
    }
  };
  return { db, withTransaction };
}
