/**
 * 'YYYY-MM-DD' の文字列だけで日付を扱う（端末のタイムゾーンに左右されないため）。
 * コーチ画面は「生徒のタイムゾーンの今日」で週を区切るので、Date ではなくキーで計算する。
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function addKey(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** 月曜=0 … 日曜=6 */
export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}
export const weekStartKey = (key: string) => addKey(key, -weekdayOf(key));
export const diffDays = (a: string, b: string) => {
  const t = (k: string) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(a) - t(b)) / 86400000);
};
/** 指定のタイムゾーンでの、その瞬間の日付 */
export function todayIn(tz: string, now: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  } catch {
    // 不明なタイムゾーンは日本時間として扱う
  }
  const t = new Date(now.getTime() + 9 * 3600_000);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
/** 「9/22–9/28」「9月30日 火曜」用 */
export const shortMd = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
