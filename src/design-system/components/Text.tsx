import React from 'react';
import { Text, TextProps } from 'react-native';
import { color, font } from '../tokens';

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

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <T size={11} c={color.sub} style={{ letterSpacing: 0.5 }}>
      {children}
    </T>
  );
}
