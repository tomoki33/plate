// アカウント削除（App Store 審査 5.1.1(v)：アプリ内でアカウントを削除できること）。
// ログイン中の本人のトークンを確かめて、その人の Supabase ユーザーを削除する。
// backups / ai_usage は auth.users への on delete cascade で一緒に消える。写真（Storage の meal-photos/<user_id>/）はここで消す。
//
// デプロイ: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  const url = Deno.env.get('SUPABASE_URL')!;
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // 写真（Storage）はユーザーの削除では消えないので、先に消す
  const folder = data.user.id;
  for (;;) {
    const { data: files } = await admin.storage.from('meal-photos').list(folder, { limit: 1000 });
    if (!files?.length) break;
    await admin.storage.from('meal-photos').remove(files.map((f) => `${folder}/${f.name}`));
  }
  const { error: delErr } = await admin.auth.admin.deleteUser(data.user.id);
  if (delErr) return json({ error: delErr.message }, 500);
  return json({ ok: true });
});
