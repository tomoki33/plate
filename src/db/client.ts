import { drizzle, type SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';

export type Db = SqliteRemoteDatabase<typeof schema>;

/**
 * 起動時に initDb() を待ってから使う。
 *
 * expo-sqlite の同期API（Drizzle 標準の expo ドライバが使う）は、Web ではワーカーの応答を
 * メインスレッドでスピン待ちするため、重い処理でタイムアウトする。そこで Drizzle の
 * sqlite-proxy に、expo-sqlite の非同期APIだけを渡す。ネイティブでも Web でも同じ挙動になる。
 */
export let sqlite: SQLiteDatabase;
export let db: Db;

/**
 * Web は、ブラウザ内のファイル（OPFS）を1つの接続しか開けない。ほかのタブや、直前のタブ・ホットリロードの
 * 接続が残っていると開けないので、少し待って数回やり直す。
 */
async function openWithRetry(): Promise<SQLiteDatabase> {
  for (let i = 0; ; i++) {
    try {
      return await openDatabaseAsync('plate.db');
    } catch (e) {
      const busy = e instanceof Error && /Access Handle|NoModificationAllowed/i.test(`${e.name} ${e.message}`);
      if (!busy || i >= 6) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

let pending: Promise<Db> | undefined;
export function initDb(): Promise<Db> {
  pending ??= openWithRetry().then((s) => {
    sqlite = s;
    db = drizzle(
      async (sql, params, method) => {
        const stmt = await s.prepareAsync(sql);
        try {
          const res = await stmt.executeForRawResultAsync(params as never[]);
          if (method === 'run') return { rows: [] };
          const rows = (await res.getAllAsync()) as unknown[][];
          return { rows: method === 'get' ? (rows[0] as unknown[]) : rows };
        } finally {
          await stmt.finalizeAsync();
        }
      },
      { schema },
    );
    return db;
  });
  // 失敗したら、次の呼び出しでやり直せるようにする
  pending.catch(() => {
    pending = undefined;
  });
  return pending;
}
