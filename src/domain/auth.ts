/** ログイン入力の検証（純粋関数） */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (s: string) => s.trim().toLowerCase();
export const isValidEmail = (s: string) => EMAIL_RE.test(s.trim());

export const CODE_LENGTH = 6;
/** 数字だけを残して6桁までにする（全角数字・空白・ハイフンが混じってもよい） */
export function normalizeCode(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\D/g, '')
    .slice(0, CODE_LENGTH);
}
export const isCompleteCode = (s: string) => normalizeCode(s).length === CODE_LENGTH;

/** 再送の待ち時間（秒）。連打でメールを送りすぎない */
export const RESEND_SECONDS = 30;
