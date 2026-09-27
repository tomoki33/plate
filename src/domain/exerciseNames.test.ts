import { describe, expect, it } from 'vitest';
import { shortExName } from './exerciseNames';

describe('種目の短い呼び名', () => {
  it('よく使う種目は通称、ないものは6文字まで', () => {
    expect(shortExName('ブルガリアンスクワット')).toBe('BSS');
    expect(shortExName('ベンチプレス')).toBe('ベンチ');
    expect(shortExName('スクワット')).toBe('スクワット');
    expect(shortExName('ケーブルクロスオーバー')).toBe('ケーブルクロ');
  });
});
