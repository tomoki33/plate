import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { color, radius } from '../tokens';

/** 下から出るシート。背景は rgba(31,23,18,.32) */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="閉じる" onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(31,23,18,.32)' }} />
        <View style={{ backgroundColor: color.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: 30, maxHeight: '88%' }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: color.lineStrong }} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
