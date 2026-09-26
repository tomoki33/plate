import React from 'react';
import { Pressable, View } from 'react-native';
import { useStore } from '../store/store';
import { color, radius, T } from '@/design-system';

export function ToastHost() {
  const toast = useStore((s) => s.toast);
  const hide = useStore((s) => s.hideToast);
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 96, zIndex: 100 }}>
      <View style={{ paddingVertical: 12, paddingHorizontal: 14, backgroundColor: color.text, borderRadius: radius.button, flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <T size={13} c={color.onText} style={{ flex: 1 }}>
          {toast.text}
        </T>
        {toast.undo && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              toast.undo?.();
              hide();
            }}
          >
            <T size={13} w={700} c={color.brand}>
              取消
            </T>
          </Pressable>
        )}
      </View>
    </View>
  );
}
