import { BarlowSemiCondensed_500Medium, BarlowSemiCondensed_600SemiBold, BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { NotoSansJP_400Regular, NotoSansJP_500Medium, NotoSansJP_700Bold, NotoSansJP_900Black } from '@expo-google-fonts/noto-sans-jp';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastHost } from '../components/Toast';
import { color } from '../theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    NotoSansJP_400Regular,
    NotoSansJP_500Medium,
    NotoSansJP_700Bold,
    NotoSansJP_900Black,
    BarlowSemiCondensed_500Medium,
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: color.bg }}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }} />
        <ToastHost />
      </View>
    </SafeAreaProvider>
  );
}
