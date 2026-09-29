import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';
import { COACH_MODE } from '../lib/flags';
import { Card, T, color, hairline } from '@/design-system';
import { Avatar } from '../components/coach/CoachBits';
import * as api from '../features/coach/api';
import { shortMd } from '../features/coach/dateKeys';
import { afterLinkChange } from '../features/coach/sync';
import type { ShareFlags } from '../features/coach/types';
import { useCoach } from '../store/coachStore';
import { useStore } from '../store/store';

const ROWS: { k: keyof ShareFlags; t: string; d: string }[] = [
  { k: 'meals', t: '食事', d: 'kcal・PFC・食事の名前' },
  { k: 'weight', t: '体重', d: '7日平均と推移' },
  { k: 'training', t: 'トレーニング', d: '実施したメニューと重さ・回数' },
];

/** コーチとの共有の管理：見せる項目のオン／オフ・これまでのひとこと・共有をやめる */
function CoachLinkScreen() {
  const router = useRouter();
  const link = useCoach((s) => s.link);
  const notes = useCoach((s) => s.notes);
  const showToast = useStore((s) => s.showToast);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const back = (
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: 'center' }}>
      <T size={14} c={color.sub}>‹ 設定</T>
    </Pressable>
  );
  if (!link) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
        <View style={{ paddingHorizontal: 16, height: 48 }}>{back}</View>
        <T size={14} c={color.sub} style={{ padding: 24 }}>コーチとはつながっていません。</T>
      </View>
    );
  }

  const change = async (k: keyof ShareFlags, v: boolean) => {
    const next = { ...link.share, [k]: v };
    const r = await api.updateMyLink(next, link.status);
    if (!r.ok) return setErr(r.error);
    setErr(null);
    await afterLinkChange();
  };
  const stop = async () => {
    if (!confirm) return setConfirm(true);
    const r = await api.revokeMyLink();
    if (!r.ok) return setErr(r.error);
    useCoach.getState().applyInbox({ link: null, plans: [], notes: useCoach.getState().notes });
    useCoach.getState().setManaged(null);
    showToast('共有をやめました。目標は、いまの内容のまま自分で管理できます');
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
      <View style={{ paddingHorizontal: 16, height: 48 }}>{back}</View>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={link.coachName} size={52} invert />
          <View style={{ gap: 3, flexShrink: 1 }}>
            <T size={20} w={900} numberOfLines={1}>{link.coachName}</T>
            <T size={12.5} c={color.sub}>{link.status === 'paused' ? 'ひとりで使用中（共有は止まっています）' : link.managesGoals ? '目標・メニューを決めてもらっています' : '記録を見てもらっています'}</T>
          </View>
        </View>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>見せる項目</T>
        <Card>
          {ROWS.map((r, i) => (
            <View key={r.k} style={{ minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: i === ROWS.length - 1 ? 0 : hairline, borderBottomColor: color.line }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15}>{r.t}</T>
                <T size={11.5} c={color.sub}>{r.d}</T>
              </View>
              <Switch value={link.share[r.k]} onValueChange={(v) => void change(r.k, v)} trackColor={{ true: color.text, false: color.lineStrong }} thumbColor={color.surface} />
            </View>
          ))}
        </Card>
        <T size={12} c={color.sub} style={{ paddingHorizontal: 22, paddingTop: 10, lineHeight: 20 }}>オフにした項目は、コーチには「非公開」とだけ表示されます。写真・メモ・プロフィールは、もともと見せていません。</T>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>これまでのひとこと</T>
        <Card>
          {notes.length === 0 && <View style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14 }}><T size={13} c={color.sub}>まだありません</T></View>}
          {notes.map((n, i) => (
            <View key={n.id} style={{ padding: 14, gap: 4, borderBottomWidth: i === notes.length - 1 ? 0 : hairline, borderBottomColor: color.line }}>
              <T size={11.5} c={color.sub}>{shortMd(n.weekStart)} の週・{n.coachName}</T>
              <T size={14} style={{ lineHeight: 23 }}>{n.body}</T>
            </View>
          ))}
        </Card>

        {err ? <T size={12} c={color.brandText} style={{ paddingHorizontal: 22, paddingTop: 10 }}>{err}</T> : null}
        <Pressable accessibilityRole="button" onPress={stop} style={{ marginHorizontal: 16, marginTop: 22, height: 52, borderRadius: 10, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, alignItems: 'center', justifyContent: 'center' }}>
          <T size={14} w={700} c={color.brandText}>{confirm ? 'もう一度押すと、共有をやめます' : '共有をやめる'}</T>
        </Pressable>
        <T size={11.5} c={color.sub} style={{ paddingHorizontal: 22, paddingTop: 8, lineHeight: 18 }}>共有をやめると、コーチからあなたの記録は見えなくなります（コーチ側の共有データも消えます）。最後に届いた目標は、そのまま自分の目標として残ります。</T>
      </ScrollView>
    </View>
  );
}

/** 初回公開のビルド（コーチモード無効）では、この画面を開かせない */
export default function CoachLink() {
  if (!COACH_MODE) return <Redirect href="/" />;
  return <CoachLinkScreen />;
}
