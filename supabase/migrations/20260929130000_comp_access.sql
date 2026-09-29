-- 課金なしで使える利用者（友人・テスター）の許可リスト。
-- 書き込みは管理者（service role）だけ。利用者は、自分の行だけ読める。
create table if not exists public.comp_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  paid boolean not null default true,       -- 買い切り相当（すべての機能）
  ai_plus boolean not null default false,   -- AIプラス相当（AI入力 1日30回）
  note text,
  created_at timestamptz not null default now()
);
alter table public.comp_access enable row level security;
create policy "comp_access_select_own" on public.comp_access for select to authenticated using (user_id = (select auth.uid()));
