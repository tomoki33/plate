import { readFileSync, writeFileSync } from 'node:fs';
import { compareSnapshots, pct, runEval, toSnapshot, type EvalCase, type Snapshot } from '../src/domain/foodEval';

/**
 * 食品名の命中率を測る。  npm run eval:foods [-- オプション]
 *   --save <file>     結果を保存する（変更前に取っておく）
 *   --compare <file>  保存した結果と比べる（変更後）。命中が減った名前を出す
 *   --min <0-1>       命中率がこれ未満なら終了コード 1
 *   --data <file>     評価リスト（既定 eval/foods.json）
 *   --json            JSON で出す
 */
const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const dataPath = opt('--data') ?? 'eval/foods.json';
const { cases } = JSON.parse(readFileSync(dataPath, 'utf8')) as { cases: EvalCase[] };

const report = runEval(cases);
const savePath = opt('--save');
const comparePath = opt('--compare');
const json = args.includes('--json');
// --json のときは stdout を JSON だけにする（補足の出力は stderr へ）
const note = json ? console.error : console.log;

let min: number | undefined;
if (args.includes('--min')) {
  const raw = opt('--min');
  min = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(min) || min < 0 || min > 1) {
    console.error(`--min には 0 から 1 の数を指定してください（受け取った値: ${raw ?? '(なし)'}）`);
    process.exit(2);
  }
}

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`食品名の命中率: ${pct(report.rate)}  (${report.hits} / ${report.total})  [${dataPath}]\n`);
  console.log('区分ごと');
  for (const [g, v] of Object.entries(report.byGroup)) console.log(`  ${g.padEnd(12, '　')} ${String(v.hits).padStart(3)} / ${String(v.total).padEnd(3)} ${pct(v.hits / v.total)}`);
  const misses = report.rows.filter((r) => !r.hit);
  console.log(`\n外れた名前（${misses.length} 件）`);
  for (const r of misses) console.log(`  ✗ ${r.query}  →  ${r.got ?? '(見つからない)'}   期待: ${r.accept.length ? r.accept.join(" | ") : "(なし)"}`);
}

if (comparePath) {
  const before = JSON.parse(readFileSync(comparePath, 'utf8')) as Snapshot;
  const d = compareSnapshots(before, report);
  const delta = (report.rate - before.rate) * 100;
  note(`\n比較（${comparePath}）`);
  note(`  ${pct(before.rate)} (${before.hits}/${before.total})  →  ${pct(report.rate)} (${report.hits}/${report.total})   ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} pt`);
  note(`  直った ${d.fixed.length} 件${d.fixed.length ? ': ' + d.fixed.join('、') : ''}`);
  note(`  悪化した ${d.broken.length} 件${d.broken.length ? ': ' + d.broken.join('、') : ''}`);
}

if (savePath) {
  writeFileSync(savePath, JSON.stringify(toSnapshot(report), null, 2) + '\n');
  note(`\n保存しました: ${savePath}`);
}

if (min !== undefined && report.rate < min) {
  console.error(`\n命中率 ${pct(report.rate)} が下限 ${pct(min)} を下回りました`);
  process.exit(1);
}
