import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Switch, TextInput, View } from 'react-native';
import { Card, CardRow, PrimaryButton, Segmented, Sheet, T, color, font, hairline } from '@/design-system';
import * as api from '../../features/coach/api';
import { afterLinkChange } from '../../features/coach/sync';
import { useCoach } from '../../store/coachStore';
import { useStore } from '../../store/store';
import { COACH_MODE } from '../../lib/flags';
import { Avatar, CoachBadge } from './CoachBits';

const label = (text: string) => <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{text}</T>;

/**
 * 設定の中のコーチまわり（コーチ機能を使わない人には「コーチと共有」の1行だけが出る）：
 *  - コーチにつながっている生徒：コーチ名・ひとりで／コーチと の切り替え・見せる項目
 *  - モード：「コーチとして使う」（初期はオフ）。オンにすると切り替えの行が出る
 */
export function CoachModeSection({ onLogin }: { onLogin: () => void }) {
  const router = useRouter();
  const account = useStore((s) => s.account);
  const showToast = useStore((s) => s.showToast);
  const enabled = useCoach((s) => s.enabled);
  const coach = useCoach((s) => s.coach);
  const students = useCoach((s) => s.students);
  const link = useCoach((s) => s.link);
  const enable = useCoach((s) => s.enable);
  const disable = useCoach((s) => s.disable);
  const setMode = useCoach((s) => s.setMode);
  const [nameOpen, setNameOpen] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onToggle = (on: boolean) => {
    if (!on) {
      disable();
      showToast('コーチモードをオフにしました');
      return;
    }
    if (!account) {
      showToast('コーチモードは、ログインすると使えます');
      onLogin();
      return;
    }
    setErr(null);
    setName(coach?.name ?? '');
    setNameOpen(true);
  };

  const start = async () => {
    setBusy(true);
    const r = await enable(name);
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setNameOpen(false);
    showToast(`招待コード ${r.data.invite_code} を発行しました`);
    void useCoach.getState().refreshCoach();
  };

  const setStatus = async (status: 'active' | 'paused') => {
    if (!link) return;
    const r = await api.updateMyLink(link.share, status);
    if (!r.ok) return showToast(r.error);
    await afterLinkChange();
    showToast(status === 'paused' ? 'ひとりで使います。共有は止まっています' : 'コーチと使います。共有を再開しました');
  };

  // 初回公開のビルドでは、コーチに関わる入口を出さない
  if (!COACH_MODE) return null;
  return (
    <View>
      {/* 生徒：コーチにつながっているとき（設定の一番上に近い位置） */}
      {link ? (
        <View>
          {label('コーチ')}
          <Card>
            <Pressable accessibilityRole="button" onPress={() => router.push('/coach-link')} style={{ minHeight: 64, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={link.coachName} size={36} invert />
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} w={700} numberOfLines={1}>{link.coachName}</T>
                <T size={12} c={color.sub} numberOfLines={1}>{link.status === 'paused' ? 'ひとりで使用中（共有は止まっています）' : `${[link.share.meals && '食事', link.share.weight && '体重', link.share.training && 'トレーニング'].filter(Boolean).join('・') || 'なし'}を共有中`}</T>
              </View>
              {link.status === 'active' ? <CoachBadge /> : null}
              <T size={16} c={color.sub}>›</T>
            </Pressable>
            <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
              <Segmented value={link.status} onChange={(v) => void setStatus(v)} options={[{ value: 'paused', label: 'ひとりで' }, { value: 'active', label: 'コーチと' }]} />
              <T size={11} c={color.sub} style={{ paddingTop: 8, lineHeight: 17 }}>「ひとりで」にすると、自分で決めた目標に戻ります。共有は止まり、記録はそのまま残ります。</T>
            </View>
          </Card>
        </View>
      ) : (
        <View>
          {label('コーチ')}
          <Card>
            <CardRow title="コーチと共有" meta="招待コードで、コーチに記録を見てもらえます" right={<T size={13} c={color.sub}>›</T>} onPress={() => router.push('/coach-join')} minHeight={60} last />
          </Card>
        </View>
      )}

      {/* モード */}
      {label('モード')}
      <Card>
        <CardRow
          title="コーチとして使う"
          meta={enabled ? `生徒 ${students.length}人・招待コード ${coach?.invite_code ?? '—'}` : '生徒の記録を見て、目標やメニューを送れます'}
          right={<Switch value={enabled} onValueChange={onToggle} trackColor={{ true: color.text, false: color.lineStrong }} thumbColor={color.surface} />}
          minHeight={60}
          last={!enabled}
        />
        {enabled && (
          <CardRow
            title="コーチ画面へ切り替える"
            right={<T size={13} c={color.sub}>›</T>}
            onPress={() => {
              setMode('coach');
              router.replace('/students');
              showToast('コーチに切り替えました');
            }}
            last
          />
        )}
      </Card>

      <Sheet visible={nameOpen} onClose={() => setNameOpen(false)}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 12 }}>
          <View style={{ gap: 4 }}>
            <T size={17} w={900}>コーチとして使う</T>
            <T size={12} c={color.sub} style={{ lineHeight: 19 }}>生徒の記録を見て、目標やメニューを送れます。自分の記録は、これまでどおり使えます。生徒に表示される名前を入れてください。</T>
          </View>
          <TextInput value={name} onChangeText={(v) => { setName(v.slice(0, 30)); setErr(null); }} placeholder="例：山本 コーチ" placeholderTextColor={color.faint} style={{ height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 8, backgroundColor: color.surface, paddingHorizontal: 14, fontFamily: font.jp, fontSize: 16, color: color.text }} />
          {err ? <T size={12} c={color.brandText}>{err}</T> : null}
          <PrimaryButton label={busy ? '準備しています…' : '招待コードを発行してオンにする'} disabled={!name.trim() || busy} onPress={start} />
        </View>
      </Sheet>
    </View>
  );
}
