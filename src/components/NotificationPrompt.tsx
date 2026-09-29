import React, { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { PrimaryButton, T, color, hairline, radius } from '@/design-system';
import { requestNotificationPermission, scheduleWeeklySummary } from '../services/notifications';

/** 通知の見本（iOSの通知バナーに寄せた見た目） */
function NotificationPreview({ body }: { body: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
        <T size={13} w={900} c={color.onText}>P</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={13} w={700}>PLATE</T>
        <T size={13} c={color.badgeFg}>{body}</T>
      </View>
    </View>
  );
}

/**
 * 通知の許可の前（README_launch 19f）。初めてトレーニングを完了した直後に1回だけ出す。
 * 「通知をオンにする」でiOSの許可ダイアログを出し、許可されたら週のまとめを予約する。
 * 「あとで」なら、設定からいつでもオンにできる（通知はこの2種類だけ。催促の通知は送らない）。
 */
export function NotificationPrompt({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    setBusy(true);
    const granted = await requestNotificationPermission();
    if (granted) await scheduleWeeklySummary();
    setBusy(false);
    onDone();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: color.bg, paddingHorizontal: 22, paddingTop: 80, paddingBottom: 34, justifyContent: 'space-between' }}>
        <View style={{ gap: 24 }}>
          <View style={{ gap: 8 }}>
            <T size={22} w={900} style={{ lineHeight: 30 }}>お知らせが届くようにしますか？</T>
            <T size={13} c={color.badgeFg} style={{ lineHeight: 20 }}>トレーニングの後と、週のはじめだけ届きます。記録を催促する通知は送りません。</T>
          </View>
          <View style={{ gap: 10 }}>
            <NotificationPreview body="おつかれさま。あとP62g・C170g" />
            <NotificationPreview body="先週のまとめができました" />
          </View>
        </View>
        <View style={{ gap: 14 }}>
          <PrimaryButton label={busy ? '設定中…' : '通知をオンにする'} disabled={busy} onPress={turnOn} />
          <Pressable accessibilityRole="button" onPress={onDone} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <T size={13} c={color.sub}>あとで（設定からいつでもオンにできます）</T>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
