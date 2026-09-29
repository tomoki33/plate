-- バックアップ（端末のSQLiteの全記録を1行のJSONで持つ）と、AI入力の回数制限
create table if not exists public.backups (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.backups enable row level security;

-- 本人の行だけ読み書きできる
create policy "own backup select" on public.backups for select using (auth.uid() = user_id);
create policy "own backup insert" on public.backups for insert with check (auth.uid() = user_id);
create policy "own backup update" on public.backups for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own backup delete" on public.backups for delete using (auth.uid() = user_id);

-- AI入力の1日の回数（Edge Function が service role で増やす）。クライアントからは触れない
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;

-- 回数を増やして、上限を超えていたら false を返す（競合しないよう1文で）
create or replace function public.consume_ai_quota(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c int;
begin
  insert into public.ai_usage (user_id, day, count) values (p_user, (now() at time zone 'Asia/Tokyo')::date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into c;
  return c <= p_limit;
end;
$$;
revoke all on function public.consume_ai_quota(uuid, int) from public, anon, authenticated;
