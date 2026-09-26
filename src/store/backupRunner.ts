import { backupNow } from '../services/backup';
import { useStore } from './store';

const pad = (n: number) => String(n).padStart(2, '0');

/** 「今日 6:02」「昨日 22:10」「9/24 6:02」 */
export function backupLabel(t: number, now = new Date()): string {
  const d = new Date(t);
  const time = `${d.getHours()}:${pad(d.getMinutes())}`;
  const day = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (day(d) === day(now)) return `今日 ${time}`;
  if (day(d) === day(yesterday)) return `昨日 ${time}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

/** バックアップして、成功したら時刻を覚える（ログイン時と、1日に1回） */
export async function runBackup(): Promise<boolean> {
  const r = await backupNow();
  if (r.ok && r.at) useStore.getState().setLastBackupAt(r.at);
  return r.ok;
}
