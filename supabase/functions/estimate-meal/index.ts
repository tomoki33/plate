// AI食事推定：写真・文章 →（食品名・g）のJSON。PFCはアプリが成分表から計算する。
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
        properties: { name: { type: 'string' }, grams: { type: 'number' } },
        required: ['name', 'grams'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

// PFC は AI に出させない。食品ごとの名前と重さだけを返させ、アプリ側で日本食品標準成分表（八訂）の値から計算する。
const SYSTEM = `あなたは日本の食事を読み取る係です。ユーザーの写真や文章から、食べたものを1品ずつに分け、
それぞれの名前と重さ(g)をJSONで返します。
- 名前は、日本食品標準成分表（八訂）で探しやすい一般的な食品名にする（例：鶏むね肉、ごはん、味噌汁、鶏卵、納豆）。
- 重さ(g)は、写真や文章から見積もる。量が分からないものは、一般的な1食分を仮定する。「2個」「1杯」などはgに換算する。
- ユーザーが「ひとこと」で補足したとき（例：米は半分残した）は、それを量に反映する。
- 食べ物でないもの、判断できないものは items に含めない。
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
  let image = '';
  let mediaType = 'image/jpeg';
  try {
    const body = await req.json();
    text = String(body.text ?? '').trim();
    image = typeof body.image_base64 === 'string' ? body.image_base64 : '';
    if (typeof body.media_type === 'string' && /^image\/(jpeg|png|webp)$/.test(body.media_type)) mediaType = body.media_type;
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (text.length > 400) return json({ error: 'text must be at most 400 chars' }, 400);
  if (!text && !image) return json({ error: 'text or image is required' }, 400);
  if (image.length > 6_000_000) return json({ error: 'image too large' }, 413);

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
      messages: [
        {
          role: 'user',
          content: [
            ...(image ? [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: image } }] : []),
            { type: 'text', text: text ? (image ? `ひとこと：${text}` : text) : 'この写真に写っている食事を読み取ってください。' },
          ],
        },
      ],
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
      (i: Record<string, unknown>) => typeof i.name === 'string' && typeof i.grams === 'number' && Number.isFinite(i.grams) && (i.grams as number) > 0 && (i.grams as number) <= 3000,
    );
    return json({ items });
  } catch {
    return json({ error: 'invalid model output' }, 502);
  }
});
