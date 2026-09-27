import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { N, T, color, font, hairline, lightPalette, radius } from '@/design-system';
import { AppleButton, OutlineAuthButton } from '../components/AuthButtons';
import { CODE_LENGTH, RESEND_SECONDS, isCompleteCode, isValidEmail, normalizeCode, normalizeEmail } from '../domain/auth';
import { sendEmailCode, signInWithApple, signInWithGoogle, verifyEmailCode, type AuthResult } from '../services/supabase';
import { useStore } from '../store/store';

// 起動画面（アプリアイコンを拡大したもの）の続きなので、上の部分はアプリアイコンと同じ色で固定する
const ICON_BG = lightPalette.text;
const ICON_FG = lightPalette.bg;
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

type Step = 'start' | 'email' | 'code';

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
  const setAccount = useStore((s) => s.setAccount);

  const { email: startWithEmail } = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>(startWithEmail ? 'email' : 'start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendLeft, setResendLeft] = useState(0);
  const codeInput = useRef<TextInput>(null);

  // 再送の待ち時間
  useEffect(() => {
    if (resendLeft <= 0) return;
    const id = setTimeout(() => setResendLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [resendLeft]);

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

  const send = async () => {
    if (busy) return;
    if (!isValidEmail(email)) return setError('メールアドレスの形式を確認してください。');
    setBusy(true);
    setError(null);
    const r = await sendEmailCode(normalizeEmail(email));
    setBusy(false);
    if (!r.ok) return setError(r.error ?? null);
    setCode('');
    setStep('code');
    setResendLeft(RESEND_SECONDS);
    setTimeout(() => codeInput.current?.focus(), 100);
  };

  const verify = async (c: string) => {
    if (busy || !isCompleteCode(c)) return;
    setBusy(true);
    setError(null);
    const r = await verifyEmailCode(normalizeEmail(email), c);
    if (!r.ok) setCode('');
    else if (r.mock) setAccount({ userId: 'dev-mock', email: normalizeEmail(email), provider: 'email' });
    finish(r);
  };

  const resend = async () => {
    if (busy || resendLeft > 0) return;
    setBusy(true);
    setError(null);
    const r = await sendEmailCode(normalizeEmail(email));
    setBusy(false);
    if (!r.ok) return setError(r.error ?? null);
    setResendLeft(RESEND_SECONDS);
  };

  const small = step !== 'start';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      {/* 上：黒地。メール入力に進むと縮み、入力欄を広く使う */}
      <View style={[{ backgroundColor: ICON_BG, overflow: 'hidden' }, small ? { height: 150 } : { flex: 1 }]}>
        <View style={{ position: 'absolute', left: '50%', marginLeft: -125, top: small ? -170 : 92, width: 250, height: 250, borderRadius: 125, backgroundColor: lightPalette.brand }} />
        <View style={{ position: 'absolute', left: 0, right: 0, top: small ? 50 : 208, height: 18, backgroundColor: ICON_FG }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: small ? 18 : 36 }}>
          <N size={small ? 28 : 40} w={700} c={ICON_FG} style={{ textAlign: 'center', letterSpacing: small ? 8 : 12, paddingLeft: small ? 8 : 12 }}>
            PLATE
          </N>
        </View>
      </View>

      {step === 'start' && (
        <View style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: Math.max(30, insets.bottom) }}>
          <View style={{ minHeight: error ? 28 : 0 }}>
            {error ? <T size={12} c={color.brandText} style={{ textAlign: 'center', marginBottom: 10 }}>{error}</T> : null}
          </View>
          <AppleButton onPress={() => run(signInWithApple)} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <OutlineAuthButton label="Google" icon="google" onPress={() => run(signInWithGoogle)} />
            <OutlineAuthButton label="メール" icon="mail" onPress={() => { setError(null); setStep('email'); }} />
          </View>
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
      )}

      {step === 'email' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Header onBack={() => { setError(null); setStep('start'); }} n={1} />
          <T size={22} w={900} style={{ paddingHorizontal: 28, marginTop: 6 }}>メールアドレス</T>
          <TextInput
            value={email}
            onChangeText={(v) => { setEmail(v); setError(null); }}
            placeholder="you@example.com"
            placeholderTextColor={color.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={send}
            style={{ marginHorizontal: 20, marginTop: 18, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp, fontSize: 16, color: color.text }}
          />
          <T size={12} c={color.brandText} style={{ paddingHorizontal: 28, paddingTop: 8, minHeight: 26 }}>{error ?? ''}</T>
          <View style={{ flex: 1 }} />
          <BottomButton label="コードを送る" active={email.trim().length > 0 && !busy} onPress={send} bottom={Math.max(34, insets.bottom)} />
        </KeyboardAvoidingView>
      )}

      {step === 'code' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Header onBack={() => { setError(null); setStep('email'); }} n={2} />
          <T size={22} w={900} style={{ paddingHorizontal: 28, marginTop: 6 }}>コードを入力</T>
          <T size={13} c={color.sub} style={{ paddingHorizontal: 28, marginTop: 6 }} numberOfLines={2}>{normalizeEmail(email)} に送りました。</T>
          <Pressable accessibilityLabel="コードを入力" onPress={() => codeInput.current?.focus()} style={{ marginHorizontal: 20, marginTop: 18 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const active = i === Math.min(code.length, CODE_LENGTH - 1);
                return (
                  <View key={i} style={{ flex: 1, height: 60, borderRadius: radius.input, backgroundColor: color.surface, borderWidth: active ? 1.5 : hairline, borderColor: active ? color.text : color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <N size={30} w={600}>{code[i] ?? ''}</N>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={codeInput}
              value={code}
              onChangeText={(v) => {
                const c = normalizeCode(v);
                setCode(c);
                setError(null);
                if (isCompleteCode(c)) void verify(c);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH * 2}
              autoFocus
              caretHidden
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, fontSize: 16 }}
            />
          </Pressable>
          <View style={{ paddingHorizontal: 28, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={12} c={color.brandText} style={{ flex: 1 }}>{error ?? ''}</T>
            <Pressable accessibilityRole="button" onPress={resend} disabled={resendLeft > 0} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
              <T size={12} c={resendLeft > 0 ? color.sub : color.badgeFg} style={{ textDecorationLine: resendLeft > 0 ? 'none' : 'underline' }}>{resendLeft > 0 ? `再送（${resendLeft}）` : '再送'}</T>
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <BottomButton label="ログイン" active={isCompleteCode(code) && !busy} onPress={() => verify(code)} bottom={Math.max(34, insets.bottom)} />
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function Header({ onBack, n }: { onBack: () => void; n: number }) {
  return (
    <View style={{ paddingTop: 12, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ height: 44, justifyContent: 'center' }}>
        <T size={14} c={color.sub}>‹ 戻る</T>
      </Pressable>
      <N size={11} w={500} c={color.sub}>{n} / 2</N>
    </View>
  );
}

/** 入力するまで faint、入力できたら黒（主ボタン） */
function BottomButton({ label, active, onPress, bottom }: { label: string; active: boolean; onPress: () => void; bottom: number }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: bottom }}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !active }} onPress={onPress} style={{ height: 52, borderRadius: radius.button, backgroundColor: active ? color.text : color.faint, alignItems: 'center', justifyContent: 'center' }}>
        <T size={15} w={700} c={color.onText}>{label}</T>
      </Pressable>
    </View>
  );
}
