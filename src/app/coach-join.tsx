import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COACH_MODE } from '../lib/flags';
import { N, PrimaryButton, T, color, font, hairline, radius } from '@/design-system';
import { Avatar } from '../components/coach/CoachBits';
import * as api from '../features/coach/api';
import { afterLinkChange } from '../features/coach/sync';
import type { ShareFlags } from '../features/coach/types';
import { useStore } from '../store/store';

const CODE_CHARS = /[^A-HJ-NP-Z2-9]/g;
const SHARE_ROWS: { k: keyof ShareFlags; t: string; d: string }[] = [
  { k: 'meals', t: '食事', d: 'kcal・PFC・食事の名前（写真は見せません）' },
  { k: 'weight', t: '体重', d: '7日平均と推移' },
  { k: 'training', t: 'トレーニング', d: '実施したメニューと重さ・回数' },
];

/** コーチと共有：招待コードを入れる → 共有の依頼（見せる項目を選ぶ）→ 承認するまで、コーチには何も見えない */
function CoachJoinScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();
  const account = useStore((s) => s.account);
  const showToast = useStore((s) => s.showToast);
  const [code, setCode] = useState('');
  const [coachName, setCoachName] = useState<string | null>(null);
  const [share, setShare] = useState<ShareFlags>({ meals: true, weight: true, training: true });
  const [myName, setMyName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (params.code) setCode(String(params.code).toUpperCase().replace(CODE_CHARS, '').slice(0, 6));
  }, [params.code]);

  const check = async () => {
    if (busy || code.length < 6) return;
    setBusy(true);
    setErr(null);
    const r = await api.previewInvite(code);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setCoachName(r.data.coachName);
  };
  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const r = await api.acceptInvite(code, myName.trim(), share);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    await afterLinkChange();
    showToast(`${r.data.coachName}と共有をはじめました`);
    router.back();
  };

  const back = (
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: 'center' }}>
      <T size={14} c={color.sub}>‹ 設定</T>
    </Pressable>
  );

  if (!account) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
        <View style={{ paddingHorizontal: 16, height: 48 }}>{back}</View>
        <View style={{ padding: 24, gap: 14 }}>
          <T size={20} w={900}>コーチと共有</T>
          <T size={13} c={color.sub} style={{ lineHeight: 21 }}>コーチと共有するには、ログインが必要です。ログインすると、記録のバックアップも始まります。</T>
          <PrimaryButton label="ログインする" onPress={() => router.push('/login')} />
        </View>
      </View>
    );
  }

  if (coachName) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
        <View style={{ paddingHorizontal: 16, height: 48 }}>{back}</View>
        <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={coachName} size={52} invert />
            <View style={{ gap: 3 }}>
              <T size={20} w={900}>{coachName}</T>
              <T size={12.5} c={color.sub}>から共有の依頼</T>
            </View>
          </View>
          <View style={{ margin: 16, marginTop: 22, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12 }}>
            <T size={12} c={color.sub} style={{ padding: 14, paddingBottom: 4 }}>見せる項目</T>
            {SHARE_ROWS.map((r) => (
              <View key={r.k} style={{ minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: hairline, borderTopColor: color.line, gap: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T size={15}>{r.t}</T>
                  <T size={11.5} c={color.sub}>{r.d}</T>
                </View>
                <Switch value={share[r.k]} onValueChange={(v) => setShare({ ...share, [r.k]: v })} trackColor={{ true: color.text, false: color.lineStrong }} thumbColor={color.surface} />
              </View>
            ))}
          </View>
          <T size={12} c={color.sub} style={{ paddingHorizontal: 22, lineHeight: 20 }}>写真・メモ・プロフィールは見せません。共有はいつでも止められます。コーチが決めた目標に従う設定になり、目標・ペース・たんぱく質・メニューは、コーチが決めた内容が入ります（「ひとりで」に戻せます）。</T>
          <T size={12} c={color.sub} style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 6 }}>コーチに表示される名前</T>
          <TextInput value={myName} onChangeText={(v) => setMyName(v.slice(0, 30))} placeholder="例：たろう" placeholderTextColor={color.faint} style={{ marginHorizontal: 16, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input + 2, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp, fontSize: 16, color: color.text }} />
          {err ? <T size={12} c={color.brandText} style={{ paddingHorizontal: 22, paddingTop: 8 }}>{err}</T> : null}
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 12, gap: 6 }}>
          <PrimaryButton label={busy ? '共有しています…' : '共有をはじめる'} disabled={busy || !myName.trim()} onPress={accept} style={{ height: 56, borderRadius: 10 }} />
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} c={color.badgeFg}>断る</T>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
      <View style={{ paddingHorizontal: 16, height: 48 }}>{back}</View>
      <View style={{ padding: 20, gap: 14 }}>
        <T size={22} w={900}>コーチと共有</T>
        <T size={13} c={color.sub} style={{ lineHeight: 21 }}>コーチから届いた招待コードを入れてください。次の画面で、見せる項目を選んで承認します。承認するまで、コーチには何も見えません。</T>
        <TextInput
          value={code}
          onChangeText={(v) => { setCode(v.toUpperCase().replace(CODE_CHARS, '').slice(0, 6)); setErr(null); }}
          placeholder="ABC234"
          placeholderTextColor={color.faint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={check}
          style={{ height: 64, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 10, backgroundColor: color.surface, textAlign: 'center', fontFamily: font.num700, fontSize: 30, letterSpacing: 6, color: color.text }}
        />
        {err ? <T size={12} c={color.brandText}>{err}</T> : null}
        <PrimaryButton label={busy ? '確認しています…' : '確認する'} disabled={code.length < 6 || busy} onPress={check} style={{ height: 56, borderRadius: 10 }} />
        <N size={11} w={500} c={color.sub} style={{ textAlign: 'center' }}>コードは英数字6文字です</N>
      </View>
    </View>
  );
}

/** 初回公開のビルド（コーチモード無効）では、この画面を開かせない */
export default function CoachJoin() {
  if (!COACH_MODE) return <Redirect href="/" />;
  return <CoachJoinScreen />;
}
