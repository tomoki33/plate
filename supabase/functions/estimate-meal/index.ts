// AI食事推定：写真・文章 →（食品名・g）のJSON。PFCはアプリが成分表から計算する。
// APIキーは端末に置かず、ここ（Supabase Edge Function）だけが持つ。
//
// デプロイ:
//   supabase secrets set GEMINI_API_KEY=...
//   supabase functions deploy estimate-meal
// アプリ側: EXPO_PUBLIC_AI_ENDPOINT=https://<project>.supabase.co/functions/v1/estimate-meal
//
// 1日の回数上限は、サーバー側でも最大値（有料の30回）で止める。無料の3回は端末側で数える
// （無料／有料をサーバーで判定するには RevenueCat の webhook で権利を保存する必要がある。未対応）。
import { createClient } from 'jsr:@supabase/supabase-js@2';
import catalog from './catalog.json' with { type: 'json' };
import { buildSystem } from './prompt.ts';

const DAILY_LIMIT = 30;
// 全ユーザー合計の1日上限。Gemini の費用の天井（1回 ≒ 1円未満）。Google Cloud の予算アラートと二段構えにする。
// 変更は secrets の GLOBAL_DAILY_LIMIT（再デプロイ不要）。
const GLOBAL_DAILY_LIMIT = Number(Deno.env.get('GLOBAL_DAILY_LIMIT') ?? '3000');
const MODEL = Deno.env.get('ESTIMATE_MODEL') ?? 'gemini-flash-lite-latest';

// 食品カタログ（scripts/build-catalog.py が生成）。AIには一覧から選ばせ、値はアプリ側のカタログ／成分表から引く。
const CATALOG = catalog as [string, string][];
const CATALOG_KEYS = new Set(CATALOG.map(([k]) => k));
const CATALOG_LIST = CATALOG.map(([k, n]) => `${k}: ${n}`).join('\n');

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', nullable: true },
          name: { type: 'string' },
          grams: { type: 'integer' },
          kcal: { type: 'integer' },
          protein: { type: 'integer' },
          fat: { type: 'integer' },
          carbs: { type: 'integer' },
        },
        required: ['name', 'grams', 'key', 'kcal', 'protein', 'fat', 'carbs'],
      },
    },
  },
  required: ['items'],
};

const SYSTEM = buildSystem(CATALOG_LIST);

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
  // 全体の上限。確認に失敗したときは止めず（マイグレーション未適用でも動かす）、ログだけ残す。予算アラートが最後の砦
  const { data: gok, error: gerr } = await admin.rpc('consume_ai_global_quota', { p_limit: GLOBAL_DAILY_LIMIT });
  if (gerr) console.error('global quota check failed', gerr.message);
  else if (!gok) return json({ error: 'service busy' }, 503);

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [
        {
          role: 'user',
          parts: [
            ...(image ? [{ inlineData: { mimeType: mediaType, data: image } }] : []),
            { text: text ? (image ? `ひとこと：${text}` : text) : 'この写真に写っている食事を読み取ってください。' },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2, responseMimeType: 'application/json', responseSchema: SCHEMA },
    }),
  });
  if (!res.ok) return json({ error: 'upstream error', status: res.status }, 502);
  const body = await res.json();
  const raw = body.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => typeof p.text === 'string')?.text ?? '';
  if (!raw) return json({ items: [] }); // 安全性フィルタなどで本文が無いとき
  try {
    const parsed = JSON.parse(raw);
    // 値の妥当性を確認してから返す（極端な値は捨てる）
    const ok = (v: unknown, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
    const items = (parsed.items ?? [])
      .filter((i: Record<string, unknown>) => typeof i.name === 'string' && ok(i.grams, 3000) && (i.grams as number) > 0)
      .map((i: Record<string, unknown>) => ({
        name: i.name,
        grams: i.grams,
        // カタログに無い key は捨てる。値は key が無いときだけ、妥当な範囲のものを通す
        key: typeof i.key === 'string' && CATALOG_KEYS.has(i.key) ? i.key : null,
        ...(typeof i.key === 'string' && CATALOG_KEYS.has(i.key)
          ? {}
          : ok(i.kcal, 950) && ok(i.protein, 100) && ok(i.fat, 100) && ok(i.carbs, 100)
            ? { kcal: i.kcal, protein: i.protein, fat: i.fat, carbs: i.carbs }
            : {}),
      }));
    return json({ items });
  } catch {
    console.error('invalid model output', body.candidates?.[0]?.finishReason, raw.slice(0, 300));
    return json({ error: 'invalid model output' }, 502);
  }
});
