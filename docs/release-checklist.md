# 公開までのチェックリスト

コードでできる部分は済んでいます。下の **あなたの作業** を上から順に進めると、TestFlight → App Store まで行けます。

## A. 事前（登録・準備）
- [ ] Apple Developer Program に登録（個人。年 $99）
- [ ] 「PLATE」の名前の重複・商標を確認（App Store 内検索、J-PlatPat）。使えなければ表示名だけ変える（`app.json` の `name`。bundle id は変えなくてよい）
- [ ] 連絡先メール（サポート用）を用意
- [ ] プライバシーポリシー／利用規約を `docs/` から公開（GitHub Pages など。URLが取れればよい）
- [ ] `docs/*.md` の `【 】` を埋める

## B. 外部サービス（アカウントが必要）
1. **Supabase**（無料枠で可）
   - プロジェクト作成 → SQL Editor で `supabase/migrations/0001_backups.sql` と `0002_meal_photos.sql`（写真の保管領域）を実行
   - Authentication → Providers：Apple・Email（OTP）を有効化。Google を使うなら Google も（使わないなら `AuthButtons` から外す）
   - `supabase functions deploy estimate-meal` / `delete-account`
   - `supabase secrets set ANTHROPIC_API_KEY=...`
2. **RevenueCat**（無料枠で可）
   - App Store Connect で購読商品（月額・年額）を作成 → RevenueCat に登録
   - Entitlement 名は `plate_pro`。Offering に月額・年額を入れる
3. **環境変数**（`.env.example` 参照。EAS では `eas env:create` か `eas.json` の env）
   - `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_AI_ENDPOINT`
   - `EXPO_PUBLIC_REVENUECAT_IOS_KEY`（変数名は `.env.example` を確認）
   - `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL`
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
  - 利用目的：アプリの機能。**トラッキングには使わない**（ATT 不要）
  - ユーザーに紐づく／紐づかない は、バックアップ・ログイン分は「紐づく」
- **審査メモ**（下記をそのまま貼る）
  > ログインなしで全機能の確認ができます（初回のログイン画面で「あとで」を選択）。有料プランは14日間の無料体験から始まります。ヘルスケアは体重・体脂肪率の読み込みのみです。アカウント削除は「設定 → データ → アカウントを削除」にあります。
- **サポートURL**：連絡先を載せたページ（GitHub Pages で可）
- **スクリーンショット**：6.9インチ（iPhone 16/17 Pro Max 相当）で、今日／トレーニング記録／レビュー／体重／AI確認の5〜6枚。表示は `EXPO_PUBLIC_AUTO_SAMPLE=1` のサンプルデータで撮る
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
- [ ] 起動 → スプラッシュ → ログイン画面 →「あとで」→ オンボーディング → 今日の画面
- [ ] SQLite（ネイティブ）でデータが保存・再起動後も残る／マイグレーション
- [ ] カメラ・写真の許可ダイアログの文言／撮影 → AI推定 → 確認画面 → 記録／写真がサムネイルに出る
- [ ] キーボード：グラム入力・メモ・ログインのメール入力でボタンが隠れない
- [ ] 下端／ノッチの余白（ホームバーとタブバー、シート）
- [ ] ダークモード切り替え（設定 → 端末の外観）
- [ ] Apple ログイン／メールコード／ログアウト／アカウント削除
- [ ] バックアップ → アプリ削除 → 入れ直して復元（**写真も戻ること**。Supabase の Storage に `meal-photos/<user_id>/` ができる）
- [ ] アカウント削除で、Storage の写真も消えること
- [ ] ヘルスケア：許可 → 体重の取り込み（重複しない）
- [ ] CSV の書き出し（共有シート）
- [ ] 購読：サンドボックスで購入・復元・体験→有料の切り替え、`plate_pro` の反映
- [ ] 機内モード：AI 以外は普通に動く／AI は分かりやすいエラー
- [ ] 日付またぎ（0時）／過去日の編集／週の切り替え
- [ ] 文字サイズを大きくしても崩れない（設定 → アクセシビリティ）

## F. 既知の制約
- 無料／有料の判定は端末側で行う（AIの1日の上限だけサーバーでも最大値で止める）。厳密にするには RevenueCat の webhook が要る
- iPad は未対応（`supportsTablet: false`）
- Android は未検証（iOS 前提）
