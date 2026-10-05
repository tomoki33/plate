import { readFileSync } from 'node:fs';
import { buildSystem } from '../supabase/functions/estimate-meal/prompt';

/**
 * AI のモデルを、同じ評価セット（eval/prompt-cases.json）で比べる。費用が出る。
 *   GEMINI_API_KEY=... npm run eval:models -- [--models a,b,c] [--runs 2] [--max-calls 300] [--delay-ms 0] [--dry-run]
 * 1 回の実行で送る API 呼び出しは --max-calls が上限（既定 300，再試行も数える）。超える組み合わせは、1 件も送らずに止まる。
 * 表示するのは集計だけ（正答率・平均の遅さ・トークン・1 回あたりの費用）。モデルの生の返答は保存しない。
 * 単価は USD / 100 万トークン（ai.google.dev/gemini-api/docs/pricing、2026-10-06 時点）。思考トークンは出力に含まれる。
 */
type Case = { group: string; text: string; keys: (string | null)[] };
const PRICE: Record<string, [number, number]> = {
  'gemini-flash-lite-latest': [0.3, 2.5], // 現行。2026-10 時点は gemini-3.5-flash-lite を指す（返答の modelVersion で確認）
  'gemini-2.5-flash-lite': [0.1, 0.4],
  'gemini-3.8-flash': [0.75, 3.75],
  'gemini-3.5-flash': [1.5, 9],
  'gemini-3.1-pro-preview': [2, 12],
};

const args = process.argv.slice(2);
const opt = (n: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const models = (opt('--models') ?? 'gemini-flash-lite-latest,gemini-3.8-flash,gemini-3.5-flash').split(',');
const runs = Number(opt('--runs') ?? 2);
const maxCalls = Number(opt('--max-calls') ?? 300);
const delayMs = Number(opt('--delay-ms') ?? 0);
for (const [name, v, min] of [['--runs', runs, 1], ['--max-calls', maxCalls, 1], ['--delay-ms', delayMs, 0]] as const) {
  if (!Number.isInteger(v) || v < min) {
    console.error(`${name} は ${min} 以上の整数にしてください`);
    process.exit(2);
  }
}
 // 無料枠など、1 分あたりの回数に制限があるときに間隔を空ける
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && !args.includes('--dry-run')) {
  console.error('GEMINI_API_KEY を環境変数に入れてください');
  process.exit(2);
}

const catalog = JSON.parse(readFileSync('supabase/functions/estimate-meal/catalog.json', 'utf8')) as [string, string][];
const keys = new Set(catalog.map(([k]) => k));
const system = buildSystem(catalog.map(([k, n]) => `${k}: ${n}`).join('\n'));
const { cases } = JSON.parse(readFileSync('eval/prompt-cases.json', 'utf8')) as { cases: Case[] };

const planned = models.length * cases.length * runs;
// 一時的な失敗（429・503）は最大 2 回まで再試行する。再試行も上限に数える。planned は再試行ぶんの余裕を見込まない
console.log(`モデル ${models.length} × 評価 ${cases.length} 件 × ${runs} 回 = ${planned} 回の呼び出し（上限 ${maxCalls}）`);
const unknown = models.filter((m) => !PRICE[m]);
if (unknown.length) {
  console.error(`単価が未登録のモデル: ${unknown.join(', ')}`);
  process.exit(2);
}
if (planned > maxCalls) {
  console.error('上限を超えるので 1 回も送らずに止めます。--runs か --models を減らすか、--max-calls を上げてください');
  process.exit(2);
}
if (args.includes('--dry-run')) process.exit(0);

// index.ts と同じスキーマ・設定
const SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string', nullable: true }, name: { type: 'string' }, grams: { type: 'integer' }, kcal: { type: 'integer' }, protein: { type: 'integer' }, fat: { type: 'integer' }, carbs: { type: 'integer' } }, required: ['name', 'grams', 'key', 'kcal', 'protein', 'fat', 'carbs'] } } },
  required: ['items'],
};

