import { useNetworkState } from 'expo-network';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/design-system';

/**
 * オフラインのとき、上に黒い帯で1回だけ知らせる（README_launch 19e）。
 * 行き止まりの画面は作らない：記録はもともと端末のSQLiteに先に保存され、あとから同期する作りなので、
 * ここでは「止まらず使えます」と知らせるだけでよい。
 */
export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const state = useNetworkState();
  const [dismissed, setDismissed] = useState(false);
  const wasOffline = useRef(false);
  const offline = state.isConnected === false || state.isInternetReachable === false;

  useEffect(() => {
    if (offline && !wasOffline.current) setDismissed(false); // 新しく切れたら、また知らせる
    wasOffline.current = offline;
  }, [offline]);

  if (!offline || dismissed) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="閉じる"
      onPress={() => setDismissed(true)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: '#1F1712' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <T size={12} w={500} c="#FBF7F3" style={{ flex: 1 }}>オフラインです。記録は端末に保存され、つながると自動で同期します。</T>
        <T size={12} c="#C9BCB1">✕</T>
      </View>
    </Pressable>
  );
}
