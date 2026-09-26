import { sqlite } from './client';

/** drizzle-kit が作る drizzle/migrations.js の形 */
export interface MigrationBundle {
  journal: { entries: { idx: number; when: number; tag: string; breakpoints: boolean }[] };
  migrations: Record<string, string>;
}

/**
 * マイグレーションを順に適用する（Drizzle の記録テーブルと同じ形式で、適用済みは飛ばす）。
 * 標準の useMigrations は同期APIを使うので、非同期APIだけで動く版をここに置く。
 */
export async function runMigrations(bundle: MigrationBundle): Promise<void> {
  await sqlite.execAsync('CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (id INTEGER PRIMARY KEY AUTOINCREMENT, hash text NOT NULL, created_at numeric)');
  const last = await sqlite.getFirstAsync<{ created_at: number }>('SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1');
  for (const entry of bundle.journal.entries) {
    if (last && Number(last.created_at) >= entry.when) continue;
    const sql = bundle.migrations[`m${String(entry.idx).padStart(4, '0')}`];
    if (!sql) throw new Error(`migration ${entry.tag} is missing`);
    const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    await sqlite.withTransactionAsync(async () => {
      for (const st of statements) await sqlite.execAsync(st);
      await sqlite.runAsync('INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)', [entry.tag, entry.when]);
    });
  }
}
