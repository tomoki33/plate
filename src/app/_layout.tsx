import { BarlowSemiCondensed_500Medium, BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { NotoSansJP_400Regular, NotoSansJP_500Medium, NotoSansJP_700Bold, NotoSansJP_900Black } from '@expo-google-fonts/noto-sans-jp';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { LogBox, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import migrations from '../../drizzle/migrations';
import { initDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { OfflineBanner } from '../components/OfflineBanner';
import { ToastHost } from '../components/Toast';
import { T, applyScheme, color, lightPalette } from '@/design-system';
import { checkEntitlements, identifyBilling, initBilling } from '../services/billing';
import { trackAppOpen } from '../services/analytics';
import { planOf } from '../domain/entitlement';
import { readBodyComposition } from '../services/healthkit';
import { currentSession, onAccountChange, toAccount } from '../services/supabase';
import { maybeAutoSample } from '../dev/sampleData';
import { useCoachSync } from '../features/coach/useCoachSync';
import { runBackup } from '../store/backupRunner';
import { useCoach } from '../store/coachStore';
import { useStore } from '../store/store';

// 起動画面は、準備（フォント・DB・ログイン状態の確認）が終わるまで出したままにする
void SplashScreen.preventAutoHideAsync().catch(() => {});

// グラフ用ライブラリが Web だけで出す開発用の警告（動作には影響しない）。Web の開発画面で赤く出ないようにする
if (Platform.OS === 'web') {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Unknown event handler property')) return;
    original(...args);
  };
}
LogBox.ignoreLogs(['props.pointerEvents is deprecated', 'shadow*']);

/** DB を開いてから本体を出す（Web は非同期で開く必要がある） */
export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  useEffect(() => {
    initDb()
      .then(() => runMigrations(migrations))
      .then(() => setDbReady(true), (e) => setDbError(e instanceof Error ? e.message : String(e)));
  }, []);
  if (dbError) return <ErrorView message={dbError} />;
  if (!dbReady) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return <App />;
}

function ErrorView({ message }: { message: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, padding: 24, justifyContent: 'center' }}>
      <T size={16} w={700}>データベースを開けませんでした</T>
      {/Access Handle|NoModificationAllowed/i.test(message) && (
        <T size={13} style={{ marginTop: 10, lineHeight: 21 }}>
          このアプリを開いているほかのタブがあります。ほかのタブをすべて閉じてから、このページを再読み込みしてください。（Web版は、データを保存するファイルを1つのタブしか開けません）
        </T>
      )}
      <T size={11} c={color.sub} style={{ marginTop: 8 }}>{message}</T>
    </View>
  );
}

