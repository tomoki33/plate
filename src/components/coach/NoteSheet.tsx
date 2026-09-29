import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Sheet, T, color, font, hairline } from '@/design-system';
import * as api from '../../features/coach/api';
import { weekStartKey } from '../../features/coach/dateKeys';
import { useCoach } from '../../store/coachStore';
import { useStore } from '../../store/store';

/** ひとこと（下から出るシート）。送信は1週につき1件（同じ週に送り直すと上書き） */
export function NoteSheet({ open, onClose, userId, name, today, previous }: { open: boolean; onClose: () => void; userId: string; name: string; today: string; previous?: string | null }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const showToast = useStore((s) => s.showToast);
  const refresh = useCoach((s) => s.refreshCoach);
  const can = text.trim().length > 0 && !busy;

  const send = async () => {
    if (!can) return;
    setBusy(true);
    setErr(null);
    const r = await api.sendNote(userId, weekStartKey(today), text.trim());
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setText('');
    onClose();
    showToast(`${name}さんに送りました`);
    void refresh();
  };

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={17} w={700}>{name}へひとこと</T>
          <T size={12} c={color.sub}>月曜のまとめに添えて</T>
        </View>
        {previous ? <T size={12} c={color.sub} numberOfLines={2}>今週すでに送った内容：{previous}（送ると上書きされます）</T> : null}
        <TextInput
          value={text}
          onChangeText={(v) => { setText(v.slice(0, 500)); setErr(null); }}
          placeholder="例：記録が戻ってきたね。まずは週4日を目標に"
          placeholderTextColor={color.faint}
          multiline
          style={{ minHeight: 110, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 6, padding: 12, fontFamily: font.jp, fontSize: 15, lineHeight: 25, color: color.text, backgroundColor: color.surface, textAlignVertical: 'top' }}
        />
        {err ? <T size={12} c={color.brandText}>{err}</T> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !can }} onPress={send} style={{ height: 56, borderRadius: 10, backgroundColor: can ? color.text : color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
          <T size={15} w={700} c={color.onText}>{busy ? '送っています…' : '送る'}</T>
        </Pressable>
      </View>
    </Sheet>
  );
}
