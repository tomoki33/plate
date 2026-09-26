import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/**
 * ログイン（Sign in with Apple）とバックアップ／復元（Supabase）。
 * 端末内の SQLite が正で、クラウドはバックアップ。v0.1 は「ログイン時にバックアップと復元」だけ。
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定なら機能ごと無効になる。
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = () => !!SUPABASE_URL && !!SUPABASE_ANON;

export const NOT_CONFIGURED = 'ログインの設定がまだ済んでいません。';

// OAuth のブラウザから戻ったときに、認証セッションを閉じる
WebBrowser.maybeCompleteAuthSession();

/**
 * 開発ビルドで Supabase が未設定のときだけ、通信せずにメールログインの画面の流れを試せる模擬にする
 * （コードは 123456）。本番ビルド・設定済みの環境では使われない。
 */
export const DEV_MOCK = __DEV__ && !supabaseConfigured();
const MOCK_CODE = '123456';

export interface AuthResult {
  /** 模擬のログイン（開発用）だったか */
  mock?: boolean;
  ok: boolean;
  /** 表示するエラー。ユーザーが自分でやめたときは undefined */
  error?: string;
}

// トークンは端末の安全な保管領域に置く（Webは localStorage）
const storage =
  Platform.OS === 'web'
    ? undefined
    : {
        getItem: (k: string) => SecureStore.getItemAsync(k.replace(/[^\w.-]/g, '_')),
        setItem: (k: string, v: string) => SecureStore.setItemAsync(k.replace(/[^\w.-]/g, '_'), v),
        removeItem: (k: string) => SecureStore.deleteItemAsync(k.replace(/[^\w.-]/g, '_')),
      };

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (!client) client = createClient(SUPABASE_URL!, SUPABASE_ANON!, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
  return client;
}

export async function currentSession(): Promise<Session | null> {
  const c = supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

export async function accessToken(): Promise<string | null> {
  return (await currentSession())?.access_token ?? null;
}

/** Sign in with Apple → Supabase の ID トークンでログイン */
export async function signInWithApple(): Promise<AuthResult> {
  const c = supabase();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  if (Platform.OS !== 'ios') return { ok: false, error: 'iOS でのみ使えます' };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    const cred = await Apple.signInAsync({ requestedScopes: [Apple.AppleAuthenticationScope.EMAIL] });
    if (!cred.identityToken) return { ok: false, error: 'Apple から認証情報を受け取れませんでした' };
    const { error } = await c.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, error: code === 'ERR_REQUEST_CANCELED' ? undefined : e instanceof Error ? e.message : String(e) };
  }
}

/** アカウントを削除する（サーバー上のバックアップも一緒に消える）。端末の記録は別。 */
export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const c = supabase();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await c.functions.invoke('delete-account', { method: 'POST' });
  if (error) return { ok: false, error: 'アカウントを削除できませんでした。通信を確かめて、もう一度お試しください。' };
  await signOut();
  return { ok: true };
}

export async function signOut() {
  await supabase()?.auth.signOut();
}

/** Google でログイン：Supabase の OAuth をブラウザで開き、戻ってきたトークンでセッションを作る */
export async function signInWithGoogle(): Promise<AuthResult> {
  const c = supabase();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  try {
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) return { ok: false, error: error?.message ?? 'Google に接続できませんでした' };
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success') return { ok: false }; // 途中でやめた
    const url = new URL(res.url);
    const params = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: e } = await c.auth.setSession({ access_token, refresh_token });
      return e ? { ok: false, error: e.message } : { ok: true };
    }
    const code = url.searchParams.get('code');
    if (code) {
      const { error: e } = await c.auth.exchangeCodeForSession(code);
      return e ? { ok: false, error: e.message } : { ok: true };
    }
    return { ok: false, error: 'ログインの結果を受け取れませんでした' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** メールに6桁のコードを送る（パスワードなし）。Supabase のメールテンプレートに {{ .Token }} を入れておく */
export async function sendEmailCode(email: string): Promise<AuthResult> {
  if (DEV_MOCK) return { ok: true, mock: true };
  const c = supabase();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  if (DEV_MOCK) return code === MOCK_CODE ? { ok: true, mock: true } : { ok: false, error: 'コードが違うか、期限が切れています。' };
  const c = supabase();
  if (!c) return { ok: false, error: NOT_CONFIGURED };
  const { error } = await c.auth.verifyOtp({ email, token: code, type: 'email' });
  return error ? { ok: false, error: friendly(error.message) } : { ok: true };
}

/** Supabase の英語のエラーを、画面に出せる日本語にする */
function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'コードが違うか、期限が切れています。';
  if (m.includes('rate') || m.includes('security purposes') || m.includes('too many')) return 'しばらくしてから、もう一度お試しください。';
  if (m.includes('email')) return 'メールアドレスを確認してください。';
  return '通信できませんでした。もう一度お試しください。';
}

export interface Account {
  userId: string;
  email: string | null;
  /** ログインに使った方法（apple / google / email） */
  provider: string;
}

export const toAccount = (s: Session | null): Account | null => (s ? { userId: s.user.id, email: s.user.email ?? null, provider: s.user.app_metadata?.provider ?? 'email' } : null);

/** ログイン状態の変化を受け取る。返り値で購読を解除する */
export function onAccountChange(cb: (a: Account | null) => void): () => void {
  const c = supabase();
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_e, session) => cb(toAccount(session)));
  return () => data.subscription.unsubscribe();
}