function App() {
  const router = useRouter();
  // 配色（ライト／ダーク）は端末の設定に従う。切り替わったら画面を作り直して、色を読み直す
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  applyScheme(scheme);
  const [fontsLoaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_700Bold,
    NotoSansJP_900Black,
    BarlowSemiCondensed_500Medium,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });
  const ready = useStore((s) => s.ready);
  const bootError = useStore((s) => s.bootError);
  const onboarded = useStore((s) => s.profile.onboarded);
  const bootstrap = useStore((s) => s.bootstrap);
  const applyEntitlements = useStore((s) => s.applyEntitlements);
  const setAccount = useStore((s) => s.setAccount);
  const authChecked = useStore((s) => s.authChecked);
  const loginDone = useStore((s) => s.loginSkipped || !!s.account);
  const account = useStore((s) => s.account);
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const healthSync = useStore((s) => s.healthSync);
  const showToast = useStore((s) => s.showToast);
  const setWeight = useStore((s) => s.setWeight);
  const trialStartedAt = useStore((s) => s.trialStartedAt);
  const paid = useStore((s) => s.paid);
  const trialEndedSeen = useStore((s) => s.trialEndedSeen);
  const firstOpenAt = useStore((s) => s.firstOpenAt);
  const prevAccount = useRef<string | null | undefined>(undefined);
  const trialEndedShown = useRef(false);
  const appOpenTracked = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // 起動のたびに1回、計測を送る（D7・D30のリテンションの材料。README_launch 5章）
  useEffect(() => {
    if (!ready || firstOpenAt === null || appOpenTracked.current) return;
    appOpenTracked.current = true;
    trackAppOpen(Math.max(0, Math.floor((Date.now() - firstOpenAt) / 86400000)));
  }, [ready, firstOpenAt]);

  // 課金の権利は起動時に確認する（キーが未設定なら何もしない）
  useEffect(() => {
    if (!ready) return;
    initBilling();
    void checkEntitlements().then((e) => {
      if (e.trialStartedAt !== null || e.paid || e.aiPlus) applyEntitlements(e);
    });
  }, [ready, applyEntitlements]);

  // ログイン状態は、起動時に一度確かめ、そのあとの変化（ログイン・ログアウト）も受け取る
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void currentSession().then((s) => {
      if (!alive) return;
      const a = toAccount(s);
      setAccount(a);
      void identifyBilling(a?.userId ?? null);
    });
    const off = onAccountChange((a) => {
      setAccount(a);
      void identifyBilling(a?.userId ?? null);
    });
    return () => {
      alive = false;
      off();
    };
  }, [ready, setAccount]);

  // ログイン中は、1日に1回、自動でバックアップする。
  // 初回のオンボーディングが済むまでは始めない：新しい端末でログインした直後は端末が空なので、
  // ここで上書きすると、クラウドにある既存のバックアップ（復元したいもの）が消えてしまう。
  useEffect(() => {
    if (!authChecked) return;
    const id = account?.userId ?? null;
    if (prevAccount.current !== undefined && prevAccount.current === null && id && onboarded) showToast('ログインしました。バックアップを始めます');
    prevAccount.current = id;
    if (id && onboarded && (!lastBackupAt || Date.now() - lastBackupAt > 20 * 3600_000)) void runBackup();
  }, [authChecked, account, onboarded, lastBackupAt, showToast]);

  // 開発用：サンプルの自動投入（EXPO_PUBLIC_AUTO_SAMPLE=1 のときだけ）
  useEffect(() => {
    if (authChecked) void maybeAutoSample().then((inserted) => inserted && router.replace('/'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]);

  // ヘルスケア連携がオンなら、起動時に体重を取り込む（手入力の日は上書きしない）
  useEffect(() => {
    if (!ready || !healthSync) return;
    void readBodyComposition(30).then((r) => r.rows.forEach((x) => setWeight(x.date, x.kg, { source: 'healthkit', bodyFat: x.bodyFatPct, silent: true })));
  }, [ready, healthSync, setWeight]);

  // コーチモード：オン／オフと最後のモードを読み込む（読み込むまで、どちらの画面で開くか決められない）
  const coachHydrated = useCoach((s) => s.hydrated);
  useEffect(() => {
    if (ready) void useCoach.getState().hydrate();
  }, [ready]);
  useCoachSync(ready && coachHydrated);

  const loaded = fontsLoaded && ready && authChecked && coachHydrated;
  useEffect(() => {
    if (loaded || bootError) void SplashScreen.hideAsync().catch(() => {});
  }, [loaded, bootError]);

  // 無料体験が終わった日（19c）：アプリを開いたときに1回だけ出す
  useEffect(() => {
    if (!loaded || !onboarded || trialEndedSeen || trialEndedShown.current) return;
    if (planOf(Date.now(), trialStartedAt, paid) === 'view_only') {
      trialEndedShown.current = true;
      router.push('/trial-ended');
    }
  }, [loaded, onboarded, trialEndedSeen, trialStartedAt, paid, router]);

  if (bootError) return <ErrorView message={bootError} />;
  // 起動画面（黒地）の続きに見えるよう、準備中は黒地のままにする
  if (!loaded) return <View style={{ flex: 1, backgroundColor: lightPalette.text }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View key={scheme} style={{ flex: 1, backgroundColor: color.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(coach)" />
            <Stack.Screen name="coach-join" options={{ presentation: 'modal' }} />
            <Stack.Screen name="coach-link" options={{ presentation: 'modal' }} />
            <Stack.Screen name="weight" />
            <Stack.Screen name="template/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="my-foods" options={{ presentation: 'modal' }} />
            <Stack.Screen name="my-sets" options={{ presentation: 'modal' }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            <Stack.Screen name="data" options={{ presentation: 'modal' }} />
            <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
            <Stack.Screen name="trial-ended" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          </Stack.Protected>
          {/* ログイン（初回）→ オンボーディング → 本体。ログイン画面は、設定からも開ける */}
          <Stack.Protected guard={!onboarded && loginDone}>
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          </Stack.Protected>
          <Stack.Protected guard={onboarded || !loginDone}>
            <Stack.Screen name="login" options={{ presentation: onboarded ? 'modal' : 'card', animation: onboarded ? 'default' : 'fade', gestureEnabled: onboarded }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
        <OfflineBanner />
      </View>
    </SafeAreaProvider>
  );
}
