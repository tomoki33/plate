import React from 'react';
import { Pressable, View } from 'react-native';
import { color, hairline, radius } from '../tokens';
import { N, T } from './Text';

/**
 * 枠つきの − 数字 ＋。グラム入力（高さ64・値34pt）や体重入力（高さ80・値44pt）のような大きい調整に使う。
 * 枠は lineStrong の0.5px、角丸8、白地（surface）。
 */
export function StepBox({
  value,
  unit,
  onDown,
  onUp,
  height = 64,
  buttonWidth = 56,
  size = 34,
  caption,
  radiusPx = radius.button,
  label,
}: {
  value: string;
  unit?: string;
  onDown: () => void;
  onUp: () => void;
  height?: number;
  buttonWidth?: number;
  size?: number;
  /** 数字の下の小さな説明（「kg ±2.5」など） */
  caption?: string;
  radiusPx?: number;
  label?: string;
}) {
  const btn = (text: string, onPress: () => void, name: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label ?? ''}${name}`} onPress={onPress} style={({ pressed }) => ({ width: buttonWidth, height, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}>
      <T size={Math.min(24, Math.max(16, height / 3))}>{text}</T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radiusPx, backgroundColor: color.surface, height }}>
      {btn('−', onDown, 'を減らす')}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <N size={size} w={600} style={{ lineHeight: size * 1.05 }}>
          {value}
          {unit ? <T size={Math.max(11, size * 0.42)} c={color.sub}> {unit}</T> : null}
        </N>
        {caption ? <T size={9.5} c={color.sub}>{caption}</T> : null}
      </View>
      {btn('＋', onUp, 'を増やす')}
    </View>
  );
}
