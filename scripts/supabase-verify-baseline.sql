-- 読み取り専用。SQL Editor に貼って実行する（何も変更しない）。
-- 各マイグレーションの内容が本番に入っているかを、1 行ずつ true / false で返す。
-- すべて true になったものだけ、履歴に applied として登録してよい（docs/supabase-migrations.md）。
select '20260928190100_backups' as migration,
  to_regclass('public.backups') is not null
  and to_regclass('public.ai_usage') is not null
  and to_regprocedure('public.consume_ai_quota(uuid, int)') is not null as present
union all
select '20260928190200_meal_photos',
  exists (select 1 from storage.buckets where id = 'plate-meal-photos')
union all
select '20260929120000_coach_mode',
  to_regclass('public.coaches') is not null
  and to_regclass('public.coach_links') is not null
  and to_regclass('public.coach_shares') is not null
  and to_regclass('public.goal_plans') is not null
  and to_regclass('public.coach_notes') is not null
  and to_regclass('public.coach_menus') is not null
  and to_regclass('public.invite_attempts') is not null
  and (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.proname in ('is_my_coach_id','gen_invite_code','create_coach','rotate_invite_code',
           'coach_students','set_goal_plan','send_note','preview_invite','accept_invite',
           'update_my_link','revoke_my_link','my_coach_inbox')) = 12
union all
select '20260929130000_comp_access', to_regclass('public.comp_access') is not null
union all
select '20261002000000_ai_global_quota',
  to_regclass('public.ai_usage_global') is not null
  and to_regprocedure('public.consume_ai_global_quota(int)') is not null;
