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
 * Web は、ブラウザ内のファイル（OPFS）を1つの接続しか開けない。
 * ほかのタブや、直前のタブの接続が残っていると開けないので、少し待って数回やり直す。
 */
async function openWithRetry(): Promise<SQLiteDatabase> {
  for (let i = 0; ; i++) {
    try {
      return await openDatabaseAsync('plate.db');
    } catch (e) {
      const busy = e instanceof Error && /Access Handle|NoModificationAllowed/i.test(`${e.name} ${e.message}`);
      if (!busy || i >= 20) throw e;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// 接続は globalThis に持つ。開発中のホットリロードでこのファイルが再実行されても、
// 2つ目の接続を開こうとして、自分自身と衝突しないようにする。
interface Conn {
  sqlite: SQLiteDatabase;
  db: Db;
}
const cache = globalThis as unknown as { __plateConn?: Promise<Conn> };

export function initDb(): Promise<Db> {
  cache.__plateConn ??= openWithRetry().then((s) => {
    const d = drizzle(
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
    // ページを閉じる・再読み込みするときに、ファイルを手放す（次のページがすぐ開けるように）
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') window.addEventListener('pagehide', () => void s.closeAsync().catch(() => {}));
    return { sqlite: s, db: d };
  });
  const p = cache.__plateConn;
  // 失敗したら、次の呼び出しでやり直せるようにする
  p.catch(() => {
    if (cache.__plateConn === p) cache.__plateConn = undefined;
  });
  return p.then((c) => {
    sqlite = c.sqlite;
    db = c.db;
    return db;
  });
}

// ホットリロードでこのファイルだけが再実行されたときも、開いてある接続をそのまま使う
void cache.__plateConn?.then((c) => {
  sqlite = c.sqlite;
  db = c.db;
});
