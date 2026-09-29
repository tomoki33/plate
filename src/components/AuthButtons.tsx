import React from 'react';
import { Platform, Pressable } from 'react-native';
import { T, color, radius } from '@/design-system';

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
