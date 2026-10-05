/**
 * 計測（README_launch 5章）。公開直後から入れる4つの指標のための、名前つきイベント。
 * - 7日後・30日後に使い続けている人の割合（trackAppOpen の daysSinceInstall を、分析側でD7/D30に集計）
 * - 1週間のうち記録した日数（trackDayLogged。「ざっくり」「Pだけ」も記録した日として送る）
 * - 無料体験から購入した人の割合（trackTrialStarted → trackPurchased）
 * - 初めてトレーニングを完了するまでにかかった日数（trackFirstTrainingCompleted）
 *
 * 送り先は既存の Supabase（新しいサービス・アカウント・費用は要らない）。`analytics_events` テーブルへ「追加だけ」できる
 * （supabase/migrations/20261006000000_analytics_events.sql）。
 * - 既定はオフ。設定で本人がオンにしたときだけ送る（`configureAnalytics` で端末のIDを渡されるまで、何も送らない）。
 * - 送るのは端末ごとのランダムなID・イベント名・短い数値／種類だけ。食事・体重・写真・プロフィール・メール・ユーザーIDは送らない。
 *   props は下の許可リストに合う値だけを通す（`buildProps`）。
 */
const URL_BASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const analyticsConfigured = () => !!URL_BASE && !!ANON;

/** 同意してオンのときの、端末ごとのランダムなID。オフ（null）のあいだは何も送らない */
let installId: string | null = null;
export function configureAnalytics(id: string | null) {
  installId = id;
}

const KINDS = ['set', 'search', 'rough', 'text', 'photo'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 通してよい props だけを取り出す（許可リスト）。呼び出し側が余計な項目を渡しても送らない */
export function buildProps(name: string, props?: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const p = props ?? {};
  if ((name === 'app_open' || name === 'first_training_completed') && typeof p.daysSinceInstall === 'number' && Number.isFinite(p.daysSinceInstall)) {
    out.daysSinceInstall = Math.max(0, Math.min(9999, Math.floor(p.daysSinceInstall)));
  }
  if (name === 'day_logged') {
    if (typeof p.date === 'string' && DATE.test(p.date)) out.date = p.date;
    if (typeof p.kind === 'string' && KINDS.includes(p.kind)) out.kind = p.kind;
  }
  if (name === 'purchased' && (p.product === 'full' || p.product === 'ai_plus')) out.product = p.product;
  return out;
}

function send(name: string, props?: Record<string, unknown>) {
  if (!installId || !analyticsConfigured()) return;
  const body = { install_id: installId, name, props: buildProps(name, props) };
  if (__DEV__) console.log('[analytics]', body);
  fetch(`${URL_BASE}/rest/v1/analytics_events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON!, Authorization: `Bearer ${ANON}`, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  }).catch(() => {});
}

/** 起動のたびに送る。分析側で、インストールから7日後・30日後にも開いているかを見る */
export const trackAppOpen = (daysSinceInstall: number) => send('app_open', { daysSinceInstall });

/** 食事を記録した日（種類を問わず、マイセット・検索・ざっくり・AIのどれでも「記録した日」として数える） */
export type LoggedKind = 'set' | 'search' | 'rough' | 'text' | 'photo';
export const trackDayLogged = (date: string, kind: LoggedKind) => send('day_logged', { date, kind });

export const trackTrialStarted = () => send('trial_started');
export const trackPurchased = (product: 'full' | 'ai_plus') => send('purchased', { product });

/** 初めてトレーニングを完了したときに1回だけ送る */
export const trackFirstTrainingCompleted = (daysSinceInstall: number) => send('first_training_completed', { daysSinceInstall });
