import { useRouter, Redirect } from 'expo-router';
import { FREE_LAUNCH } from '../lib/flags';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { N, T, color, hairline } from '@/design-system';
import { useNow } from '../components/useNow';
import { purchaseFull, restorePurchases } from '../services/billing';
import { trackPurchased } from '../services/analytics';
import { useTrialSummary } from '../store/selectors';
import { useStore } from '../store/store';

const fmt1 = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)}`;

/**
 * 無料体験が終わった日（19c）。アプリを開いたときに1回だけ出す（src/app/_layout.tsx）。
 * 「記録を見るだけにする」を選んでも、過去の記録はすべて見られる。新しい記録を始めようとしたら、
 * 購入の案内（/paywall）を出す（src/domain/entitlement.ts の canRecord、各画面の guardRecord）。
 */
function TrialEndedScreenInner() {
  const router = useRouter();
  const now = useNow();
  const summary = useTrialSummary(now);
  const setPaid = useStore((s) => s.setPaid);
  const markSeen = useStore((s) => s.markTrialEndedSeen);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const finish = () => {
    markSeen();
    router.replace('/');
  };

  const buy = async () => {
    setBusy(true);
    const ok = await purchaseFull();
    setBusy(false);
    if (ok) {
      setPaid(true);
      trackPurchased('full');
      finish();
    } else setMsg('購入は完了しませんでした。あとから設定の「プランを見る」からもできます。');
  };

  const restore = async () => {
    setBusy(true);
    const e = await restorePurchases();
    setBusy(false);
    if (e?.paid) {
      useStore.getState().applyEntitlements(e);
      finish();
    } else setMsg('復元できる購入が見つかりませんでした。');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <View style={{ backgroundColor: color.text, paddingTop: 92, paddingBottom: 28, alignItems: 'center' }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: color.brand }} />
        <T size={20} w={900} c={color.onText} style={{ marginTop: 20 }}>4週間、おつかれさまでした</T>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24, flexGrow: 1 }}>
        <T size={11} c={color.sub}>4週間の成果</T>
        <View style={{ marginTop: 8 }}>
          <StatRow label="記録した日" value={`${summary.loggedDays}/${summary.totalDays}`} />
          <StatRow label="体重の7日平均の変化" value={summary.weightChange !== null ? `${fmt1(summary.weightChange)} kg` : '記録がありません'} />
          <StatRow label={summary.topLift ? `${summary.topLift.name}の重さの伸び` : '主な種目の重さの伸び'} value={summary.topLift ? `${fmt1(summary.topLift.deltaKg)} kg` : '記録がありません'} last />
        </View>

        <View style={{ flex: 1 }} />

        {msg && <T size={12} c={color.brandText} style={{ marginBottom: 10 }}>{msg}</T>}
        <Pressable accessibilityRole="button" disabled={busy} onPress={buy} style={{ height: 56, borderRadius: 8, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          <T size={15} w={700} c={color.onText}>{busy ? '処理中…' : '買い切りで続ける ¥3,800'}</T>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={finish} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
          <T size={13} c={color.sub}>記録を見るだけにする</T>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={restore} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <T size={13} c={color.sub}>購入を復元</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function StatRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: last ? 0 : hairline, borderBottomColor: color.line }}>
      <T size={13.5} style={{ flex: 1 }}>{label}</T>
      <N size={17} w={600}>{value}</N>
    </View>
  );
}

/** 無料公開のビルドでは、購入まわりの画面を開かせない */
export default function TrialEndedScreen() {
  if (FREE_LAUNCH) return <Redirect href="/" />;
  return <TrialEndedScreenInner />;
}
