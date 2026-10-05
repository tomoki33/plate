import { BLEND_NEW, MAX_STEP } from '../src/domain/nutrition';
import { backtest, DEFAULT_SEEDS, SCENARIOS, type Metrics } from '../src/domain/tdeeBacktest';

/**
 * 維持カロリー補正のバックテスト（合成データ。個人の記録は使わない）。  npm run backtest:tdee [-- オプション]
 *   --seeds <n>   乱数の種の数（既定 30。同じ数なら同じ結果）
 *   --grid        新しい値の重み × 1回の上限 を総当たりで比べる
 *   --json        JSON で出す
 */
const args = process.argv.slice(2);
const json = args.includes('--json');
const rawSeeds = args.indexOf('--seeds') >= 0 ? Number(args[args.indexOf('--seeds') + 1]) : DEFAULT_SEEDS.length;
if (!Number.isInteger(rawSeeds) || rawSeeds < 1) {
  console.error('--seeds には 1 以上の整数を指定してください');
  process.exit(2);
}
const seeds = Array.from({ length: rawSeeds }, (_, i) => i + 1);

const f = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const row = (label: string, m: Metrics) => `  ${label.padEnd(18, '　')} 予測誤差 ${f(m.maeKg)}kg  偏り ${f(m.biasKg)}kg  TDEE誤差 ${f(m.tdeeMae, 0)}kcal  揺れ ${f(m.jitter, 0)}kcal  (n=${m.n})`;

const out: Record<string, unknown> = {};
const lines: string[] = [];
lines.push(`現在の係数: 新しい値の重み ${BLEND_NEW}、1回の上限 ±${MAX_STEP * 100}%  / 種 ${seeds.length} 個\n`);
lines.push('予測誤差 = 次の14日の体重変化の、予測と実測（7日平均）の差の平均の大きさ。偏り = 予測 − 実測 の平均。\n');

const scenarios: Record<string, unknown> = {};
for (const sc of SCENARIOS) {
  const none = backtest(sc, null, seeds);
  const cur = backtest(sc, {}, seeds);
  scenarios[sc.name] = { none, current: cur };
  lines.push(sc.name);
  lines.push(row('補正なし', none));
  lines.push(row('補正あり（現在）', cur));
  lines.push('');
}
out.scenarios = scenarios;

if (args.includes('--grid')) {
  const blends = [0.1, 0.2, 0.3, 0.4, 0.5];
  const steps = [0.05, 0.1, 0.15, 0.25];
  const grid: unknown[] = [];
  lines.push('係数の総当たり（全シナリオの平均）');
  lines.push('  重み  上限   予測誤差  TDEE誤差  揺れ');
  for (const blendNew of blends) {
    for (const maxStep of steps) {
      const ms = SCENARIOS.map((sc) => backtest(sc, { blendNew, maxStep }, seeds));
      const avg = (k: keyof Metrics) => ms.reduce((a, m) => a + m[k], 0) / ms.length;
      const g = { blendNew, maxStep, maeKg: avg('maeKg'), tdeeMae: avg('tdeeMae'), jitter: avg('jitter') };
      grid.push(g);
      const mark = blendNew === BLEND_NEW && maxStep === MAX_STEP ? ' ← 現在' : '';
      lines.push(`  ${f(blendNew, 1)}  ${f(maxStep * 100, 0).padStart(3)}%  ${f(g.maeKg).padStart(6)}kg  ${f(g.tdeeMae, 0).padStart(6)}kcal  ${f(g.jitter, 0).padStart(4)}kcal${mark}`);
    }
  }
  out.grid = grid;
}

if (json) console.log(JSON.stringify(out, null, 2));
else console.log(lines.join('\n'));
