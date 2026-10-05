# 月 1 回のメンテナンス・チェックリスト（issue #40）

公開後に、放っておくと壊れる・費用が増える・規約違反になるものを、月 1 回まとめて確認する。**所要の目安は 30〜60 分。** 毎月、決めた日（例：毎月 1 日）にこのファイルを開き、下の「実施記録」に 1 行足す。

- 全項目を毎回やる必要はない。**「毎月」は必ず、「四半期」「随時」は該当する月だけ**やる。
- 外部 API を叩く確認（`npm run eval:prompt`）は費用がかかるので、**条件に当てはまるときだけ**行う（個人の費用のため）。
- このファイルは手順の置き場。各仕組みの詳細は、リンク先の文書に書いてある。

## 0. 先に見る（5 分）：仕組みが生きているか

これまでに入れた仕組みが、黙って止まっていないかを見る。

| 仕組み | どこを見る | 正常な状態 | 詳細 |
| --- | --- | --- | --- |
| Supabase keep-alive | GitHub → Actions → 「Supabase keep-alive」 | 直近の実行が緑。無効化（disabled）されていない | `docs/supabase-keepalive.md` |
| CI | GitHub → Actions → 「CI」（main の最新） | 緑（tsc / eslint / vitest / 本番バンドルの禁止文字検査 / coach の型検査） | `.github/workflows/ci.yml` |
| クラッシュ監視（Sentry） | Sentry の Issues | 未対応の新しい問題がない、または把握している。アラートメールが届く設定のまま | `docs/release-checklist.md` の E2 |
| Gemini の予算アラート | Google Cloud Console → お支払い → 予算とアラート | 予算が残っている。通知先メールが有効 | `docs/release-checklist.md` の「Gemini の費用管理」 |
| 全体の AI 上限 | Supabase → Edge Functions のログ | `global quota check failed` が出ていない。上限到達（503）が頻発していない | 同上 |

- [ ] keep-alive が緑で、**無効化されていない**（公開リポジトリは 60 日動きがないと scheduled workflow が止まる。コミットが月 1 回以上あれば起きにくい。止まっていたら Actions タブで再度有効化する）
- [ ] keep-alive が失敗していたら、Supabase が停止（pause）していないかダッシュボードで確認 → 停止していれば `docs/supabase-keepalive.md` の復旧手順
- [ ] main の CI が緑
- [ ] Sentry に新しい問題がないか。あれば原因を見て issue にする（記録・メール・ユーザー ID が入っていないことも、たまに目で確認する）
- [ ] Sentry・GitHub Actions・Google Cloud・Supabase の**通知メールが届く状態**か（迷惑メールに入っていないか。受信箱にこの 1 か月の通知が 1 通でもあれば OK）

## 1. 費用と上限（10 分）

対象：Supabase・Gemini・EAS・Apple（年 $99）・Sentry。

- [ ] **Gemini**：Cloud Console → お支払い → レポートで、今月の実績が予算内か。前月より急に増えていないか
  - 1 回あたりの単価と月の見込み（`docs/release-checklist.md` の「Gemini の費用管理」にある「数千円の見込み」）が実績と合っているか。大きくずれていたら、上限（下の 2 行）を見直す
  - 1 人 1 日 `DAILY_LIMIT`（30 回、`supabase/functions/estimate-meal/index.ts`）／全体 1 日 `GLOBAL_DAILY_LIMIT`（既定 3,000 回、`supabase secrets set GLOBAL_DAILY_LIMIT=...` で変更）が今の利用規模に合っているか
  - 予算アラートの通知先・しきい値（50% / 90% / 100% 実績、100% 予測）が残っているか
  - 緊急停止の手段を覚えている：`supabase secrets set GLOBAL_DAILY_LIMIT=0`（全体停止）、または API キーの無効化
- [ ] **Supabase**：Dashboard → Usage で、無料枠（DB サイズ・ストレージ・Edge Function 呼び出し・帯域）に対する使用率。**80% を超えていたら** Pro への切り替えを検討する（`docs/supabase-keepalive.md` の方針）。写真バケット（`meal_photos`）の容量も見る
- [ ] **EAS**：expo.dev → Billing / Usage で、ビルド数と更新（`eas update`）の月間の上限に対する使用率。無料枠のビルド数を使い切りそうなら、ビルドを減らすか有料にするかを決める
- [ ] **Sentry**：Usage で、イベント数が無料枠に収まっているか（収まらないときは、サンプリングを下げるか、うるさいエラーを直す）
- [ ] **Apple Developer Program**：更新日（年 1 回 $99）が近くないか。支払い方法の期限切れがないか
- [ ] （課金を始めたら）RevenueCat の手数料・Apple の手数料を、収益と並べて確認

各サービスの上限の数字は変わるので、**この文書に書き写さず**、その月に画面で見る。

