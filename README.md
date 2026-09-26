# PLATE

トレ連動PFCアプリ。「今日のトレで、今日の一皿が決まる。」
筋トレ記録とPFC管理を1本にまとめ、トレの内容に合わせて毎日の食事目標が自動で変わる iOS アプリ（Expo / React Native）。

仕様の正は設計書（`design_handoff_plate/spec/トレ連動PFCアプリ 設計書.pdf`）。UI とブランドは `design_handoff_plate/README.md` と試作HTML。

## 開発

```bash
npm install
npx expo start          # 実機は Expo Go。HealthKit・課金は開発ビルドが必要（下記）
npm run web             # Web でプレビュー（http://localhost:8080。確認用で、本番の対象は iOS）
npm test                # ドメインのテスト
npm run typecheck
```

- **Web プレビューは `npm run web` で起動する。** Web 版の SQLite は SharedArrayBuffer が必要で、ページ本体に COOP/COEP ヘッダーが要る。Expo の開発サーバーは HTML にそれを付けられないので、`scripts/web-dev.mjs` が付けて中継する。
- 開発ビルド: `npx eas-cli build --profile development --platform ios`（実機）または `development-simulator`。HealthKit・RevenueCat・Apple サインインは Expo Go では動かない。
- 環境変数は `.env.example` を `.env.local` にコピーして埋める。**どれも未設定でも動く**（課金・ログイン・AI は無効になり、AI入力は成分表との照合で推定する）。

## 構成

| パス | 内容 |
|---|---|
| `src/app/` | 画面（expo-router）。`(tabs)/` が今日・トレ・レビュー・設定。`login`、`onboarding`、`paywall`、`data`、`my-foods`、`my-sets`、`template/[id]` |
| `src/domain/` | 純粋なロジック（React・Expo に依存しない。テストの中心）。`engine.ts` 目標エンジン、`nutrition.ts` プロフィール→TDEE→週合計・ペース・警告・実データ補正、`training.ts` ボリューム・推定1RM、`foodSearch.ts` 食品検索と別名辞書、`entitlement.ts` 無料／有料、`review.ts` 週次集計、`defaults.ts` 初期の種目とテンプレート |
| `src/db/` | SQLite + Drizzle。`schema.ts`（設計書のテーブル）、`client.ts`、`migrate.ts`、`seed.ts`（成分表・種目などの初期投入）、`repo.ts`（読み書き） |
| `src/store/` | Zustand。`store.ts`（状態と操作。変更は SQLite に書き込む）、`selectors.ts`（週・今日の派生値） |
| `src/services/` | 外部連携。`healthkit.ts`、`billing.ts`（RevenueCat）、`supabase.ts`（Sign in with Apple）、`backup.ts`、`ai.ts`（AI入力）、`exportCsv.ts` |
| `src/design-system/` | 色（ライト／ダーク）・角丸・フォントのトークンと共通部品。画面は `@/design-system` からだけ import する |
| `src/components/` | アプリ固有の部品（食事記録シート、種目ピッカー、体重シート、トースト、タブアイコン） |
| `src/data/foods.json` | 日本食品標準成分表（八訂）の全2,478品目。`scripts/build-foods.py` で生成 |
| `drizzle/` | マイグレーション（`npx drizzle-kit generate` で生成） |
| `supabase/` | バックアップ用テーブルとAI入力の Edge Function のソース |
| `scripts/` | アイコン生成、成分表の変換、Web プレビュー |

## 設計書との対応

