import { describe, expect, it } from 'vitest';
import { BASES, DISCLAIMER } from './citations';

describe('計算の根拠と出典', () => {
  it('出典のリンクは https で、重複がない', () => {
    const urls = BASES.flatMap((b) => b.sources.map((s) => s.url));
    expect(urls.length).toBeGreaterThan(8);
    for (const u of urls) expect(u).toMatch(/^https:\/\//);
    expect(new Set(urls).size).toBe(urls.length);
  });
  it('出典がない項目は、「独自の設計」などの注記を必ず持つ（出典があるように見せない）', () => {
    for (const b of BASES.filter((x) => x.sources.length === 0)) expect(b.original, b.id).toBeTruthy();
  });
  it('アプリの主な計算（基礎代謝・ペース・たんぱく質・食品成分）に出典がある', () => {
    for (const id of ['bmr', 'cut', 'bulk', 'protein', 'food']) expect(BASES.find((b) => b.id === id)?.sources.length, id).toBeGreaterThan(0);
  });
  it('id が重複しない・免責がある', () => {
    expect(new Set(BASES.map((b) => b.id)).size).toBe(BASES.length);
    expect(DISCLAIMER).toContain('医療的な助言');
  });
});
