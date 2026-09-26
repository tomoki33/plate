import { describe, expect, it } from 'vitest';
import { fitNumber, parseNumber } from './components/numberParse';

describe('手入力の数値', () => {
  it('数字を読む（全角・カンマ小数点・空白）', () => {
    expect(parseNumber('72.5')).toBe(72.5);
    expect(parseNumber('７２．５')).toBe(72.5);
    expect(parseNumber('72,5')).toBe(72.5);
    expect(parseNumber(' 100 ')).toBe(100);
    expect(parseNumber('.5')).toBe(0.5);
  });
  it('読めない入力は null', () => {
    ['', 'abc', '1.2.3', '--1', '12kg'].forEach((s) => expect(parseNumber(s), s).toBeNull());
  });
  it('範囲に収め、小数の桁にそろえる', () => {
    expect(fitNumber(250, { max: 200 })).toBe(200);
    expect(fitNumber(-3, { min: 0 })).toBe(0);
    expect(fitNumber(72.456, { decimals: 1 })).toBe(72.5);
    expect(fitNumber(12.7, { decimals: 0 })).toBe(13);
    expect(fitNumber(1.234, { decimals: 2, min: 0.6, max: 1.4 })).toBe(1.23);
  });
});
