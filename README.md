# PLATE

トレ連動PFCアプリ。「今日のトレで、今日の一皿が決まる。」
筋トレ記録とPFC管理を1本にまとめ、トレの内容に合わせて毎日の食事目標が自動で変わる iOS アプリ（Expo / React Native）。

デザインの元資料は `design_handoff_plate/`（README・試作HTML・設計書PDF）。

## 開発

```bash
npm install
npx expo start        # 実機は Expo Go、または dev build
npm test              # 目標エンジンのテスト
npm run typecheck
node scripts/make-icons.mjs   # assets/brand/*.svg からアイコンPNGを再生成
```

## 構成

| パス | 内容 |
|---|---|
| `src/domain/` | 純粋なロジック。`engine.ts`（目標エンジン）、`training.ts`（ボリューム・推定1RM・日タイプ判定）、`foods.ts`（食品・マイセット）、`estimate.ts`（文章→食品の推定） |
| `src/store/` | Zustand。`store.ts`（状態と操作）、`selectors.ts`（週・今日の派生値）、`storage.ts`（expo-sqlite kv-store で永続化。Webは localStorage） |
| `src/design-system/` | トークン（色・角丸・フォント）と共通コンポーネント（`T`/`N`/`Badge`/ボタン/`Bar`/`Sheet`）。画面は `@/design-system` からだけ import する |
| `src/components/` | アプリ固有の部品（食事記録シート／AI推定の確認、体重シート、トースト、タブアイコン） |
| `src/app/(tabs)/` | 今日／トレ／レビュー／設定（expo-router） |

## 現状と未対応

- 目標エンジン・4タブ・食事記録（マイセット／検索／文章）・AI推定の確認・トレ記録（休憩タイマー、完了画面）・体重・レビュー・係数設定まで動く。データは端末内に保存。
- **文章入力の推定はローカルの成分表照合**（`estimate.ts`）。LLM に差し替えるときは同じ戻り値の関数にする。確認画面は必ず挟む。
- **食品は成分表（八訂）の抜粋 14 品**。全件の取り込みは未対応。
- 設計書のスタックにある **Drizzle / 正規化した SQLite テーブル（`day_target` の再配分履歴など）は未対応**。現状は kv-store に JSON で保存。
- 週間スケジュールの編集、課金（無料3回／有料30回の上限は表示のみ）、アプリ名の商標・App Store 重複確認は未対応。
- 設計書PDFはこの環境で読めなかったため、README と試作HTMLを仕様として実装した。

## デザインシステムの運用

- 色・余白・フォントは `src/design-system/tokens.ts` にだけ書く。画面に色コードを直書きしない。
- ストアなどアプリのロジックに依存する部品は `src/components/` に置き、デザインシステムには入れない。
- 別アプリや Web で共有する必要が出たら、`packages/design-system` に移し、`tsconfig.json` の `paths`（`@/design-system`）の向き先を変える。
