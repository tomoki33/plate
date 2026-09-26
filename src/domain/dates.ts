export const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** 月曜=0 … 日曜=6 */
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - weekdayIndex(x));
  return x;
}
export const addDays = (d: Date, n: number) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
const JP_DAYS = ['月', '火', '水', '木', '金', '土', '日'];
export const formatJpDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日 ${JP_DAYS[weekdayIndex(d)]}曜`;
export const timeLabel = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export function slotOf(d: Date): '朝' | '昼' | '間食' | '夜' {
  const h = d.getHours();
  return h < 10 ? '朝' : h < 15 ? '昼' : h < 18 ? '間食' : '夜';
}
