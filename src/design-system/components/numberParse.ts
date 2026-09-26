// 数値入力の解釈（React Native に依存しない。テストしやすいよう分けてある）
/** 入力された文字を数値にする（全角数字・カンマ小数点も受け付ける）。読めなければ null */
export function parseNumber(text: string): number | null {
  const s = text.normalize('NFKC').replace(/,/g, '.').replace(/\s/g, '');
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

/** 範囲に収めて、小数の桁数にそろえる */
export function fitNumber(v: number, o: { min?: number; max?: number; decimals?: number }): number {
  const d = o.decimals ?? 0;
  const p = 10 ** d;
  const clamped = Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v));
  return Math.round(clamped * p) / p;
}
