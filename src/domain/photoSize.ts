/** AIに送る写真の長辺（px）。食事の判別には十分で、base64 でも数百KBに収まる */
export const PHOTO_MAX_EDGE = 1280;

/** 長辺が上限を超えるときだけ、縦横比を保った縮小後のサイズを返す（超えないなら null＝縮小しない） */
export function resizeTarget(width: number, height: number, maxEdge = PHOTO_MAX_EDGE): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0) || Math.max(width, height) <= maxEdge) return null;
  const scale = maxEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
