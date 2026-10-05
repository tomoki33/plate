import { readFileSync, writeFileSync } from 'node:fs';
import { buildSystem } from '../supabase/functions/estimate-meal/prompt';

/**
 * AI の指示文を、実際に Gemini へ送って測る。  GEMINI_API_KEY=... npm run eval:prompt [-- オプション]
 *   --save <file>     結果を保存する（指示文を変える前に取っておく）
 *   --compare <file>  保存した結果と比べる
 *   --runs <n>        1件あたりの回数（既定 3。多数決ではなく、正解になった割合を見る）
 * 食品名の命中率（npm run eval:foods）は端末側の検索だけを測る。こちらは指示文の効果を測る。
 */
type Case = { group: string; text: string; keys: (string | null)[] };
type Result = { rate: number; hits: number; total: number; cases: Record<string, number> };

const args = process.argv.slice(2);
const opt = (n: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const runs = Number(opt('--runs') ?? 3);
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY を環境変数に入れてください');
  process.exit(2);
}

const catalog = JSON.parse(readFileSync('supabase/functions/estimate-meal/catalog.json', 'utf8')) as [string, string][];
const keys = new Set(catalog.map(([k]) => k));
const system = buildSystem(catalog.map(([k, n]) => `${k}: ${n}`).join('\n'));
const { cases } = JSON.parse(readFileSync('eval/prompt-cases.json', 'utf8')) as { cases: Case[] };
const model = process.env.ESTIMATE_MODEL ?? 'gemini-flash-lite-latest';

// index.ts と同じスキーマ・設定
const SCHEMA = {
  type: 'object',
  properties: { items: { type: 'array', items: { type: 'object', properties: { key: { type: 'string', nullable: true }, name: { type: 'string' }, grams: { type: 'integer' }, kcal: { type: 'integer' }, protein: { type: 'integer' }, fat: { type: 'integer' }, carbs: { type: 'integer' } }, required: ['name', 'grams', 'key', 'kcal', 'protein', 'fat', 'carbs'] } } },
  required: ['items'],
};

async function ask(text: string): Promise<{ key: string | null; name: string }[]> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const body = await res.json();
  const raw = body.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => typeof p.text === 'string')?.text ?? '{"items":[]}';
  return ((JSON.parse(raw).items ?? []) as { key: string | null; name: string }[]).map((i) => ({ name: i.name, key: i.key && keys.has(i.key) ? i.key : null }));
}

const label = (c: Case) => `${c.group}: ${c.text}`;
// 返った品の key が、期待どおり（順不同・過不足なし）のときだけ正解。空の返答や余計な品は不正解
const pass = (c: Case, items: { key: string | null }[]) => {
  const a = items.map((i) => i.key ?? '').sort();
  const e = c.keys.map((k) => k ?? '').sort();
  return a.length === e.length && a.every((k, i) => k === e[i]);
};

const result: Result = { rate: 0, hits: 0, total: 0, cases: {} };
const byGroup: Record<string, [number, number]> = {};
for (const c of cases) {
  let ok = 0;
  const got = new Set<string>();
  for (let i = 0; i < runs; i++) {
    const items = await ask(c.text);
    if (pass(c, items)) ok++;
    else got.add(items.map((x) => `${x.name}[${x.key ?? '-'}]`).join(' + ') || '(なし)');
  }
  result.cases[label(c)] = ok / runs;
  result.hits += ok;
  result.total += runs;
  const g = (byGroup[c.group] ??= [0, 0]);
  g[0] += ok;
  g[1] += runs;
  if (ok < runs) console.log(`  ✗ ${label(c)}  ${ok}/${runs}  →  ${[...got].join(' ／ ')}`);
}
result.rate = result.hits / result.total;
console.log(`\n指示文の評価（${model}、各${runs}回）: ${(result.rate * 100).toFixed(1)}%  (${result.hits} / ${result.total})`);
for (const [g, [h, t]] of Object.entries(byGroup)) console.log(`  ${g.padEnd(8, '　')} ${h} / ${t}  ${((h / t) * 100).toFixed(1)}%`);

const cmp = opt('--compare');
if (cmp) {
  const before = JSON.parse(readFileSync(cmp, 'utf8')) as Result;
  console.log(`\n比較（${cmp}）: ${(before.rate * 100).toFixed(1)}%  →  ${(result.rate * 100).toFixed(1)}%`);
  for (const [k, v] of Object.entries(result.cases)) if (before.cases[k] !== undefined && before.cases[k] !== v) console.log(`  ${v > before.cases[k] ? '直った' : '悪化'}: ${k}  ${before.cases[k].toFixed(2)} → ${v.toFixed(2)}`);
}
const save = opt('--save');
if (save) writeFileSync(save, JSON.stringify(result, null, 2) + '\n');
