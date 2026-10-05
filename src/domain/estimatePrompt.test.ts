import { describe, expect, it } from 'vitest';
import { buildSystem } from '../../supabase/functions/estimate-meal/prompt';
import catalog from '../../supabase/functions/estimate-meal/catalog.json';
import cases from '../../eval/prompt-cases.json';

const keys = new Set((catalog as [string, string][]).map(([k]) => k));

describe('estimate-meal の指示文', () => {
  const p = buildSystem('chicken_breast_skinless: 鶏むね肉（皮なし）');
  it('カタログ一覧を末尾に差し込む', () => {
    expect(p.endsWith('chicken_breast_skinless: 鶏むね肉（皮なし）')).toBe(true);
  });
  it('「同じものだけ」「迷ったら null」「料理は1品」の基準を含む', () => {
    expect(p).toContain('迷ったら null');
    expect(p).toContain('料理を材料に分解しない');
    expect(p).toContain('タンドリーチキン');
    expect(p).toContain('カタログにその料理そのものがあれば');
    expect(p).toContain('カタログにその料理そのものがあれば');
  });
  it('評価データの正解 key はすべてカタログにある', () => {
    for (const c of cases.cases as { keys: (string | null)[] }[]) for (const k of c.keys) if (k) expect(keys.has(k)).toBe(true);
  });
});
