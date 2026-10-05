/**
 * クラッシュ報告に載せる内容を、送る直前に絞る（純粋関数。Sentry 本体には依存しない）。
 * 食事・体重・プロフィールなどの記録や、ユーザーを特定できる情報が、エラーの文言・追加情報・
 * 操作履歴・端末名に紛れて外へ出ないよう、元のイベントから消すのではなく、
 * **許可した項目だけで新しいイベントを作る**（SDK に新しい項目が増えても、勝手には出ない）。
 *
 * 残す：エラーの種類とスタックの位置（ファイル・関数・行）、アプリのバージョン、OS・端末の機種、
 *       リリース・環境・レベル・イベントID・日時・SDK名。
 * 残さない：上記以外のすべて（ユーザー、リクエスト、エラー文言、メッセージ、extra、タグ、操作履歴、
 *       スレッド、トランザクション、フィンガープリント、端末名、ロケール、タイムゾーンなど）。
 *
 * 注意：JS から渡せない都合で、`beforeSend` は JS 側で処理されたイベントにだけ効く。
 * ネイティブのクラッシュは、ネイティブ SDK が直接送る（このフィルタは通らない）。
 */
import type { ErrorEvent } from '@sentry/react-native';

const REDACTED = '[redacted]';

type Rec = Record<string, unknown>;

const EVENT_KEYS = ['event_id', 'level', 'platform', 'timestamp', 'release', 'dist', 'environment'];
const EXCEPTION_KEYS = ['type', 'module', 'thread_id'];
const MECHANISM_KEYS = ['type', 'handled', 'synthetic', 'source', 'is_exception_group', 'exception_id', 'parent_id'];
const FRAME_KEYS = ['filename', 'abs_path', 'function', 'module', 'lineno', 'colno', 'in_app', 'platform', 'package', 'instruction_addr', 'image_addr', 'symbol_addr'];
const SDK_KEYS = ['name', 'version'];
// contexts は、種類ごとに残す項目も決める（device_app_hash・端末名・ロケール・タイムゾーン・メモリ量などは残さない）
const CONTEXT_KEYS: Record<string, string[]> = {
  app: ['app_version', 'app_build', 'app_identifier', 'app_name'],
  os: ['name', 'version', 'build'],
  device: ['family', 'model', 'model_id', 'brand', 'manufacturer', 'simulator', 'arch'],
};

function pick(src: unknown, keys: string[]): Rec {
  const out: Rec = {};
  if (!src || typeof src !== 'object') return out;
  for (const k of keys) if ((src as Rec)[k] !== undefined) out[k] = (src as Rec)[k];
  return out;
}

export function scrubEvent<T extends ErrorEvent>(event: T): T | null {
  const src = event as unknown as Rec;
  const out: Rec = pick(src, EVENT_KEYS);

  // メッセージ・エラー文言は、データベースの値などを含みうるので、中身は送らない（種類とスタックは残す）
  if (src.message !== undefined) out.message = REDACTED;
  const values = (src.exception as { values?: unknown[] } | undefined)?.values;
  if (Array.isArray(values)) {
    out.exception = {
      values: values.map((v) => {
        const ex = pick(v, EXCEPTION_KEYS);
        if ((v as Rec).value !== undefined) ex.value = REDACTED;
        const mech = (v as Rec).mechanism;
        if (mech) ex.mechanism = pick(mech, MECHANISM_KEYS);
        const frames = ((v as Rec).stacktrace as { frames?: unknown[] } | undefined)?.frames;
        if (Array.isArray(frames)) ex.stacktrace = { frames: frames.map((f) => pick(f, FRAME_KEYS)) };
        return ex;
      }),
    };
  }

  const ctx = src.contexts as Record<string, unknown> | undefined;
  if (ctx) {
    const contexts: Record<string, Rec> = {};
    for (const [name, keys] of Object.entries(CONTEXT_KEYS)) if (ctx[name]) contexts[name] = pick(ctx[name], keys);
    out.contexts = contexts;
  }
  if (src.sdk) out.sdk = pick(src.sdk, SDK_KEYS);

  return out as unknown as T;
}

/** 操作履歴（ボタン・通信・ログ）は1件も残さない */
export const dropBreadcrumb = () => null;
