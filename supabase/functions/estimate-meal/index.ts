// AI食事推定：文章 →（食品名・g・kcal・P・F・C）のJSON。
// APIキーは端末に置かず、ここ（Supabase Edge Function）だけが持つ。
//
// デプロイ:
//   supabase secrets set ANTHROPIC_API_KEY=... 
//   supabase functions deploy estimate-meal
// アプリ側: EXPO_PUBLIC_AI_ENDPOINT=https://<project>.supabase.co/functions/v1/estimate-meal
//
// 1日の回数上限は、サーバー側でも最大値（有料の30回）で止める。無料の3回は端末側で数える
// （無料／有料をサーバーで判定するには RevenueCat の webhook で権利を保存する必要がある。未対応）。
import { createClient } from 'jsr:@supabase/supabase-js@2';

const DAILY_LIMIT = 30;
const MODEL = Deno.env.get('ESTIMATE_MODEL') ?? 'claude-haiku-4-5';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          p: { type: 'number' },
          f: { type: 'number' },
          c: { type: 'number' },
        },
        required: ['name', 'grams', 'kcal', 'p', 'f', 'c'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const SYSTEM = `あなたは日本の食事の栄養を推定する係です。ユーザーの文章から、食べたものを1品ずつに分け、
それぞれの重さ(g)と、その重さ全体のエネルギー(kcal)・たんぱく質(g)・脂質(g)・炭水化物(g)を推定してJSONで返します。
- 数値は日本食品標準成分表（八訂）に近い値にする。量が書かれていなければ、一般的な1食分を仮定する。
- 「2個」「1杯」などは、一般的な重さに換算してgにする。
- 食べ物でない文章や、判断できない語は items に含めない。
- 説明文は書かず、指定のJSONだけを返す。`;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return json({ error: 'unauthorized' }, 401);

  let text = '';
  try {
    text = String((await req.json()).text ?? '').trim();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!text || text.length > 400) return json({ error: 'text must be 1-400 chars' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: ok, error: qerr } = await admin.rpc('consume_ai_quota', { p_user: u.user.id, p_limit: DAILY_LIMIT });
  if (qerr) return json({ error: 'quota check failed' }, 500);
  if (!ok) return json({ error: 'daily limit reached' }, 429);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    }),
  });
  if (!res.ok) return json({ error: 'upstream error', status: res.status }, 502);
  const body = await res.json();
  if (body.stop_reason === 'refusal') return json({ items: [] });
  const raw = body.content?.find((b: { type: string }) => b.type === 'text')?.text ?? '';
  try {
    const parsed = JSON.parse(raw);
    // 値の妥当性を確認してから返す（極端な値は捨てる）
    const items = (parsed.items ?? []).filter(
      (i: Record<string, unknown>) => typeof i.name === 'string' && [i.grams, i.kcal, i.p, i.f, i.c].every((n) => typeof n === 'number' && Number.isFinite(n) && (n as number) >= 0) && (i.grams as number) > 0 && (i.grams as number) <= 3000 && (i.kcal as number) <= 5000,
    );
    return json({ items });
  } catch {
    return json({ error: 'invalid model output' }, 502);
  }
});
