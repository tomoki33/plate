import { BarlowSemiCondensed_500Medium, BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { NotoSansJP_400Regular, NotoSansJP_500Medium, NotoSansJP_700Bold, NotoSansJP_900Black } from '@expo-google-fonts/noto-sans-jp';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { LogBox, Platform, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import migrations from '../../drizzle/migrations';
import { initDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { ToastHost } from '../components/Toast';
import { T, applyScheme, color } from '@/design-system';
import { checkPaid, initBilling } from '../services/billing';
import { useStore } from '../store/store';

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
      <T size={12} c={color.sub} style={{ marginTop: 8 }}>{message}</T>
    </View>
  );
}

function App() {
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
  const setPaid = useStore((s) => s.setPaid);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // 課金の権利は起動時に確認する（キーが未設定なら何もしない）
  useEffect(() => {
    if (!ready) return;
    initBilling();
    void checkPaid().then((paid) => {
      if (paid) setPaid(true);
    });
  }, [ready, setPaid]);

  if (bootError) return <ErrorView message={bootError} />;
  if (!fontsLoaded || !ready) return <View style={{ flex: 1, backgroundColor: color.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View key={scheme} style={{ flex: 1, backgroundColor: color.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="template/[id]" options={{ presentation: 'modal' }} />
            <Stack.Screen name="my-foods" options={{ presentation: 'modal' }} />
            <Stack.Screen name="my-sets" options={{ presentation: 'modal' }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            <Stack.Screen name="data" options={{ presentation: 'modal' }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
      </View>
    </SafeAreaProvider>
  );
}
