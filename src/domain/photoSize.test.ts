import { describe, expect, it } from 'vitest';
import { PHOTO_MAX_EDGE, resizeTarget } from './photoSize';

describe('resizeTarget', () => {
  it('長辺が上限以下なら縮小しない', () => {
    expect(resizeTarget(800, 600)).toBeNull();
    expect(resizeTarget(PHOTO_MAX_EDGE, 100)).toBeNull();
  });
  it('横長は幅を上限に合わせ、縦横比を保つ', () => {
    expect(resizeTarget(4000, 3000)).toEqual({ width: 1280, height: 960 });
  });
  it('縦長は高さを上限に合わせる', () => {
    expect(resizeTarget(3024, 4032)).toEqual({ width: 960, height: 1280 });
  });
  it('不正なサイズは縮小しない', () => {
    expect(resizeTarget(0, 4000)).toBeNull();
    expect(resizeTarget(NaN, 4000)).toBeNull();
  });
});
