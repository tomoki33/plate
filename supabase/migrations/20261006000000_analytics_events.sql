-- 計測イベント（任意の同意をしたユーザーの端末からだけ届く。issue #23）
-- 送るのは、端末ごとのランダムなID（アカウント・メール・Apple のIDとは無関係）、イベント名、短い数値／種類だけ。
-- 記録の中身（食事・体重・写真・プロフィール）は入れない。入れられないよう、列と中身を制限している。
-- 'YYYY-MM-DD' として実在する日付か（集計の ::date で失敗する行を入れさせない）
create or replace function public.analytics_is_date(t text)
returns boolean
language plpgsql
immutable
as $$
begin
  return t ~ '^\d{4}-\d{2}-\d{2}$' and t::date is not null;
exception when others then
  return false;
end;
$$;

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  install_id uuid not null,
  name text not null check (name in ('app_open', 'day_logged', 'trial_started', 'purchased', 'first_training_completed')),
  props jsonb not null default '{}'::jsonb,
  -- イベントごとに、許すキーと値の型・形・範囲を決める（アプリを経由せず直接送られても、これ以外は入らない）
  constraint analytics_events_props_valid check (
    jsonb_typeof(props) = 'object' and (
      (name in ('app_open', 'first_training_completed')
        and props ? 'daysSinceInstall' and (props - 'daysSinceInstall') = '{}'::jsonb
        and jsonb_typeof(props->'daysSinceInstall') = 'number' and (props->>'daysSinceInstall') ~ '^\d{1,4}$')
      or (name = 'day_logged'
        and props ?& array['date', 'kind'] and (props - 'date' - 'kind') = '{}'::jsonb
        and jsonb_typeof(props->'date') = 'string' and public.analytics_is_date(props->>'date')
        and props->>'kind' in ('set', 'search', 'rough', 'text', 'photo'))
      or (name = 'trial_started' and props = '{}'::jsonb)
      or (name = 'purchased'
        and props ? 'product' and (props - 'product') = '{}'::jsonb
        and props->>'product' in ('full', 'ai_plus'))
    )
  )
);
create index if not exists analytics_events_name_created on public.analytics_events (name, created_at);

alter table public.analytics_events enable row level security;

-- アプリ（anon キー）は「追加だけ」できる。読み取り・更新・削除はできない（集計は管理画面の SQL Editor から）
revoke all on public.analytics_events from anon, authenticated;
grant insert (install_id, name, props) on public.analytics_events to anon, authenticated;
create policy analytics_events_insert on public.analytics_events for insert to anon, authenticated with check (true);
