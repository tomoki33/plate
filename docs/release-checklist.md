# 公開までのチェックリスト

コードでできる部分は済んでいます。下の **あなたの作業** を上から順に進めると、App Store まで行けます。

## 00. v1.0 はコア機能だけで出す（コーチモードは v1.1）
本番ビルドには `EXPO_PUBLIC_COACH_MODE` を**付けない**（EAS の production に登録しない）。付けないと、設定の「モード」「コーチと共有」、切り替え、同期がすべて出ず、コア機能だけのアプリになる。コードと DB は入っているので、v1.1 で `EXPO_PUBLIC_COACH_MODE=1` を登録して出せばよい。
- **v1.0 の審査メモ・プライバシー（栄養表示ラベル）から、コーチ機能の記述は外す**（下のコーチ機能の行は v1.1 用）。
- 開発ビルドは `.env.local` の `EXPO_PUBLIC_COACH_MODE=1` で、コーチモードを試せる。

## 0. 無料公開モードで出す（課金の設定は要らない）
`EXPO_PUBLIC_FREE_LAUNCH=1` を付けたビルドは、全員が最初から全機能を使えます（体験期間・購入画面・AIプラスは出ません。AI入力は1日10回）。
- **B の「2. RevenueCat」は飛ばしてよい**（有料にするときにやる）。
- 有料にする日が来たら、この変数を外して、課金商品を登録したビルドを出す。すでに使っている人を無料のまま残すなら、サーバーの `comp_access` に登録する（`paid=true`）。
- 課金がないので、法務ページ・LP・審査メモは「無料」の文面にしてある。

## A. 事前（登録・準備）
- [ ] Apple Developer Program に登録（個人。年 $99）
- [ ] 「PLATE」の名前の重複・商標を確認（App Store 内検索、J-PlatPat）。使えなければ表示名だけ変える（`app.json` の `name`。bundle id は変えなくてよい）
- [ ] 連絡先メール（サポート用）を用意
- [ ] `web/`（LP・規約ページ）を公開する（GitHub Pages など。URLが取れればよい）。`web/legal.html` はプライバシー／利用規約／特商法／サポートをタブで切り替える1ページ（`#privacy` `#terms` `#law` `#support` で直接開ける）
- [ ] `web/legal.html`（`docs/privacy-policy.md`・`docs/terms.md` と同じ下書き）の `○○` `【 】` を埋め、事業者名・連絡先・AIサービス名を入れて、公開前に法律の専門家に確認してもらう
- [ ] `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` を、公開した `legal.html#terms` / `legal.html#privacy` のURLにする

## B. 外部サービス（アカウントが必要）
1. **Supabase**（無料枠で可）
   - **他アプリと同じプロジェクトに相乗りする場合は `supabase db push` を使わない**：CLIのマイグレーション履歴（バージョン番号）はプロジェクト単位で共有され、各リポジトリの `supabase/migrations/` はお互いの存在を知らないため、バージョン番号の衝突や「Remote migration versions not found」のようなズレが起きる（実際に発生した）。代わりに、ダッシュボードの SQL Editor で `supabase/migrations/*.sql` の中身をそのまま貼って実行する（順番に：`20260928190100_backups.sql` → `20260928190200_meal_photos.sql` → … → `20261002000000_ai_global_quota.sql`。新しいものは、Edge Function を再デプロイする前に適用する）。これならCLIの履歴管理に触れないので、相手のマイグレーション状態を壊さない
   - 単独の新規プロジェクトを使う場合は、通常どおり `supabase link` → `supabase db push --linked` でよい。すでに SQL Editor で適用済みの専有プロジェクトを `db push` に移すときは、先に履歴の baseline 化が要る（`docs/supabase-migrations.md`）
   - Authentication → Providers：Apple（Client IDs に `app.plate.pfc`）を有効化。ログインは Apple のみ（Google・メールは提供しない。メールのコード送付には独自SMTPが要るため）
   - `supabase functions deploy estimate-meal` / `delete-account`
   - `supabase secrets set GEMINI_API_KEY=...`
   - Gemini の費用の上限と予算アラートは、下の「Gemini の費用管理」に従う
2. **RevenueCat**（**有料にするときだけ**。無料公開モードでは不要。無料枠で可）
   - App Store Connect で商品を3つ作成 → RevenueCat に登録（識別子は `src/services/billing.ts` の定数と合わせる）
     - `plate_trial_4weeks`：非消費型（買い切り）・価格 ¥0。4週間の無料体験の開始日を、この購入記録から判定する
     - `plate_full_unlock`：非消費型（買い切り）・価格 ¥3,800。Entitlement `plate_full`
     - `plate_ai_plus_monthly`：自動更新サブスク・価格 ¥300/月。Entitlement `plate_ai_plus`
   - Offering に、この3つのパッケージを入れる（`plate_trial_4weeks` は Custom パッケージでよい）
