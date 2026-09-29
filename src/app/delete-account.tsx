import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Notice, T, color, hairline, radius } from '@/design-system';
import { deleteAccount } from '../services/supabase';
import { useStore } from '../store/store';
import { FREE_LAUNCH } from '../lib/flags';

/**
 * アカウントを削除（19b）。Appleの審査で必須。
 * 消える・残る・AIプラスの解約方法を3行で示し、「上の内容を確認しました」にチェックが入るまでボタンは押せない。
 * 確認ダイアログは重ねない（この画面自体が確認）。削除後はログイン画面へ。
 */
export default function DeleteAccountScreen() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const r = await deleteAccount();
    setBusy(false);
    if (!r.ok) return setError(r.error ?? 'アカウントを削除できませんでした。');
    useStore.getState().setAccount(null);
    useStore.getState().showToast('アカウントを削除しました');
    router.replace('/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>アカウントを削除</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>

        <View style={{ marginTop: 20, gap: 14 }}>
          <Row title="消えるもの" body="ログイン情報と、クラウドのバックアップ（写真を含む）が消えます。取り消せません。" />
          <Row title="残るもの" body={FREE_LAUNCH ? 'この端末の記録は残ります（消したいときは「データ」の「すべての記録を削除」）。' : 'この端末の記録は残ります（消したいときは「データ」の「すべての記録を削除」）。買い切りの購入はApple IDに残り、あとから「購入を復元」で戻せます。'} />
          {!FREE_LAUNCH && <Row title="AIプラスの解約" body="AIプラスに登録している場合は、iPhoneの「設定」→ Apple ID →「サブスクリプション」から、別に解約してください。" />}
        </View>

        {error && (
          <View style={{ marginTop: 16 }}>
            <Notice tone="plain">{error}</Notice>
          </View>
        )}

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          onPress={() => setChecked((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, minHeight: 44 }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: checked ? color.brandText : color.lineStrong, backgroundColor: checked ? color.brandText : color.surface, alignItems: 'center', justifyContent: 'center' }}>
            {checked && <T size={13} w={900} c={color.onText}>✓</T>}
          </View>
          <T size={13.5} style={{ flex: 1 }}>上の内容を確認しました</T>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={!checked || busy}
          onPress={run}
          style={{ marginTop: 16, height: 56, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? color.brandText : color.off }}
        >
          <T size={15} w={700} c={checked ? color.onText : color.faint}>{busy ? '削除しています…' : 'アカウントを削除する'}</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 4, paddingBottom: 14, borderBottomWidth: hairline, borderBottomColor: color.line }}>
      <T size={13} w={700}>{title}</T>
      <T size={13} c={color.badgeFg} style={{ lineHeight: 20 }}>{body}</T>
    </View>
  );
}
