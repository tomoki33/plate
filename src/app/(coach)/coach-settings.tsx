import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { Card, CardRow, N, Sheet, T, PrimaryButton, color, font, hairline, lightPalette } from '@/design-system';
import { CoachFrame } from '../../components/coach/Frames';
import { InviteSheet } from '../../components/coach/InviteSheet';
import { useCoach } from '../../store/coachStore';
import { useStore } from '../../store/store';

/** 設定（コーチ）：コーチ名・招待コード・生徒の人数・「自分の記録に戻る」 */
export default function CoachSettings() {
  const router = useRouter();
  const coach = useCoach((s) => s.coach);
  const students = useCoach((s) => s.students);
  const setMode = useCoach((s) => s.setMode);
  const rename = useCoach((s) => s.rename);
  const rotate = useCoach((s) => s.rotateCode);
  const showToast = useStore((s) => s.showToast);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState(coach?.name ?? '');
  const [invite, setInvite] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveName = async () => {
    const r = await rename(name);
    if (!r.ok) return setErr(r.error);
    setNameOpen(false);
    showToast('コーチ名を変えました');
  };
  return (
    <CoachFrame>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <T size={18} w={700} style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 }}>設定</T>
        <Card>
          <CardRow title="コーチ名" right={<T size={14} c={color.badgeFg}>{coach?.name ?? '—'} ›</T>} onPress={() => { setName(coach?.name ?? ''); setErr(null); setNameOpen(true); }} />
          <CardRow title="招待コード" right={<N size={16} style={{ letterSpacing: 2 }}>{coach?.invite_code ?? '—'}</N>} onPress={() => setInvite(true)} />
          <CardRow title="生徒の人数" right={<N size={16}>{students.length} / 100 人</N>} last />
        </Card>
        <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 10 }}>
          <Pressable accessibilityRole="button" onPress={async () => { await Clipboard.setStringAsync(coach?.invite_code ?? ''); showToast('招待コードをコピーしました'); }} style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} w={700}>コピー</T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setInvite(true)} style={{ flex: 1, height: 48, borderRadius: 10, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} w={700}>リンクを送る</T>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={async () => { if (!confirmRotate) return setConfirmRotate(true); const r = await rotate(); setConfirmRotate(false); showToast(r.ok ? '招待コードを作り直しました' : r.error); }} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 }}>
          <T size={12.5} c={color.sub} style={{ textDecorationLine: 'underline' }}>{confirmRotate ? 'もう一度押すと、今のコードは使えなくなります' : '招待コードを作り直す'}</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setMode('self'); router.replace('/'); showToast('自分に切り替えました'); }} style={{ marginHorizontal: 16, marginTop: 10, height: 56, borderRadius: 10, backgroundColor: lightPalette.text, alignItems: 'center', justifyContent: 'center' }}>
          <T size={15} w={700} c={lightPalette.onText}>自分の記録に戻る</T>
        </Pressable>
        <T size={11.5} c={color.sub} style={{ paddingHorizontal: 22, paddingTop: 12, lineHeight: 18 }}>コーチモードを止めるときは、自分の設定 →「モード」から切れます。</T>
      </ScrollView>
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 12 }}>
          <T size={17} w={900}>コーチ名</T>
          <TextInput value={name} onChangeText={(v) => setName(v.slice(0, 30))} placeholder="例：山本 コーチ" placeholderTextColor={color.faint} style={{ height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp, fontSize: 16, color: color.text }} />
          {err ? <T size={12} c={color.brandText}>{err}</T> : null}
          <PrimaryButton label="保存" disabled={!name.trim()} onPress={saveName} />
        </View>
      </Sheet>
    </CoachFrame>
  );
}
