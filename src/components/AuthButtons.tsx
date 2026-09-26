import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { T, color, hairline, radius } from '@/design-system';
import { GoogleIcon, MailIcon } from './AuthIcons';

/**
 * 「Appleで続ける」。iOS では Apple の公式ボタン（BLACK・角丸8）を使う。
 * それ以外（Web の確認用）は、同じ見た目の黒いボタンで代用する。
 */
export function AppleButton({ onPress }: { onPress: () => void }) {
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
    return (
      <Apple.AppleAuthenticationButton
        buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={color.text === '#1F1712' ? Apple.AppleAuthenticationButtonStyle.BLACK : Apple.AppleAuthenticationButtonStyle.WHITE}
        cornerRadius={radius.button}
        style={{ height: 52, width: '100%' }}
        onPress={onPress}
      />
    );
  }
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ height: 52, borderRadius: radius.button, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
      <T size={15} w={700} c={color.onText}>Appleで続ける</T>
    </Pressable>
  );
}

/** Google／メール（白地に lineStrong の0.5pxの枠、高さ48、文字14/500） */
export function OutlineAuthButton({ label, icon, onPress }: { label: string; icon: 'google' | 'mail'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, height: 48, borderRadius: radius.button, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, pressed && { opacity: 0.7 }]}
    >
      <View>{icon === 'google' ? <GoogleIcon size={18} /> : <MailIcon size={20} />}</View>
      <T size={14} w={500}>{label}</T>
    </Pressable>
  );
}