3. **環境変数**（`.env.example` 参照。EAS では `eas env:create` か `eas.json` の env）
   - `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_AI_ENDPOINT`
   - `EXPO_PUBLIC_FREE_LAUNCH=1`（無料公開モード）
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`（有料にするときだけ）
   - `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL`
   - **`.env.local` は EAS に送られない。** 本番ビルドは、下のコマンドで EAS に登録した値で作られる（登録しないと、本番でログイン・バックアップ・AI入力が動かない）：
     ```bash
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://<project>.supabase.co
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon key>
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_AI_ENDPOINT --value https://<project>.supabase.co/functions/v1/estimate-meal
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_FREE_LAUNCH --value 1
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_TERMS_URL --value <公開URL>/legal.html#terms
     eas env:create --environment production --visibility plaintext --name EXPO_PUBLIC_PRIVACY_URL --value <公開URL>/legal.html#privacy
     eas env:list --environment production   # 確認
     ```
     anon キーは公開してよい値（データの保護は RLS が担う）。Gemini のキーは Supabase の secrets にだけ置く（アプリには入れない）。
   - **`EXPO_PUBLIC_AUTO_SAMPLE` は本番に入れない**（`.env.local` は git 管理外なので、EAS には送られない）

## C. ビルドとテスト
- [ ] `npx eas-cli@latest login` → `eas build --profile development --platform ios`（実機。HealthKit・カメラ・Apple ログインの確認）
- [ ] 下の「実機テスト項目」を通す
- [ ] `eas build --profile production --platform ios` → `eas submit --platform ios`（TestFlight に上がる）
- [ ] 友人2人に TestFlight で使ってもらう（1〜2週間）

## D. App Store Connect の入力
- **カテゴリ**：ヘルスケア／フィットネス（第一）、フード＆ドリンク（第二）
- **年齢制限**：4+（医療情報の質問で「なし」。ダイエットの助言表現に注意）
- **プライバシー（栄養表示ラベル）**：
  - 収集するデータ：ヘルスケアとフィットネス（体重）、連絡先情報（メール）、ユーザーコンテンツ（写真・食事の記録）、識別子（ユーザーID）、購入履歴
  - **v1.1（コーチ機能を有効にするとき）に追加**：ヘルスケアとフィットネス（食事・体重・トレーニング）は、利用者が承認した場合に**他の利用者（コーチ）に共有される**。「ユーザーに紐づく」で申告し、利用目的は「アプリの機能」。トラッキングには使わない
  - App Review で聞かれやすい点：健康データを他の利用者に見せる同意（承認画面で項目ごとに選択・いつでも解除）、コーチ側が受け取る情報の範囲（写真・メモ・プロフィールは非共有）、アカウント削除で共有データも消えること
  - **クラッシュ監視（Sentry、issue #4）を入れたビルドから追加**：診断 →「クラッシュデータ」。利用目的は「アプリの機能」、「ユーザーに紐づかない」、トラッキングには使わない。送るのはエラーの種類・スタック・アプリのバージョン・OS／機種のみ（記録・ユーザーIDは送らない。`src/services/crashScrub.ts` とそのテストで担保）。Sentry のプロジェクト設定で「Prevent Storing of IP Addresses」を必ずオンにする
  - 利用目的：アプリの機能。**トラッキングには使わない**（ATT 不要）
  - ユーザーに紐づく／紐づかない は、バックアップ・ログイン分は「紐づく」
- **審査メモ**（下記をそのまま貼る。コーチ機能を入れたので、末尾の1段落を足す）
  > ログインなしで全機能の確認ができます（初回のログイン画面で「あとで」を選択）。アプリは無料で、課金はありません。ヘルスケアは体重・体脂肪率の読み込みのみです。ログインは Sign in with Apple のみです。アカウント削除は「設定 → アカウントを削除」にあります。
  >
  > 〔v1.1 で追加〕コーチ機能は任意です（設定 → モード →「コーチとして使う」）。オンにしない限り、画面・タブ・通知は増えません。コーチと共有するには、招待コードを入れて本人が承認する必要があり、見せる項目は選べて、いつでもやめられます。確認には、審査用アカウントを2つ用意しました（コーチ役と生徒役。招待コード：〔審査用アカウントを作ったら記入〕）。
- **サポートURL**：`web/legal.html#support`（よくある質問と問い合わせ）
- **スクリーンショット**：`npm run screenshots` で、`design_handoff_plate 3/App Store Screenshots.dc.html`（s1〜s7）から 6.9インチ（1290×2796）と6.5インチ（1284×2778）を自動で書き出す（`store/screenshots/`）。順番：ブランド → 今日の目標 → トレーニング中 → 完了 → 食事2タップ → 週で見る（**7枚目の「4週間無料・買い切り」は、無料公開では使わない。6枚で出す**）
- **説明文の注意（審査・景表法）**：「痩せる」「必ず」「治る」は使わない。「目安」「サポート」を使う

