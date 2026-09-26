import React from 'react';
import { Pressable, StyleSheet, Text, TextProps, View, ViewStyle, StyleProp } from 'react-native';
import { color, font, hairline, radius } from '../theme';

type Weight = 400 | 500 | 700 | 900;
const jpFont: Record<Weight, string> = { 400: font.jp, 500: font.jp500, 700: font.jp700, 900: font.jp900 };

export interface TProps extends TextProps {
  size?: number;
  w?: Weight;
  c?: string;
}
/** 日本語テキスト */
export function T({ size = 14, w = 400, c = color.text, style, ...rest }: TProps) {
  return <Text {...rest} style={[{ fontFamily: jpFont[w], fontSize: size, color: c }, style]} />;
}

export interface NProps extends TextProps {
  size?: number;
  w?: 500 | 600 | 700;
  c?: string;
}
const numFont = { 500: font.num500, 600: font.num600, 700: font.num700 } as const;
/** 数字（Barlow Semi Condensed / 等幅数字） */
export function N({ size = 20, w = 600, c = color.text, style, ...rest }: NProps) {
  return <Text {...rest} style={[{ fontFamily: numFont[w], fontSize: size, color: c, fontVariant: ['tabular-nums'] }, style]} />;
}

export function Badge({ children, high }: { children: React.ReactNode; high?: boolean }) {
  return (
    <View style={[s.badge, { backgroundColor: high ? color.brandPale : color.badgeBg }]}>
      <T size={12} w={700} c={high ? color.brandText : color.badgeFg}>
        {children}
      </T>
    </View>
  );
}

/** 主ボタン（黒地に白文字）。コーラルのボタンは作らない */
export function PrimaryButton({ label, onPress, style, disabled }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }, disabled && { opacity: 0.4 }, style]}>
      <T size={14} w={700} c="#fff">
        {label}
      </T>
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.outline, pressed && { opacity: 0.7 }, style]}>
      <T size={14} w={700}>
        {label}
      </T>
    </Pressable>
  );
}

export function Bar({ pct, fill, height = 8 }: { pct: number; fill: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: radius.bar, backgroundColor: color.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height, backgroundColor: fill }} />
    </View>
  );
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: hairline, backgroundColor: color.line }, style]} />;
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
      <N size={size > 48 ? 26 : 20} w={600} c={filled ? '#fff' : color.text}>
        {label}
      </N>
    </Pressable>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <T size={11} c={color.sub} style={{ letterSpacing: 0.5 }}>
      {children}
    </T>
  );
}

const s = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.badge, alignSelf: 'flex-start' },
  primary: { height: 52, borderRadius: radius.button, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' },
  outline: { height: 52, borderRadius: radius.button, borderWidth: 1, borderColor: color.text, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface },
});
