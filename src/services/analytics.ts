/**
 * 計測（README_launch 5章）。公開直後から入れる4つの指標のための、名前つきイベント。
 * - 7日後・30日後に使い続けている人の割合（trackAppOpen の daysSinceInstall を、分析側でD7/D30に集計）
 * - 1週間のうち記録した日数（trackDayLogged。「ざっくり」「Pだけ」も記録した日として送る）
 * - 無料体験から購入した人の割合（trackTrialStarted → trackPurchased）
 * - 初めてトレーニングを完了するまでにかかった日数（trackFirstTrainingCompleted）
 *
 * 分析サービスはまだ決まっていない。`EXPO_PUBLIC_ANALYTICS_ENDPOINT` が設定されていれば、
 * そこにイベントをPOSTする。未設定のあいだは開発用に console.log するだけ（本番でも送信はしない）。
 * サービスが決まったら、この下の `send()` の中身だけ差し替える（呼び出し側の変更は不要）。
 */
const ENDPOINT = process.env.EXPO_PUBLIC_ANALYTICS_ENDPOINT;

export const analyticsConfigured = () => !!ENDPOINT;

function send(name: string, props?: Record<string, unknown>) {
  if (__DEV__) console.log('[analytics]', name, props ?? {});
  if (!ENDPOINT) return;
  fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, props, at: Date.now() }) }).catch(() => {});
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
