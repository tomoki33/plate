import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkBundle, problems } from './bundleCheck';

/**
 * 本番の JS バンドルに、開発用・コーチ機能の文字が混ざっていないか検査する。  npm run check:bundle [-- --dir <書き出し済みの場所>]
 * 本番ビルドと同じ条件（NODE_ENV=production・.env なし・EXPO_PUBLIC_COACH_MODE なし）で、
 * Hermes のバイトコードにせず JS のまま書き出して、文字列を探す。
 */
const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
let outDir = dirIdx >= 0 ? args[dirIdx + 1] : undefined;
const temp = outDir === undefined;

if (temp) {
  outDir = mkdtempSync(join(tmpdir(), 'plate-bundle-'));
  const env = { ...process.env, NODE_ENV: 'production', EXPO_NO_DOTENV: '1', CI: '1' } as NodeJS.ProcessEnv;
  delete env.EXPO_PUBLIC_COACH_MODE;
  delete env.EXPO_PUBLIC_AUTO_SAMPLE;
  const r = spawnSync('npx', ['expo', 'export', '--platform', 'ios', '--no-bytecode', '--output-dir', outDir], {
    env,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (r.status !== 0) {
    rmSync(outDir, { recursive: true, force: true });
    console.error('expo export に失敗した');
    process.exit(1);
  }
}

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

try {
  const files = jsFiles(outDir!);
  if (files.length === 0) {
    console.error('書き出した JS が見つからない');
    process.exit(1);
  }
  const js = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const ps = problems(checkBundle(js));
  if (ps.length > 0) {
    for (const p of ps) console.error(`NG: ${p}`);
    process.exit(1);
  }
  console.log(`OK: 本番バンドル（${files.length} ファイル・${(js.length / 1e6).toFixed(1)}MB）に、禁止の文字はない`);
} finally {
  if (temp) rmSync(outDir!, { recursive: true, force: true });
}
