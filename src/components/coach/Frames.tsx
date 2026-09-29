import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T, color } from '@/design-system';
import { useCoach } from '../../store/coachStore';
import { BAND_BG, BAND_FG, BAND_SUB, Wordmark } from './CoachBits';
import { ModeSwitchSheet } from './ModeSwitchSheet';

/** コーチをオンにしている人は、自分のタブの上にワードマーク付きのヘッダーが付く。その分、画面側の上の余白を 0 にする */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  const enabled = useCoach((s) => s.enabled);
  return enabled ? 0 : insets.top;
}

/** 自分のモードのヘッダー（コーチがオンの人だけ）：PLATE ▾ */
export function SelfHeader() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: color.bg, paddingTop: insets.top, paddingHorizontal: 20 }}>
      <Wordmark onPress={() => setOpen(true)} />
      <ModeSwitchSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/**
 * コーチ画面の枠：黒い帯（PLATE COACH ▾）＋中身。どの画面でも、上は黒い帯になっている。
 * back があれば左に「‹ ラベル」、right があれば右に置く。
 */
export function CoachFrame({ children, back, right }: { children: React.ReactNode; back?: { label: string; onPress: () => void }; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ backgroundColor: BAND_BG, paddingTop: insets.top, paddingHorizontal: 18, paddingBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {back ? (
          <Pressable accessibilityRole="button" onPress={back.onPress} style={{ height: 44, justifyContent: 'center' }}>
            <T size={15} c={BAND_SUB}>‹ {back.label}</T>
          </Pressable>
        ) : (
          <Wordmark coach onPress={() => setOpen(true)} />
        )}
        <View>{right}</View>
      </View>
      {children}
      <ModeSwitchSheet open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** 黒帯の右に置く小さな文字ボタン */
export function BandButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ height: 44, justifyContent: 'center' }}>
      <T size={13} w={700} c={BAND_FG}>{label}</T>
    </Pressable>
  );
}