## 2. 依存パッケージと Expo SDK（10〜20 分）

現在は Expo SDK 57（`package.json` の `expo`）。**Expo は SDK ごとに破壊的変更があるので、`AGENTS.md` のとおり、更新作業の前に versioned docs を読む**（`https://docs.expo.dev/versions/v<major>.0.0/`）。

毎月：

- [ ] `npm audit`（本番に入る依存の脆弱性。`npm audit --omit=dev` で本番分だけ見てもよい）。**high / critical があれば、その月のうちに対応**する。`npm audit fix --force` は破壊的更新を入れうるので、そのまま使わない
- [ ] `npx expo install --check`（SDK と合わない版がないか。直すときは `npx expo install --fix`。`npm install` で個別に上げない）
- [ ] `npx expo-doctor`
- [ ] `npm outdated` で、パッチ・マイナー更新を見る。上げたら **`npx expo lint` / `npx tsc --noEmit` / `npx vitest run`** を通し、実機または開発ビルドで主要な画面（記録・AI 入力・バックアップ同期）を開く
- [ ] `coach/`（Web ダッシュボード）の依存も同様に `npm audit`（`cd coach && npm audit`）

SDK のメジャー更新（四半期ごとに、新しい SDK が出ていないか確認）：

- [ ] <https://expo.dev/changelog> で、新しい SDK のリリースを確認する。出ていたら、すぐ上げず、変更点（Breaking changes）を読んでから、**専用の issue と branch で**上げる（ネイティブの依存が変わるので、EAS の新しいビルドと審査提出が必要。OTA 更新では入らない）
- [ ] 今の SDK のサポート状況（古い SDK は Expo Go・EAS ビルド・Apple の要件から外れる）

## 3. iOS の新バージョンへの対応（10 分。9〜10 月は毎週）

- [ ] 次の iOS のベータ・リリース時期を確認する（例年 6 月に発表、9 月ごろに正式公開）。**正式公開の前に**、ベータで主要機能が動くか確認する（実機にベータを入れるか、Xcode のシミュレータで）
- [ ] Apple の「Upcoming Requirements」（<https://developer.apple.com/news/upcoming-requirements/>）：最低限必要な Xcode / SDK のバージョン。**期限までに、その SDK でビルドしたアプリを出さないと、提出できなくなる**。EAS のビルドイメージが新しい SDK に対応しているかも確認する
- [ ] 新しい iOS で、次を確認（`docs/release-checklist.md` の E「実機テスト項目」の主要部分）：起動、記録、写真を撮る・選ぶ（権限ダイアログ）、AI 入力、バックアップ同期、通知（使っていれば）、ダークモード・文字サイズ
- [ ] 問題があれば issue にし、修正を OTA（`eas update`）で出せるか、ネイティブの変更が要るかを判断する

## 4. AI モデルの変更・廃止（10 分）

`supabase/functions/estimate-meal/index.ts` は `ESTIMATE_MODEL` が未設定なら **`gemini-flash-lite-latest`（エイリアス）** を使う。エイリアスは、指す先のモデルが**予告つきで変わる**ので、ある日突然、出力の傾向や費用が変わりうる。

- [ ] Google の Gemini API の「モデル」「非推奨（Deprecations）」「変更履歴（Changelog）」のページを見る（<https://ai.google.dev/gemini-api/docs/models>、<https://ai.google.dev/gemini-api/docs/changelog>）。次を確認：
  - `gemini-flash-lite-latest` が指すモデルが変わっていないか／変わる予定がないか
  - 使っているモデルの廃止予定日がないか。**あれば、期限の 2 週間前までに移行する**
  - 料金（入力・出力の単価）が変わっていないか。変わっていたら、上の「費用と上限」の見込みを計算し直す
- [ ] Google からのメール（Cloud / AI Studio の通知）で、モデルの廃止通知が来ていないか
- [ ] **エイリアスの先が変わった、またはモデルを替える・上げるときだけ**、AI の品質を測り直す（外部 API を叩くので費用がかかる。**毎月は回さない**）：
  1. `npm run eval:foods`（端末側の食品名検索だけ。API は使わない。`-- --min 0.95` で下限割れを検出）
  2. `GEMINI_API_KEY=... npm run eval:prompt -- --save <前>.json`（変更前の結果。`--runs` で回数を減らすと安い）
  3. モデルを替えたあと `npm run eval:prompt -- --compare <前>.json` で、直った・悪化したケースを見る
  4. 悪化が目立てば、`ESTIMATE_MODEL` を固定したモデルに戻す（`supabase secrets set ESTIMATE_MODEL=<モデル名>`。再デプロイは不要）
- [ ] 固定したモデル名にしている場合は、廃止予定日をこの欄に書いておく（なければ「なし」）：_____

## 5. Supabase とマイグレーション（5 分）

