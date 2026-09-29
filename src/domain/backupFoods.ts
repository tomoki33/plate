/**
 * バックアップに入れる（戻す）食品：自作とAIだけ。
 * 成分表・カタログはアプリに同梱されていて、復元では消えないので、入れると id が重なって復元に失敗する。
 */
export const backupFoods = <T extends { source: string }>(foods: T[]): T[] => foods.filter((f) => f.source === '自作' || f.source === 'AI');
