import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { color, radius } from '../tokens';
import { N, T } from './Text';

/** 主ボタン（黒地に白文字）。コーラルのボタンは作らない */
export function PrimaryButton({ label, onPress, style, disabled }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [s.primary, { backgroundColor: color.text }, pressed && { opacity: 0.85 }, disabled && { opacity: 0.4 }, style]}>
      <T size={14} w={700} c={color.onText}>
        {label}
      </T>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.outline, { borderColor: color.text, backgroundColor: color.surface }, pressed && { opacity: 0.7 }, style]}>
      <T size={14} w={700}>
        {label}
      </T>
    </Pressable>
  );
}

/** ± ボタン（44pt以上） */
export function StepButton({ label, onPress, size = 44, filled }: { label: string; onPress: () => void; size?: number; filled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: filled ? color.text : color.lineStrong, backgroundColor: filled ? color.text : color.surface },
        pressed && { opacity: 0.7 },
      ]}
    >
      <N size={size > 48 ? 26 : 20} w={600} c={filled ? color.onText : color.text}>
        {label}
      </N>
    </Pressable>
  );
}

const s = StyleSheet.create({
  primary: { height: 56, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center' },
  outline: { height: 56, borderRadius: radius.button, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