- [ ] Supabase Dashboard → Settings → Infrastructure で、Postgres のバージョン更新の案内が出ていないか。出ていれば、メンテナンスの時間帯と影響（数分の停止）を確認する
- [ ] Edge Function の実行ログ（Logs）で、エラー率が高くないか。`estimate-meal` の 4xx / 5xx（429 は個人上限、503 は全体上限か上限確認の失敗）
- [ ] マイグレーションを足した月は、`supabase migration list --linked` の Local / Remote が全行一致しているか（`docs/supabase-migrations.md`。他アプリと同居しているなら、`db push` ではなく SQL Editor 運用のまま）
- [ ] 新しい migration を適用してから Edge Function を再デプロイした順序になっているか（逆だと `global quota check failed` で 503 になる）
- [ ] 秘密情報（API キー・`SENTRY_AUTH_TOKEN` など）の有効期限・ローテーションの予定がないか。漏れた疑いがあれば、すぐ再発行して `supabase secrets set` / EAS のシークレットを更新する

## 6. App Store・iOS の規約の変更（10 分）

- [ ] Apple Developer のニュース（<https://developer.apple.com/news/>）と、Apple からのメール（App Store Connect の通知）を確認する
- [ ] **App Review Guidelines** の更新（<https://developer.apple.com/app-store/review/guidelines/>。ページ先頭の更新履歴）。特に次に関わる変更が重要：
  - 健康・医療情報（1.4.1。アプリ内「情報の出典」画面、`docs/app-review-reply.md`）
  - AI・ユーザーが入力したデータの外部サービスへの送信（5.1.1 / 5.1.2。Gemini への写真・文章の送信と、同意の表示）
  - アカウント削除（5.1.1(v)）、課金（3.1.x。有料化するとき）
- [ ] **Apple Developer Program License Agreement** の更新：App Store Connect に同意待ちの表示が出ていると、提出・更新ができなくなる。出ていたら、アカウントの代表者が同意する
- [ ] **App のプライバシー（栄養表示ラベル）** と、実際のデータの扱いが合っているか。新しい SDK・送信先を足した月は必ず見直す（`docs/privacy-policy.md`、`docs/v1.1-review-prep.md` の 1 章）。**プライバシーポリシー・利用規約（`docs/privacy-policy.md`、`docs/terms.md`、`web/legal.html`）と実際の挙動のずれ**がないか
- [ ] 第三者のサービス（Google Gemini、Supabase、Sentry）の**利用規約・データの扱いの変更通知**が来ていないか（来ていれば、ポリシーの記載を直す）
- [ ] 日本の法令（特定商取引法・個人情報保護法・資金決済関係など）の変更は、年 1 回、または有料化の前に確認する

## 7. 問い合わせ・レビューの確認（10 分）

- [ ] **App Store Connect → ユーザーのレビューと評価**：新しいレビューを読む。★1〜2 や不具合の報告は issue にする。返信できるものは返信する（レビューへの返信は App Store Connect から）
- [ ] **サポート用のメール**（`web/legal.html` のサポート欄に載せたアドレス）：未返信がないか。**返信の目安は 1 週間以内**（決めた目安に書き換えてよい）
- [ ] 問い合わせ・レビューに**個人情報（食事・体重の内容、メールアドレス）**が含まれていたら、必要以上に別の場所へ写さない。issue には、個人を特定する情報を書かない
- [ ] TestFlight のフィードバック（テスターがいる場合）
- [ ] GitHub の issue / Discussions に外部からの報告がないか
- [ ] データ削除の依頼（アカウント削除はアプリ内でできる。メールで来た場合の対応手順を決めておく）

## 8. 終わりに

- [ ] 見つけたやるべきことは、**その場で issue にする**（このチェックリストに書き足さない）
- [ ] 下の「実施記録」に、日付と、気づいたことを 1 行書く
- [ ] このチェックリスト自体の見直し：新しい仕組み（監視・CI・外部サービス）を足した月は、「0. 先に見る」の表に 1 行足す

## 実施記録

| 日付 | 実施者 | 気づいたこと・作った issue |
| --- | --- | --- |
| （例）2026-11-01 | | keep-alive 緑、Sentry 新規 0、npm audit 問題なし |

## 補足：やらないこと・決めていること

- **自動で止める仕組み**（予算超過で課金を自動停止など）は入れていない（誤作動のリスク。`docs/release-checklist.md`）。通知を見て、人が止める。
- **依存の自動更新（Dependabot など）**は入れていない。入れる場合も、Expo の依存は `npx expo install` で SDK に合う版にそろえる必要があるので、自動の PR をそのまま取り込まない。
- 月 1 回の確認を忘れないために、**カレンダーに「毎月 1 日 PLATE のメンテナンス」の繰り返し予定を入れる**（人間の作業）。
