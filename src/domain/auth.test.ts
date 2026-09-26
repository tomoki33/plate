import { describe, expect, it } from 'vitest';
import { isCompleteCode, isValidEmail, normalizeCode, normalizeEmail } from './auth';

describe('メールアドレス', () => {
  it('正しい形式', () => {
    expect(isValidEmail('you@example.com')).toBe(true);
    expect(isValidEmail(' you+plate@example.co.jp ')).toBe(true);
  });
  it('形式が違う', () => {
    ['', 'you', 'you@', '@example.com', 'you@example', 'you @example.com', 'you@exa mple.com'].forEach((s) => expect(isValidEmail(s), s).toBe(false));
  });
  it('小文字にそろえて前後の空白を除く', () => {
    expect(normalizeEmail('  You@Example.COM ')).toBe('you@example.com');
  });
});

describe('6桁コード', () => {
  it('数字だけを残し、6桁で切る', () => {
    expect(normalizeCode('12 34-56')).toBe('123456');
    expect(normalizeCode('1234567')).toBe('123456');
    expect(normalizeCode('abc')).toBe('');
  });
  it('全角数字も受け付ける', () => {
    expect(normalizeCode('１２３４５６')).toBe('123456');
  });
  it('6桁そろったか', () => {
    expect(isCompleteCode('12345')).toBe(false);
    expect(isCompleteCode('123 456')).toBe(true);
  });
});
