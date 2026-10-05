/**
 * クラッシュ・不具合の監視（Sentry）。
 * `EXPO_PUBLIC_SENTRY_DSN` が未設定なら、何もしない（初期化も、ネイティブ側の組み込み処理も動かさない）。
 * DSN は「送り先の宛先」で秘密ではないため EXPO_PUBLIC_ で渡す。ソースマップのアップロード用トークン
 * （SENTRY_AUTH_TOKEN）は秘密なので EXPO_PUBLIC_ を付けず、EAS のシークレットにだけ置く。
 *
 * 送る内容は crashScrub.ts で絞る。ここでは、記録やユーザーを送らない設定を重ねて入れる：
 * PII オフ・操作履歴なし・性能計測なし・画面録画／スクリーンショット／画面構造の添付なし。
 */
import * as Sentry from '@sentry/react-native';
import { dropBreadcrumb, scrubEvent } from './crashScrub';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const crashReportingConfigured = () => !!DSN;

export function initCrashReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    // 開発中のエラーは送らない（本番ビルドだけ）
    enabled: !__DEV__,
    sendDefaultPii: false,
    maxBreadcrumbs: 0,
    beforeBreadcrumb: dropBreadcrumb,
    beforeSend: scrubEvent,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableLogs: false,
  });
}

/** ルート画面を包む（未設定のときは包まず、そのまま返す） */
export function withCrashReporting<T extends React.ComponentType<any>>(component: T): T {
  return DSN ? (Sentry.wrap(component) as unknown as T) : component;
}
