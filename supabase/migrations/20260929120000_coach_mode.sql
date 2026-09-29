-- コーチモード（README_coach_mode.md）
-- 生徒の記録は端末が正。コーチに見せる分だけを coach_shares に「スナップショット」として置く。
-- 書き込みはすべて関数（RPC）経由。コーチは、有効な接続先の共有分しか読めない。

create table if not exists public.coaches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  student_name text not null default '',
  -- active：共有中、paused：生徒が「ひとりで」に切り替えた間、revoked：解除
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  share_meals boolean not null default true,
  share_weight boolean not null default true,
  share_training boolean not null default true,
  manages_goals boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, user_id)
);
-- 生徒が同時につなげるコーチは1人
create unique index if not exists coach_links_one_live on public.coach_links (user_id) where status in ('active', 'paused');
create index if not exists coach_links_coach_idx on public.coach_links (coach_id) where status in ('active', 'paused');

create table if not exists public.coach_shares (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- 目標プランは上書きせず履歴として残す（effective_from が新しく、今日以前のものを使う）
create table if not exists public.goal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  coach_id uuid not null references public.coaches (id) on delete cascade,
  target_weight numeric(4, 1) not null check (target_weight between 30 and 200),
  pace_per_week numeric(3, 2) not null check (pace_per_week between -1.5 and 1.5),
  protein_g int not null check (protein_g between 40 and 400),
  fat_pct int not null check (fat_pct between 10 and 40),
  menus jsonb not null default '[]',
  effective_from date not null,
  created_at timestamptz not null default now()
);
create index if not exists goal_plans_user_idx on public.goal_plans (user_id, effective_from desc, created_at desc);

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (coach_id, user_id, week_start)
);
create index if not exists coach_notes_user_idx on public.coach_notes (user_id, week_start desc);

create table if not exists public.coach_menus (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  default_day_type text not null default 'normal' check (default_day_type in ('high', 'normal', 'off')),
  exercises jsonb not null default '[]',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists coach_menus_coach_idx on public.coach_menus (coach_id, sort_order);

-- 招待コードの総当たり対策
create table if not exists public.invite_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now(),
  ok boolean not null
);
create index if not exists invite_attempts_idx on public.invite_attempts (user_id, at desc);

alter table public.coaches enable row level security;
alter table public.coach_links enable row level security;
alter table public.coach_shares enable row level security;
alter table public.goal_plans enable row level security;
alter table public.coach_notes enable row level security;
alter table public.coach_menus enable row level security;
alter table public.invite_attempts enable row level security;

create or replace function public.is_my_coach_id(p_coach uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.coaches where id = p_coach and user_id = (select auth.uid()));
$$;

-- coaches：自分の行だけ読める・名前を直せる（作成は create_coach）
create policy "coaches_select_own" on public.coaches for select to authenticated using (user_id = (select auth.uid()));
create policy "coaches_update_own" on public.coaches for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- coach_links：当事者だけ読める（書き込みは関数）
create policy "coach_links_select" on public.coach_links for select to authenticated using (user_id = (select auth.uid()) or public.is_my_coach_id(coach_id));
-- coach_shares：本人だけ読み書き（コーチは coach_students() 経由）
create policy "coach_shares_select_own" on public.coach_shares for select to authenticated using (user_id = (select auth.uid()));
create policy "coach_shares_insert_own" on public.coach_shares for insert to authenticated with check (user_id = (select auth.uid()));
create policy "coach_shares_update_own" on public.coach_shares for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "coach_shares_delete_own" on public.coach_shares for delete to authenticated using (user_id = (select auth.uid()));
-- goal_plans / coach_notes：生徒本人は読める。コーチは自分が送ったものを読める
create policy "goal_plans_select" on public.goal_plans for select to authenticated using (user_id = (select auth.uid()) or public.is_my_coach_id(coach_id));
create policy "coach_notes_select" on public.coach_notes for select to authenticated using (user_id = (select auth.uid()) or public.is_my_coach_id(coach_id));
-- coach_menus：コーチ本人が管理する
create policy "coach_menus_all_own" on public.coach_menus for all to authenticated using (public.is_my_coach_id(coach_id)) with check (public.is_my_coach_id(coach_id));

-- ------------------------------------------------------------------ コーチ側の関数

