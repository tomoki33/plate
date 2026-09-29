import { describe, expect, it } from 'vitest';
import { backupFoods } from './backupFoods';

describe('バックアップに入れる食品', () => {
  it('自作とAIだけ。成分表・カタログは入れない（復元で id が重なって失敗するため）', () => {
    const rows = [{ id: 'a', source: '成分表' }, { id: 'b', source: 'カタログ' }, { id: 'c', source: '自作' }, { id: 'd', source: 'AI' }];
    expect(backupFoods(rows).map((r) => r.id)).toEqual(['c', 'd']);
  });
  it('古いバックアップにカタログが入っていても、読み飛ばせる', () => {
    expect(backupFoods([{ source: 'カタログ' }, { source: 'カタログ' }])).toEqual([]);
  });
});
