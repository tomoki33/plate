import React from 'react';
import { StyleSheet, View } from 'react-native';
import { color, radius } from '../tokens';
import { T } from './Text';

/** バッジ。`high` は brandPale 地に brandText、それ以外は中立色 */
export function Badge({ children, high }: { children: React.ReactNode; high?: boolean }) {
  return (
    <View style={[s.badge, { backgroundColor: high ? color.brandPale : color.badgeBg }]}>
      <T size={12} w={700} c={high ? color.brandText : color.badgeFg}>
        {children}
      </T>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: radius.badge, alignSelf: 'flex-start' },
});
