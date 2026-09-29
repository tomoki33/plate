import { summarize, needCount } from './aggregate';
import type { StudentRow } from './types';

/** 切り替えシートのコーチ行：「生徒 4人・2人に声かけを」 */
export function aggregateForSwitch(students: StudentRow[]): string {
  if (!students.length) return '生徒 0人・招待コードで招待できます';
  const need = needCount(students.map((s) => summarize(s)));
  return need ? `生徒 ${students.length}人・${need}人に声かけを` : `生徒 ${students.length}人・みんな順調です`;
}
