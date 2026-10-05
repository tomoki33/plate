-- 読み取り専用。SQL Editor に貼って実行する（何も変更しない）。
-- baseline 対象の 5 版それぞれについて、テーブル・RLS・ポリシー名・インデックス・関数・権限・バケットの
-- 設定が揃っているかを true / false で返す。
-- 全行 true でも「ポリシーの条件式・関数の本文」までは見ていない。下の「手動確認」（docs 手順 3）も必須。
-- 1 行でも false なら履歴登録（--apply）に進まない。不足分を補ってこの SQL を再実行する。

select '20260928190100_backups' as migration,
  to_regclass('public.backups') is not null
  and to_regclass('public.ai_usage') is not null
  and (select bool_and(relrowsecurity) from pg_class where oid in ('public.backups'::regclass, 'public.ai_usage'::regclass))
  and (select count(*) from pg_policies where schemaname = 'public' and tablename = 'backups'
       and policyname in ('own backup select', 'own backup insert', 'own backup update', 'own backup delete')) = 4
  and to_regprocedure('public.consume_ai_quota(uuid, int)') is not null
  and not has_function_privilege('anon', 'public.consume_ai_quota(uuid, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.consume_ai_quota(uuid, int)', 'execute') as present
union all
select '20260928190200_meal_photos',
  exists (select 1 from storage.buckets where id = 'plate-meal-photos' and public = false)
  and (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('own photos select', 'own photos insert', 'own photos delete')) = 3
union all
select '20260929120000_coach_mode',
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity
   and relname in ('coaches', 'coach_links', 'coach_shares', 'goal_plans', 'coach_notes', 'coach_menus', 'invite_attempts')) = 7
  and (select count(*) from pg_policies where schemaname = 'public' and policyname in (
       'coaches_select_own', 'coaches_update_own', 'coach_links_select', 'coach_shares_select_own',
       'coach_shares_insert_own', 'coach_shares_update_own', 'coach_shares_delete_own',
       'goal_plans_select', 'coach_notes_select', 'coach_menus_all_own')) = 10
  and (select count(*) from pg_indexes where schemaname = 'public' and indexname in (
       'coach_links_one_live', 'coach_links_coach_idx', 'goal_plans_user_idx',
       'coach_notes_user_idx', 'coach_menus_coach_idx', 'invite_attempts_idx')) = 6
  and (select count(distinct proname) from pg_proc where pronamespace = 'public'::regnamespace and proname in (
       'is_my_coach_id', 'gen_invite_code', 'create_coach', 'rotate_invite_code', 'coach_students',
       'set_goal_plan', 'send_note', 'preview_invite', 'accept_invite', 'update_my_link',
       'revoke_my_link', 'my_coach_inbox')) = 12
  and not has_function_privilege('anon', 'public.gen_invite_code()', 'execute')
  and not has_function_privilege('authenticated', 'public.gen_invite_code()', 'execute')
union all
select '20260929130000_comp_access',
  to_regclass('public.comp_access') is not null
  and (select relrowsecurity from pg_class where oid = 'public.comp_access'::regclass)
  and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'comp_access'
              and policyname = 'comp_access_select_own')
union all
select '20261002000000_ai_global_quota',
  to_regclass('public.ai_usage_global') is not null
  and (select relrowsecurity from pg_class where oid = 'public.ai_usage_global'::regclass)
  and to_regprocedure('public.consume_ai_global_quota(int)') is not null
  and not has_function_privilege('anon', 'public.consume_ai_global_quota(int)', 'execute')
  and not has_function_privilege('authenticated', 'public.consume_ai_global_quota(int)', 'execute');

-- 手動確認（上の SQL では見られない中身）。結果を supabase/migrations/*.sql と見比べる。
-- ポリシーの条件式:
--   select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname in ('public', 'storage') and (schemaname = 'public' or policyname like 'own photos%')
--   order by 1, 2, 3;
-- 関数の本文:
--   select p.proname, pg_get_functiondef(p.oid) from pg_proc p where p.pronamespace = 'public'::regnamespace
--   and p.proname in ('consume_ai_quota', 'consume_ai_global_quota', 'create_coach', 'accept_invite') order by 1;
