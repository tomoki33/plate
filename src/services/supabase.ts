import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * ログイン（Sign in with Apple）とバックアップ／復元（Supabase）。
 * 端末内の SQLite が正で、クラウドはバックアップ。v0.1 は「ログイン時にバックアップと復元」だけ。
 * EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定なら機能ごと無効になる。
 */
const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = () => !!URL && !!ANON;

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
  if (!client) client = createClient(URL!, ANON!, { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } });
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
export async function signInWithApple(): Promise<{ ok: boolean; error?: string }> {
  const c = supabase();
  if (!c) return { ok: false, error: 'Supabase が設定されていません' };
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

export async function signOut() {
  await supabase()?.auth.signOut();
}
