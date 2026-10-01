# Supabase 無料枠の自動停止対策と復旧手順

最終確認: 2026-10-02 / 出典: <https://supabase.com/docs/guides/platform/free-project-pausing>

## 停止条件（公式ドキュメントより）

- Free プランのプロジェクトは、**直近1週間のユーザーによるDBアクティビティが不十分**だと自動で停止（pause）される。目安は「毎日数回のDBリクエスト」。
- 停止前に、プロジェクトオーナー宛てに **警告メール（停止の約1週間前）** と **停止完了メール** が届く。
- 警告後でも、ダッシュボードを開く／API を叩く／アプリからリクエストを送ると停止を防げる。
- 有料プラン（Pro）は停止されない。
- 停止中は DB・API・Edge Functions が使えず、アプリの同期・AI入力・アカウント削除が失敗する。
- 注意: 公式は「1年」の復元期限と書いている（ページ内の見出しアンカーは旧仕様の `90-day` のまま）。過去は90日だったため、**早めに復旧する前提で運用する**。

## 方針

有料化（Pro）は決めない。まず無料のまま **GitHub Actions の cron で2日おきに DB へ軽いクエリ**を送る（`.github/workflows/supabase-keepalive.yml`）。ユーザーが増えて本番運用が安定したら Pro への切り替えを検討する（確実に止まらず、停止の心配自体が消える）。

- 送るもの: `GET /rest/v1/backups?select=user_id&limit=1`（anon キー）。RLS により匿名は0行だが、クエリ自体は DB で実行される。
- 失敗時（停止中・キー誤り等）はジョブが失敗し、GitHub から失敗通知メールが届く＝**停止に気づける**。
- 他アプリと同居しているプロジェクトでも、データを触らないので影響しない。

## 人間がやること（初回のみ）

1. GitHub のリポジトリ → Settings → Secrets and variables → Actions → New repository secret
   - `SUPABASE_URL` = `https://<project>.supabase.co`
   - `SUPABASE_ANON_KEY` = anon キー（アプリの `EXPO_PUBLIC_SUPABASE_ANON_KEY` と同じ値）
2. Actions タブ → 「Supabase keep-alive」→ Run workflow で手動実行し、成功（緑）を確認。
3. GitHub の通知設定で Actions の失敗通知（メール）が有効なことを確認。
4. Supabase の通知メール（警告・停止）が見られるアドレスがオーナーになっていることを確認。
5. （任意）`workflow_dispatch` の手動実行後、Supabase ダッシュボードのログ（API Gateway / Postgres）にリクエストが出ているか確認。

### GitHub 側の注意

- 公開リポジトリは、**60日間リポジトリに動きがないと scheduled workflow が自動で無効化**される。無効化メールが来たら Actions タブで再度有効化する（コミットが定期的にあれば起きない）。
- cron は数分〜数十分遅れることがある。2日おきなので問題なし。

## 停止した場合の復旧手順

1. 通知（停止メール／keep-alive の失敗）を受けたら、[Supabase Dashboard](https://supabase.com/dashboard/organizations) を開く。
2. 組織 → 停止中のプロジェクト → **Resume project** → 確認。数分待つ。
3. データ・設定はそのまま戻る。URL・キー・Edge Functions・secrets はそのまま（アプリ側の変更は不要）。
4. 確認: keep-alive ワークフローを手動実行して緑になる／アプリでログイン→バックアップ同期ができる。
5. 復旧できない（期限切れ等）場合: 端末内の SQLite が正本なので、新規プロジェクトを作り `docs/release-checklist.md` の Supabase 手順（SQL 実行・functions deploy・secrets・EAS の環境変数）をやり直す。バックアップ（クラウド側）のみ失われる。
