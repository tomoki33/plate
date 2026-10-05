-- AI入力の全体の1日上限（全ユーザー合計）。Gemini の費用に天井を作る（個人の上限は consume_ai_quota）
create table if not exists public.ai_usage_global (
  day date primary key,
  count int not null default 0
);
alter table public.ai_usage_global enable row level security;

-- 全体の回数を増やして、上限を超えていたら false を返す（Edge Function が service role で呼ぶ）
create or replace function public.consume_ai_global_quota(p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  insert into public.ai_usage_global (day, count) values ((now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (day) do update set count = public.ai_usage_global.count + 1
  returning count into c;
  return c <= p_limit;
end;
$$;
revoke all on function public.consume_ai_global_quota(int) from public, anon, authenticated;
