-- 食事の写真のバックアップ置き場（非公開）。パスは「<user_id>/<ファイル名>」。本人のフォルダだけ読み書きできる
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

create policy "own photos select" on storage.objects for select to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own photos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);
