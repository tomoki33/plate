import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ListRow, Notice, OutlineButton, PrimaryButton, SectionLabel, T, color } from '@/design-system';
import { backupNow, latestBackupAt, restoreLatest } from '../services/backup';
import { shareCsv } from '../services/exportCsv';
import { currentSession, signInWithApple, signOut, supabaseConfigured } from '../services/supabase';
import { insertSampleData } from '../dev/sampleData';
import { useStore } from '../store/store';

const when = (t: number) => new Date(t).toLocaleString('ja-JP');

/** 書き出し・バックアップ・削除・出典 */
export default function DataScreen() {
  const router = useRouter();
  const reload = useStore((s) => s.reload);
  const erase = useStore((s) => s.eraseAllData);
  const [signedIn, setSignedIn] = useState(false);
  const [lastBackup, setLastBackup] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'erase' | 'restore' | null>(null);
  const cloud = supabaseConfigured();

  const refresh = async () => {
    const s = await currentSession();
    setSignedIn(!!s);
    setLastBackup(s ? await latestBackupAt() : null);
  };
  useEffect(() => {
    if (cloud) void refresh();
  }, [cloud]);

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg(await fn());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>データ</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>

        <View style={{ marginTop: 16 }}><SectionLabel>書き出し</SectionLabel></View>
        <ListRow title="CSVで書き出す" meta="体重・食事・トレの記録（無料でも使えます）" right={<T size={13} w={700}>書き出す</T>} minHeight={60} onPress={() => run(async () => ((await shareCsv()).ok ? null : '書き出せませんでした。'))} />

        <View style={{ marginTop: 22 }}><SectionLabel>バックアップ</SectionLabel></View>
        {!cloud ? (
          <View style={{ marginTop: 8 }}><Notice tone="plain">バックアップは、ログインの設定（Supabase）が済むと使えます。記録は、いまはこの端末の中だけにあります。</Notice></View>
        ) : !signedIn ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            <T size={12} c={color.sub}>Apple でログインすると、機種変更しても記録を戻せます。</T>
            <PrimaryButton label="Apple でログイン" disabled={busy} onPress={() => run(async () => { const r = await signInWithApple(); await refresh(); return r.ok ? null : (r.error ?? null); })} />
          </View>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            <T size={12} c={color.sub}>最後のバックアップ：{lastBackup ? when(lastBackup) : 'まだありません'}</T>
            <PrimaryButton label="いまバックアップする" disabled={busy} onPress={() => run(async () => { const r = await backupNow(); await refresh(); return r.ok ? 'バックアップしました。' : (r.error ?? 'できませんでした。'); })} />
            <OutlineButton
              label={confirm === 'restore' ? 'もう一度押すと、この端末の記録をバックアップに置き換えます' : 'バックアップから復元する'}
              onPress={() => {
                if (confirm !== 'restore') return setConfirm('restore');
                setConfirm(null);
                void run(async () => { const r = await restoreLatest(); if (r.ok) await reload(); return r.ok ? '復元しました。' : (r.error ?? 'できませんでした。'); });
              }}
            />
            <Pressable accessibilityRole="button" onPress={() => run(async () => { await signOut(); await refresh(); return 'ログアウトしました。'; })} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={13} c={color.sub}>ログアウト</T>
            </Pressable>
          </View>
        )}
        {msg && <T size={12} c={color.brandText} style={{ marginTop: 8 }}>{msg}</T>}

        <View style={{ marginTop: 22 }}><SectionLabel>記録の削除</SectionLabel></View>
        <T size={12} c={color.sub} style={{ marginTop: 6, lineHeight: 18 }}>体重・食事・トレの記録とマイ食品を、この端末からすべて消します。バックアップは、別に残ります。体重などのデータは、大切な個人情報として扱います。</T>
        <View style={{ marginTop: 8 }}>
          <OutlineButton
            label={confirm === 'erase' ? 'もう一度押すと、すべて削除します' : 'すべての記録を削除'}
            onPress={() => {
              if (confirm !== 'erase') return setConfirm('erase');
              setConfirm(null);
              void run(async () => { await erase(); return null; });
            }}
          />
        </View>

        {__DEV__ && (
          <>
            <View style={{ marginTop: 22 }}><SectionLabel>開発用</SectionLabel></View>
            <View style={{ marginTop: 8 }}>
              <OutlineButton label="サンプルデータを入れる（5週間分）" onPress={() => run(async () => { await insertSampleData(); return 'サンプルを入れました。'; })} />
            </View>
          </>
        )}

        <View style={{ marginTop: 22 }}><SectionLabel>出典・注意</SectionLabel></View>
        <T size={11} c={color.sub} style={{ marginTop: 6, lineHeight: 17 }}>
          食品の栄養成分：文部科学省「日本食品標準成分表（八訂）」を加工して作成。{'\n'}
          表示する数値はすべて目安で、効果を保証するものではありません。医療的な助言はしません。{'\n'}
          AI が推定した食品には「AI推定」の印をつけ、必ず確認画面で直してから記録します。
        </T>
      </ScrollView>
    </View>
  );
}