### 説明文の下書き
> **トレーニングに合わせて、今日食べる量が決まる。**
> 高強度の日は多めに、休みの日は控えめに。PLATE は、1週間のカロリーをトレーニングの予定に合わせて配り分け、たんぱく質・脂質・炭水化物（PFC）の目安を毎日示します。
> - 写真か文章で食事を記録（AIが推定 → 確認して直せます）
> - 食べた量に応じて、残りの日の目安を自動で調整
> - 体重の7日平均と、到達の見通し
> - 1RM の推移と、週のレビュー
> - ヘルスケアから体重を読み込み（読み込みのみ）
> 目安は一般的な計算にもとづくもので、医療的な助言ではありません。
> 食品の栄養成分：文部科学省「日本食品標準成分表（八訂）」を加工して作成

キーワード（100字以内）：`PFC,マクロ,ダイエット,筋トレ,減量,増量,カロリー,たんぱく質,食事記録,体重管理`

## E. 実機テスト項目（未確認。Web ビルドでしか確認していません）
**Expo Go では検証できないもの**（`react-native-purchases`・`expo-apple-authentication`・`@kingstinct/react-native-healthkit` はExpo Goに積まれていないネイティブモジュールで、機能ごと無効化される）。下の[開発ビルド]の項目は、`eas build --profile development --platform ios`（または `npx expo run:ios`）で作った開発ビルドでないと確認できない。

- [ ] 起動 → スプラッシュ → ログイン画面 →「あとで」→ オンボーディング → 今日の画面（Expo Goで可）
- [ ] SQLite（ネイティブ）でデータが保存・再起動後も残る／マイグレーション（Expo Goで可）
- [ ] カメラ・写真の許可ダイアログの文言／撮影 → AI推定 → 確認画面 → 記録／写真がサムネイルに出る（Expo Goで可）
- [ ] キーボード：グラム入力・メモでボタンが隠れない（Expo Goで可）
- [ ] 下端／ノッチの余白（ホームバーとタブバー、シート）（Expo Goで可）
- [ ] ダークモード切り替え（設定 → 端末の外観）（Expo Goで可）
- [ ] 通知：初めてトレーニングを完了した直後の許可の案内 → トレーニング後・月曜朝の通知が届く（Expo Goで可。ローカル通知）
- [ ] オフライン：機内モードで上の帯が出て、記録は止まらない（Expo Goで可）
- [ ] ログアウト（Expo Goで可）
- [ ] 日付またぎ（0時）／過去日の編集／週の切り替え（Expo Goで可）
- [ ] 文字サイズを大きくしても崩れない（設定 → アクセシビリティ）（Expo Goで可）
- [ ] **[開発ビルド]** Apple ログイン
- [ ] **[開発ビルド]** ヘルスケア：許可 → 体重の取り込み（重複しない）
- [ ] **[開発ビルド]** 課金：サンドボックスで、無料体験の開始（`plate_trial_4weeks`）→ 買い切り購入（`plate_full`）→ 見るだけ（未購入のまま体験終了）→ AIプラスの登録・解約、購入の復元をひととおり確認（今回作り直した箇所。Expo Goでは`billingConfigured()`がfalseになりフォールバック動作しかしないため、動作確認の意味がない）
- [ ] **[開発ビルド]** アカウント削除（19b の画面）→ ログイン画面へ戻る、Storage の写真も消えること
- [ ] **[開発ビルド]** バックアップ → アプリ削除 → 入れ直して復元（**写真も戻ること**。Supabase の Storage に `plate-meal-photos/<user_id>/` ができる）
- [ ] **[開発ビルド]** 機内モード：AI 以外は普通に動く／AI は分かりやすいエラー