-- 6文字の招待コード（紛らわしい文字を除く）
create or replace function public.gen_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.coaches where invite_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.create_coach(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  c public.coaches;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into c from public.coaches where user_id = uid;
  if found then
    update public.coaches set name = left(trim(p_name), 30) where id = c.id returning * into c;
  else
    insert into public.coaches (user_id, name, invite_code) values (uid, left(trim(p_name), 30), public.gen_invite_code()) returning * into c;
  end if;
  return to_jsonb(c);
end;
$$;

create or replace function public.rotate_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  code text := public.gen_invite_code();
begin
  update public.coaches set invite_code = code where user_id = uid;
  if not found then raise exception 'not_a_coach'; end if;
  return code;
end;
$$;

-- 生徒の一覧（コーチが読めるのは、有効な接続先のうち、生徒が共有を許した項目だけ）
create or replace function public.coach_students() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  cid uuid;
begin
  select id into cid from public.coaches where user_id = uid;
  if cid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(row order by row->>'studentName') from (
      select jsonb_build_object(
        'linkId', l.id,
        'userId', l.user_id,
        'studentName', l.student_name,
        'status', l.status,
        'share', jsonb_build_object('meals', l.share_meals, 'weight', l.share_weight, 'training', l.share_training),
        'managesGoals', l.manages_goals,
        'joinedAt', l.created_at,
        -- 一時停止中は何も見せない。共有を切った項目は、スナップショットから外して返す
        'payload', case when l.status = 'active' then
            (coalesce(s.payload, '{}'::jsonb)
              - case when l.share_meals then '' else 'meals' end
              - case when l.share_weight then '' else 'weight' end
              - case when l.share_training then '' else 'training' end)
          else null end,
        'payloadUpdatedAt', s.updated_at,
        'plan', (select to_jsonb(g) from public.goal_plans g where g.user_id = l.user_id and g.coach_id = cid order by g.effective_from desc, g.created_at desc limit 1),
        'lastNote', (select to_jsonb(n) from public.coach_notes n where n.user_id = l.user_id and n.coach_id = cid order by n.week_start desc limit 1)
      ) as row
      from public.coach_links l
      left join public.coach_shares s on s.user_id = l.user_id
      where l.coach_id = cid and l.status in ('active', 'paused')
    ) t
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_goal_plan(
  p_user_id uuid, p_target_weight numeric, p_pace numeric, p_protein_g int, p_fat_pct int, p_menus jsonb, p_effective_from date
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  cid uuid;
  g public.goal_plans;
begin
  select id into cid from public.coaches where user_id = uid;
  if cid is null then raise exception 'not_a_coach'; end if;
  if not exists (select 1 from public.coach_links where coach_id = cid and user_id = p_user_id and status = 'active') then
    raise exception 'not_linked';
  end if;
  insert into public.goal_plans (user_id, coach_id, target_weight, pace_per_week, protein_g, fat_pct, menus, effective_from)
  values (p_user_id, cid, p_target_weight, p_pace, p_protein_g, p_fat_pct, coalesce(p_menus, '[]'::jsonb), p_effective_from)
  returning * into g;
  update public.coach_links set manages_goals = true, updated_at = now() where coach_id = cid and user_id = p_user_id;
  return to_jsonb(g);
end;
$$;

create or replace function public.send_note(p_user_id uuid, p_week_start date, p_body text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  cid uuid;
  n public.coach_notes;
begin
  select id into cid from public.coaches where user_id = uid;
  if cid is null then raise exception 'not_a_coach'; end if;
  if not exists (select 1 from public.coach_links where coach_id = cid and user_id = p_user_id and status in ('active', 'paused')) then
    raise exception 'not_linked';
  end if;
  insert into public.coach_notes (coach_id, user_id, week_start, body) values (cid, p_user_id, p_week_start, left(trim(p_body), 500))
  on conflict (coach_id, user_id, week_start) do update set body = excluded.body, created_at = now()
  returning * into n;
  return to_jsonb(n);
end;
$$;

-- ------------------------------------------------------------------ 生徒側の関数

-- 招待コードの確認（コーチ名を返す）。失敗が続いたら止める。
-- 失敗は例外にしない（例外にすると、失敗の記録も一緒に巻き戻って、回数を数えられない）
create or replace function public.preview_invite(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  c public.coaches;
  fails int;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select count(*) into fails from public.invite_attempts where user_id = uid and not ok and at > now() - interval '1 hour';
  if fails >= 10 then return jsonb_build_object('error', 'too_many_attempts'); end if;
  select * into c from public.coaches where invite_code = upper(trim(p_code));
  if not found then
    insert into public.invite_attempts (user_id, ok) values (uid, false);
    return jsonb_build_object('error', 'invalid_code');
  end if;
  if c.user_id = uid then return jsonb_build_object('error', 'own_code'); end if;
  if (select count(*) from public.coach_links where coach_id = c.id and status in ('active', 'paused')) >= 100 then
    return jsonb_build_object('error', 'coach_full');
  end if;
  return jsonb_build_object('coachName', c.name);
end;
$$;

create or replace function public.accept_invite(p_code text, p_student_name text, p_meals boolean, p_weight boolean, p_training boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  c public.coaches;
  l public.coach_links;
  pv jsonb;
begin
  pv := public.preview_invite(p_code);
  if pv ? 'error' then return pv; end if;
  select * into c from public.coaches where invite_code = upper(trim(p_code));
  if exists (select 1 from public.coach_links where user_id = uid and status in ('active', 'paused')) then
    return jsonb_build_object('error', 'already_linked');
  end if;
  insert into public.coach_links (coach_id, user_id, student_name, status, share_meals, share_weight, share_training, manages_goals)
  values (c.id, uid, left(trim(coalesce(p_student_name, '')), 30), 'active', p_meals, p_weight, p_training, false)
  on conflict (coach_id, user_id) do update
    set status = 'active', student_name = excluded.student_name, share_meals = excluded.share_meals, share_weight = excluded.share_weight,
        share_training = excluded.share_training, manages_goals = false, updated_at = now()
  returning * into l;
  insert into public.invite_attempts (user_id, ok) values (uid, true);
  return to_jsonb(l) || jsonb_build_object('coachName', c.name);
end;
$$;

create or replace function public.update_my_link(p_meals boolean, p_weight boolean, p_training boolean, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  l public.coach_links;
begin
  if p_status not in ('active', 'paused') then raise exception 'bad_status'; end if;
  select * into l from public.coach_links where user_id = uid and status in ('active', 'paused');
  if not found then raise exception 'not_linked'; end if;
  update public.coach_links set
    share_meals = p_meals, share_weight = p_weight, share_training = p_training,
    status = p_status,
    -- 「ひとりで」に切り替えたら目標は自分のものに戻る。「コーチと」に戻したら、コーチが目標を送っていれば再びコーチ管理にする
    manages_goals = case when p_status = 'paused' then false
                         else exists (select 1 from public.goal_plans g where g.user_id = uid and g.coach_id = l.coach_id) end,
    updated_at = now()
  where id = l.id returning * into l;
  return to_jsonb(l);
end;
$$;

create or replace function public.revoke_my_link() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  update public.coach_links set status = 'revoked', manages_goals = false, updated_at = now() where user_id = uid and status in ('active', 'paused');
  -- コーチに見せていたスナップショットも消す
  delete from public.coach_shares where user_id = uid;
end;
$$;

-- 生徒のアプリが起動・復帰したときに1回呼ぶ：つながり・最新の目標プラン・ひとこと
create or replace function public.my_coach_inbox() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  l public.coach_links;
  cname text;
begin
  select * into l from public.coach_links where user_id = uid and status in ('active', 'paused');
  if found then select name into cname from public.coaches where id = l.coach_id; end if;
  return jsonb_build_object(
    'link', case when l.id is null then null else jsonb_build_object(
      'coachName', cname, 'status', l.status, 'managesGoals', l.manages_goals, 'studentName', l.student_name,
      'share', jsonb_build_object('meals', l.share_meals, 'weight', l.share_weight, 'training', l.share_training)) end,
    'plans', coalesce((select jsonb_agg(to_jsonb(g)) from (
        select * from public.goal_plans where user_id = uid and (l.id is not null and coach_id = l.coach_id)
        order by effective_from desc, created_at desc limit 5) g), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'weekStart', n.week_start, 'body', n.body, 'createdAt', n.created_at, 'coachName', c.name)) from (
        select * from public.coach_notes where user_id = uid order by week_start desc limit 20) n
        join public.coaches c on c.id = n.coach_id), '[]'::jsonb)
  );
end;
$$;

-- 実行権限：ログイン済みの利用者だけ
do $$
declare f text;
begin
  foreach f in array array[
    'create_coach(text)', 'rotate_invite_code()', 'coach_students()',
    'set_goal_plan(uuid, numeric, numeric, int, int, jsonb, date)', 'send_note(uuid, date, text)',
    'preview_invite(text)', 'accept_invite(text, text, boolean, boolean, boolean)',
    'update_my_link(boolean, boolean, boolean, text)', 'revoke_my_link()', 'my_coach_inbox()', 'is_my_coach_id(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on function public.gen_invite_code() from public, anon, authenticated;