**できているもの**
- 目標エンジン（式1〜5）：プロフィール→TDEE（Mifflin-St Jeor×活動係数）→週合計、日タイプ配分、PFC分解、週内の再配分（±10%で止める）。摂取実績の過不足も残りの日に配る。3週目以降は直近14日の実データでTDEEを補正（前回値との加重平均）。極端な減量の警告（1%/週・基礎代謝の下限）。
- 端末内SQLite（Drizzle）に、設計書のテーブルと、全テーブルの id(UUID)・updated_at・deleted_at。`day_target` に再配分の履歴、`meal_entry` に記録時の値のスナップショット。
- 成分表（全2,478品目）の検索。「鶏むね」「ごはん」など日常の言い方の別名辞書つき。マイ食品、成分表示からの手入力。
- 食事記録：マイセット（時間帯の候補が上、最近使った順）／検索／文章入力、AI推定の確認画面、AI推定の印、1日の回数上限。
- トレ記録：テンプレート編集、約80種目（81）、前回値、RIR、セット追加・削除、種目追加、フリートレ、休憩タイマー、履歴。完了画面の「あとP◯g・C◯g」と、日タイプが変わったときの再配分の通知。
- 体重の7日移動平均、Apple ヘルスケアの読み込み（コードのみ）、週次レビュー（推定1RM・体重トレンド・平均PFC・種目別グラフ、無料は直近2週）。
- 設定：目的・ペース、基本情報、係数、週間スケジュール、テンプレート、マイ食品。
- 無料／有料の機能差、14日の無料体験、CSV書き出し、データ削除、ダークモード。
- ログイン画面（`design_handoff_plate 2` の案11c）：Apple／Google／メール（6桁コード）／「ログインせずに始める」。起動画面（`assets/splash-login.png`）からそのまま続いて見える。ログインせずに始めても全機能をローカルで使え、あとから設定で「ログイン」できる。ログイン済みで別端末にバックアップがあれば、オンボーディングで復元できる。

**設定が要る・未検証のもの**（コードはあるが、鍵・アカウント・実機がないので動作確認していない）
- **Supabase**（ログイン・バックアップ）：`supabase/migrations/0001_backups.sql` を適用し、`.env.local` に URL とキーを入れる。ログイン方法ごとの設定：
  - **Apple**：Authentication → Providers で Apple を有効にする（iOS のネイティブの ID トークンで `signInWithIdToken`）。
  - **Google**：Providers で Google を有効にし、Redirect URLs に `plate://auth-callback`（開発中は Expo の URL）を追加する。ブラウザで OAuth を開いて戻る方式。
  - **メール（6桁コード）**：Email Templates の「Magic Link」テンプレートに `{{ .Token }}` を入れる（リンクではなくコードが届く）。
- **AI入力**：`supabase/functions/estimate-meal` をデプロイ（`ANTHROPIC_API_KEY` を secrets に）。1日30回の上限はサーバー側で止める。無料の3回は端末側で数えている（無料／有料のサーバー判定には RevenueCat の webhook が要る。未対応）。原価の実測は未実施（設計書の未決事項）。
- **RevenueCat**：Entitlement `plate_pro` と月額／年額の商品を作り、公開SDKキーを `.env.local` に。
- **HealthKit**：開発ビルドで動作確認が必要。
- 利用規約・プライバシーポリシーのURL（`EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL`）、アプリ名の商標・App Store 重複確認、成分表の利用条件と出典表記の確認は、公開前に必要（設計書の未決事項）。

**確認した範囲**
- ドメインのテスト（エンジン・栄養・検索・レビュー・課金判定・CSV・初期データ）と型チェック。
- iOS / Web のバンドル。
- Web（ヘッドレス Chrome）で、初回のオンボーディング→今日→食事記録（検索・文章入力・確認）→トレの記録と完了→予定外の日タイプでの再配分→レビュー（グラフ）→設定→プラン、ライト／ダークまで通しで操作。
- **iOS 実機・シミュレータでは未確認。**

## 既知の点
- Web 版でグラフ用ライブラリが出す開発用の警告（`Unknown event handler property`）は、Web の開発画面では非表示にしている。ネイティブでは出ない。
- 週間スケジュールの日タイプは、テンプレートの既定値。個別の日だけ変えたいときは、トレタブの「予定を変える」「今日は休む」を使う。
- 開発ビルドでは、データ画面に「サンプルデータを入れる（5週間分）」が出る。本番ビルドには出ない。
- 開発ビルドで Supabase が未設定のときだけ、メールログインは通信せずに模擬で通る（コード `123456`）。画面の流れを試すためで、設定済みの環境や本番では使われない。
- 起動画面の全画面表示は、Expo の `enableFullScreenImage_legacy`（将来なくなる予定の指定）を使っている。

## デザインシステムの運用
- 色・余白・フォントは `src/design-system/tokens.ts` にだけ書く。画面に色コードを直書きしない（ライト／ダークで切り替わる）。
- ストアなどアプリのロジックに依存する部品は `src/components/` に置き、デザインシステムには入れない。
- 別アプリや Web で共有する必要が出たら、`packages/design-system` に移し、`tsconfig.json` の `paths`（`@/design-system`）の向き先を変える。
