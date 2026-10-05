/**
 * クラッシュ報告に載せる内容を、送る直前に絞る（純粋関数。Sentry 本体には依存しない）。
 * 食事・体重・プロフィールなどの記録や、ユーザーを特定できる情報が、エラーの文言・追加情報・
 * 操作履歴・端末名に紛れて外へ出ないよう、残すものを許可リストで決める。
 *
 * 残す：エラーの種類とスタックトレース（どのコードで落ちたか）、アプリ／OS／端末機種の基本情報、
 *       リリース・環境・レベル・イベントID・日時。
 * 消す：ユーザー、リクエスト、エラー文言、メッセージ、追加情報（extra）、タグ、操作履歴、
 *       端末名やサーバー名などの識別子、スペースの記録。
 */
import type { ErrorEvent } from '@sentry/react-native';

const KEEP_CONTEXTS = ['app', 'os', 'device', 'runtime', 'culture'] as const;
const KEEP_DEVICE_KEYS = ['family', 'model', 'model_id', 'brand', 'manufacturer', 'simulator', 'arch', 'memory_size', 'screen_width_pixels', 'screen_height_pixels', 'screen_density'];
const REDACTED = '[redacted]';

type Ctx = Record<string, unknown>;

function pick(src: Ctx | undefined, keys: readonly string[]): Ctx | undefined {
  if (!src) return undefined;
  const out: Ctx = {};
  for (const k of keys) if (src[k] !== undefined) out[k] = src[k];
  return out;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T | null {
  const e = event as unknown as Record<string, unknown>;

  // 識別子・自由記述になりうるものは丸ごと消す
  delete e.user;
  delete e.request;
  delete e.extra;
  delete e.tags;
  delete e.breadcrumbs;
  delete e.server_name;
  delete e.logentry;
  delete e.modules;
  delete e.sdkProcessingMetadata;
  if (e.message !== undefined) e.message = REDACTED;

  // エラー文言は、データベースの値などを含みうるので消す（種類とスタックは残す）
  const exception = e.exception as { values?: Record<string, unknown>[] } | undefined;
  for (const v of exception?.values ?? []) {
    if (v.value !== undefined) v.value = REDACTED;
    delete v.data;
  }

  // スタックのフレームに付く変数・コード片は残さない（ファイル名・関数名・行番号だけ残す）
  for (const v of exception?.values ?? []) {
    const frames = (v.stacktrace as { frames?: Record<string, unknown>[] } | undefined)?.frames ?? [];
    for (const f of frames) {
      delete f.vars;
      delete f.pre_context;
      delete f.context_line;
      delete f.post_context;
    }
  }

  // contexts は許可した種類・項目だけ残す（端末名などの識別子は落とす）
  const ctx = e.contexts as Record<string, Ctx> | undefined;
  if (ctx) {
    const next: Record<string, Ctx> = {};
    for (const k of KEEP_CONTEXTS) {
      if (!ctx[k]) continue;
      next[k] = k === 'device' ? pick(ctx[k], KEEP_DEVICE_KEYS)! : { ...ctx[k] };
    }
    if (next.app) delete next.app.device_app_hash; // 端末を追跡できる識別子
    e.contexts = next;
  }
  return event;
}

/** 操作履歴（ボタン・通信・ログ）は1件も残さない */
export const dropBreadcrumb = () => null;
