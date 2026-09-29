import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { N, T, color, lightPalette } from '@/design-system';
import { AppleButton } from '../components/AuthButtons';
import { signInWithApple, type AuthResult } from '../services/supabase';
import { useStore } from '../store/store';

// 起動画面（アプリアイコンを拡大したもの）の続きなので、上の部分はアプリアイコンと同じ色で固定する
const ICON_BG = lightPalette.text;
const ICON_FG = lightPalette.bg;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

/**
 * ログイン（初回起動時）＝ 11c。
 * 上は黒地に、コーラルの丸・横線・ワードマークだけ（文字は PLATE のほかに入れない）。下に操作。
 * 「ログインせずに始める」を必ず置く：記録は端末に保存され、すべての機能をローカルで使える。
 */
export default function Login() {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const insets = useSafeAreaInsets();
  const onboarded = useStore((s) => s.profile.onboarded);
  const skipLogin = useStore((s) => s.skipLogin);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = (r: AuthResult) => {
    setBusy(false);
    if (!r.ok) return setError(r.error ?? null);
    setError(null);
    // 設定から開いたときは戻る。初回は、ログイン状態が変わると自動でオンボーディングへ進む
    if (onboarded) goBack();
  };

  const run = async (fn: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    finish(await fn());
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {/* 上：黒地 */}
      <View style={{ backgroundColor: ICON_BG, overflow: 'hidden', flex: 1 }}>
        <View style={{ position: 'absolute', left: '50%', marginLeft: -125, top: 92, width: 250, height: 250, borderRadius: 125, backgroundColor: lightPalette.brand }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: 208, height: 18, backgroundColor: ICON_FG }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 36 }}>
          <N size={40} w={700} c={ICON_FG} style={{ textAlign: 'center', letterSpacing: 12, paddingLeft: 12 }}>
            PLATE
          </N>
        </View>
      </View>

      <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: Math.max(30, insets.bottom) }}>
        <View style={{ minHeight: error ? 28 : 0 }}>
          {error ? <T size={12} c={color.brandText} style={{ textAlign: 'center', marginBottom: 10 }}>{error}</T> : null}
        </View>
        <AppleButton onPress={() => run(signInWithApple)} />
        <Pressable
          accessibilityRole="button"
          onPress={() => (onboarded ? goBack() : skipLogin())}
          style={{ height: 44, marginTop: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <T size={13} c={color.badgeFg} style={{ textDecorationLine: 'underline' }}>{onboarded ? '閉じる' : 'ログインせずに始める'}</T>
        </Pressable>
        <T size={10.5} c={color.sub} style={{ textAlign: 'center', lineHeight: 17, marginTop: 4 }}>
          続けると
          <T size={10.5} c={color.sub} style={{ textDecorationLine: 'underline' }} onPress={TERMS_URL ? () => Linking.openURL(TERMS_URL) : undefined}>利用規約</T>
          と
          <T size={10.5} c={color.sub} style={{ textDecorationLine: 'underline' }} onPress={PRIVACY_URL ? () => Linking.openURL(PRIVACY_URL) : undefined}>プライバシーポリシー</T>
          に同意したことになります。
        </T>
      </View>
    </View>
  );
}