## E2. クラッシュ監視（Sentry、issue #4）
- [ ] Sentry でプロジェクト（React Native）を作り、DSN・組織スラッグ・プロジェクト名を控える。設定 → Security & Privacy で **Prevent Storing of IP Addresses** をオン（データの保管地域も、作成時に選ぶ）
- [ ] EAS に環境変数 `EXPO_PUBLIC_SENTRY_DSN`（production）、シークレット `SENTRY_AUTH_TOKEN`（Organization Auth Token。ソースマップのアップロード用）、`SENTRY_ORG`・`SENTRY_PROJECT` を登録（`app.json` の `@sentry/react-native` プラグインに `organization`・`project` を書いてもよい）
- [ ] Sentry のアラートルール「新しい問題が出たらメール通知」を作る（完了条件「クラッシュが通知で届く」）
- [ ] **新しい EAS ビルドが必要**（ネイティブモジュールが増えるため。OTA 更新では入らない）：`npx eas-cli@latest build --profile production --platform ios` → 審査提出
- [ ] 本番ビルドで一度だけテスト送信し、Sentry の画面で内容に記録・メール・ユーザーIDが入っていないことを確認する。**ネイティブのクラッシュ（例：テスト用に `Sentry.nativeCrash()` を一時的に呼ぶ）も1回送り、その内容も確認する**（ネイティブのクラッシュは `beforeSend` を通らず、ネイティブ SDK が直接送るため）
- [ ] `docs/privacy-policy.md` と `web/legal.html` の更新（本 PR で反映済み）を、公開ページに反映する

## F. 計測（公開直後から入れる。README_launch 5章）
- [ ] 分析サービスを選ぶ（PostHog・Amplitude など）。`src/services/analytics.ts` の `send()` を差し替えるか、そのサービスの受け口を `EXPO_PUBLIC_ANALYTICS_ENDPOINT` に立てる
- 送っているイベント：`app_open`（D7・D30のリテンション）、`day_logged`（週の記録日数。ざっくり・写真・文章も含む）、`trial_started`／`purchased`（体験から購入した割合）、`first_training_completed`（初めてトレーニングを完了するまでの日数）

## G. 既知の制約
- 購入・体験の判定は端末側（RevenueCatのSDK）で行う（AIの1日の上限だけサーバーでも最大値で止める）。厳密にするには RevenueCat の webhook が要る
- iPad は未対応（`supportsTablet: false`）
- Android は未検証（iOS 前提）

## Gemini の費用管理（issue #2）
**サーバー側の上限（`supabase/functions/estimate-meal/index.ts`）**
- 1人1日 30回（`DAILY_LIMIT`、日本時間の日付で数える。超えると 429 → アプリは「今日の推定の回数を使い切りました」）。無料の3回は端末側で数える
- 全体 1日 3,000回（`GLOBAL_DAILY_LIMIT`、`supabase secrets set GLOBAL_DAILY_LIMIT=...` で変更）。超えると 503 → アプリは「写真の推定が混み合っています」。文章だけの推定は、端末の成分表照合に切り替わるので止まらない
- 全体上限を入れた理由：個人の上限だけだと、アカウントを大量に作られたときに「ユーザー数 × 30回」まで費用が伸びる。1回あたりは小さい（gemini-flash-lite、入力は写真＋カタログ約2.6千字、出力は短いJSON）ので、3,000回/日でも月の最大は数千円の見込み（**単価は Google の料金表で要確認**）
- 全体の確認が失敗したとき（rpc エラー。マイグレーション未適用など）は、通さずに 503 を返す（fail-closed）。ログに `global quota check failed` が残る。このため `20261002000000_ai_global_quota.sql` は Edge Function のデプロイ前に必ず適用しておく。予算アラート（下）は引き続き二重の備え

**Google Cloud 側（人の作業。アカウントが必要）**
1. Gemini の API キーを作ったプロジェクトを確認する（Google AI Studio → API keys に、キーが属する Cloud プロジェクトが出る）
2. Cloud Console → お支払い → 予算とアラート → 予算を作成：対象はそのプロジェクト、金額は月の許容額（例：¥3,000）、しきい値 50% / 90% / 100%（実績）と 100%（予測）、通知先に自分のメールを追加。お支払いアカウントの管理者・ユーザーにメール通知が届く設定を確認する
3. 予算は「通知だけ」で、自動では止まらない。止めたいときは、API キーを無効化するか、`supabase secrets set GLOBAL_DAILY_LIMIT=0`（0 で全体停止）にする。自動で止めたい場合は、予算アラートを Pub/Sub に流して Cloud Function で課金を無効化する方法があるが、誤作動のリスクがあるので v1.0 では入れない
4. 任意：Cloud Console → API とサービス → Generative Language API → 割り当て（Quotas）で、1日のリクエスト数に上限を付ける（例：5,000/日）。これが課金側の本当の天井になる
5. 確認：予算のしきい値を一時的に低く（例：¥1）して、通知メールが届くことを見てから、元の金額に戻す