let calls = 0;
const status: Record<string, number> = {};
async function ask(model: string, text: string) {
  let firstFailed = false;
  for (let attempt = 0; ; attempt++) {
    if (++calls > maxCalls) throw new Error('call cap reached');
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const t0 = Date.now(); // 間隔を空ける待ちは含めない。成功した 1 回の通信だけを測る
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
      }),
    }).catch(() => null);
    const st = res ? res.status : 0;
    if (!res || !res.ok) firstFailed ||= attempt === 0;
    if ((st === 429 || st === 503 || st === 0) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    const ms = Date.now() - t0;
    if (!res || !res.ok) {
      status[`${model}:${st}`] = (status[`${model}:${st}`] ?? 0) + 1;
      return { items: null as { key: string | null }[] | null, ms, inTok: 0, outTok: 0, version: '', firstFailed };
    }
    const body = await res.json();
    const raw = body.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => typeof p.text === 'string')?.text ?? '{"items":[]}';
    let items: { key: string | null }[] = [];
    try {
      items = ((JSON.parse(raw).items ?? []) as { key: string | null }[]).map((i) => ({ key: i.key && keys.has(i.key) ? i.key : null }));
    } catch {
      // 壊れた JSON は空＝不正解として数える
    }
    const u = body.usageMetadata ?? {};
    return { items, ms, inTok: u.promptTokenCount ?? 0, outTok: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), version: String(body.modelVersion ?? ''), firstFailed };
  }
}

const pass = (c: Case, items: { key: string | null }[]) => {
  const a = items.map((i) => i.key ?? '').sort();
  const e = c.keys.map((k) => k ?? '').sort();
  return a.length === e.length && a.every((k, i) => k === e[i]);
};

async function main() {
  const rows: string[] = [];
  for (const model of models) {
    let ok = 0, n = 0, errors = 0, firstFails = 0, ms = 0, inTok = 0, outTok = 0, version = '';
    const group: Record<string, [number, number]> = {};
    for (const c of cases) {
      for (let r = 0; r < runs; r++) {
        if (n >= 6 && errors === n) break; // 最初の 6 回がすべて失敗したモデルは、残りを送らずに打ち切る（費用と時間の節約）
        const a = await ask(model, c.text);
        n++;
        if (a.firstFailed) firstFails++;
        if (a.items) ms += a.ms;
      inTok += a.inTok; outTok += a.outTok; version = a.version || version;
        const g = (group[c.group] ??= [0, 0]);
        g[1]++;
        if (!a.items) errors++;
        else if (pass(c, a.items)) { ok++; g[0]++; }
      }
    }
    const [pi, po] = PRICE[model];
    const okN = n - errors;
    const cost = okN ? (inTok * pi + outTok * po) / 1e6 / okN : 0;
    const gs = Object.entries(group).map(([k, [h, t]]) => `${k} ${h}/${t}`).join('、');
    const row = `| ${model}${version && version !== model ? `（${version}）` : ''} | ${((ok / n) * 100).toFixed(1)}% (${ok}/${n}) | ${gs} | ${errors} | ${((firstFails / n) * 100).toFixed(1)}% | ${(ms / Math.max(okN, 1) / 1000).toFixed(1)} 秒 | ${Math.round(inTok / Math.max(okN, 1))} / ${Math.round(outTok / Math.max(okN, 1))} | $${cost.toFixed(5)} | $${(cost * 1000).toFixed(2)} |`;
    rows.push(row);
    console.error(`完了: ${row}`); // 途中で止まっても、終わったモデルの結果は残る
  }
  console.log('\n| モデル | 正答率 | グループ別 | 最終エラー | 初回失敗率（429・503・通信） | 平均の遅さ | 入力 / 出力トークン（1 回） | 1 回の費用 | 1000 回の費用 |\n|---|---|---|---|---|---|---|---|---|');
  console.log(rows.join('\n'));
  console.log(`\n実際の呼び出し: ${calls} 回（再試行を含む）`);
  if (Object.keys(status).length) console.log(`エラーの内訳（HTTP ステータス）: ${JSON.stringify(status)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
