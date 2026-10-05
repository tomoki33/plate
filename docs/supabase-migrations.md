# Supabase マイグレーションを `db push` 運用に移す手順

最終確認: 2026-10-06（Supabase CLI 2.109）/ 担当 issue: #26

## 現状

- `supabase/migrations/` に 5 本ある。これまでは SQL Editor に貼って適用してきたため、**リモートのマイグレーション履歴（`supabase_migrations.schema_migrations`）は空**。
- この状態で `supabase db push` すると、5 本すべてを「未適用」とみなして再実行する。`create policy` などは再実行できず**失敗する**（途中まで入って中途半端になる恐れもある）。
- 対策は **baseline 化**：中身はすでに入っているので、SQL は実行せず、履歴にだけ「適用済み」の印を付ける（`supabase migration repair --status applied`）。

## 先に決めること：プロジェクトは専有か、相乗りか

履歴テーブルは**プロジェクト単位**で、他アプリのリポジトリは互いの migration を知らない（`docs/release-checklist.md` の「相乗り」の注意）。

| 状況 | 方針 |
| --- | --- |
| この Supabase プロジェクトを PLATE だけが使う | この文書の手順で `db push` に移行する |
| 他アプリと同居している | **`db push` に移行しない**（SQL Editor 運用のまま）。他アプリの履歴や版番号とぶつかり、`Remote migration versions not found` が出る。移行するなら、PLATE 専用の新規プロジェクトを作ってそこで baseline から始める |

手順 2 の確認で、リモートの履歴に**他アプリ由来の版が 1 つでもあれば、専有ではない**と判断して中止する。

## 手順（すべて人間が実行する。本番を変更するのは手順 4 の履歴登録だけ）

1. **リンク**（初回のみ）：`supabase login` → `supabase link --project-ref <ref>`（DB パスワードを聞かれる）。
2. **履歴の確認（変更なし）**：`scripts/supabase-baseline.sh`
   - `supabase migration list --linked` の結果で、Remote 列が空であること（＝ローカル 5 本が全部 Local のみ）を確認する。Remote だけにある版があれば、上の「相乗り」の扱いにして中止。
3. **中身が本当に入っているか確認（読み取りのみ）**：`scripts/supabase-verify-baseline.sql` を SQL Editor で実行し、**全行 `present = true`** を確認する。false の行は、その migration を SQL Editor で先に適用してから（または `supabase db push` の対象として残して）進める。**false のものを applied にしない**（スキーマが無いのに「適用済み」になる）。
4. **baseline 登録**：`scripts/supabase-baseline.sh --apply`（`yes` と答える）。内部で次を実行する。
   ```bash
   supabase migration repair --linked --status applied 20260928190100 20260928190200 20260929120000 20260929130000 20261002000000
   ```
   終了時に `supabase db push --linked --dry-run` まで走り、`Remote database is up to date.` と出れば成功。
5. **動作確認**：新しい migration を作って流す（下記）。

## 以後の運用（新しいマイグレーション）

```bash
supabase migration new <name>          # supabase/migrations/<timestamp>_<name>.sql ができる
# SQL を書く（できるだけ冪等に：if not exists / create or replace）
supabase db push --linked --dry-run    # 適用予定を確認
supabase db push --linked              # 適用
```

- 適用は **Edge Function の再デプロイより先**に行う。
- **SQL Editor で直接変更しない**。やると履歴とずれる。やってしまったら `supabase migration repair --linked --status applied <版>`（その SQL が実際に入っている場合）か、`--status reverted`（入っていない場合）で合わせる。
- 版番号は `supabase migration new` が付ける時刻に任せる。既存の版より古い番号を後から足すと `db push` が拒否する（その場合は `--include-all`、または番号を付け直す）。

## 完了条件の確認

- `supabase migration list --linked` の Local / Remote が全行一致。
- 上記「以後の運用」で作った新規 migration が `db push` で適用できる（実機の本番で試すなら、`select 1` 程度の無害な migration か、本当に必要な変更で行う。試験用の migration を本番に残さない）。

## 参考

- <https://supabase.com/docs/reference/cli/supabase-migration-repair>
- <https://supabase.com/docs/guides/deployment/database-migrations>
