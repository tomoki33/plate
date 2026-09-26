import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { color, hairline, radius } from '../tokens';

export function Bar({ pct, fill, height = 8 }: { pct: number; fill: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: radius.bar, backgroundColor: color.track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height, backgroundColor: fill }} />
    </View>
  );
}

/** 区切りは0.5pxの線だけ */
export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: hairline, backgroundColor: color.line }, style]} />;
}
