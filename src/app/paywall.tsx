import { useRouter, Redirect } from 'expo-router';
import { FREE_LAUNCH } from '../lib/flags';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { Badge, N, Notice, OutlineButton, PrimaryButton, T, color, hairline, radius } from '@/design-system';
import { useNow } from '../components/useNow';
import { AI_LIMIT_BASE, AI_LIMIT_PLUS, TRIAL_DAYS } from '../domain/entitlement';
import { billingConfigured, purchaseAiPlus, purchaseFull, restorePurchases } from '../services/billing';
import { trackPurchased } from '../services/analytics';
import { usePlan } from '../store/selectors';
import { useStore } from '../store/store';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

const CAN_DO = ['トレーニング記録・テンプレート、食事記録は無料体験から無制限', '写真・文章からの推定（1日3回、AIプラスで30回）', 'トレーニングに合わせて毎日の目標が自動で変わる'];

/**
 * プラン（README_onboarding「6. 購入の案内」と同じ内容を、設定・体験終了の画面からも開けるようにしたもの）。
 * 本体は買い切り（¥3,800・サブスクなし）。AIプラスだけが任意の自動更新サブスク（¥300/月）。
 */
function PaywallInner() {
  const router = useRouter();
  const now = useNow();
  const { plan, trialLeft } = usePlan(now);
  const paid = useStore((s) => s.paid);
  const aiPlus = useStore((s) => s.aiPlus);
  const setPaid = useStore((s) => s.setPaid);
  const setAiPlus = useStore((s) => s.setAiPlus);
  const [busy, setBusy] = useState<'full' | 'ai' | 'restore' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const buyFull = async () => {
    setBusy('full');
    const ok = await purchaseFull();
    setBusy(null);
    if (ok) {
      setPaid(true);
      trackPurchased('full');
      setMsg('ありがとうございます。購入が完了しました。');
    } else setMsg('購入は完了しませんでした。');
  };
  const toggleAiPlus = async () => {
    if (aiPlus) {
      void Linking.openURL('https://apps.apple.com/account/subscriptions');
      return;
    }
    setBusy('ai');
    const ok = await purchaseAiPlus();
    setBusy(null);
    if (ok) {
      setAiPlus(true);
      trackPurchased('ai_plus');
      setMsg('AIプラスに登録しました。');
    } else setMsg('登録は完了しませんでした。');
  };
  const restore = async () => {
    setBusy('restore');
    const e = await restorePurchases();
    setBusy(null);
    if (e) {
      if (e.trialStartedAt !== null) useStore.getState().applyEntitlements(e);
      setMsg(e.paid || e.aiPlus ? '購入を復元しました。' : '復元できる購入が見つかりませんでした。');
    } else setMsg('復元できる購入が見つかりませんでした。');
  };

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 22, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T size={22} w={900}>プラン</T>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
            <T size={13} c={color.sub}>閉じる</T>
          </Pressable>
        </View>

        <View style={{ marginTop: 12 }}>
          <Notice tone={plan === 'view_only' ? 'plain' : 'brand'}>
            {plan === 'paid'
              ? '購入済みです。すべての機能が使えます。'
              : plan === 'trial'
                ? `無料体験中です（あと${trialLeft}日）。${TRIAL_DAYS}日の体験が終わると、新しい記録には購入が必要になります。`
                : '無料体験は終わっています。記録は見られますが、新しい記録には購入が必要です。'}
          </Notice>
        </View>

        <View style={{ marginTop: 18, gap: 6 }}>
          {CAN_DO.map((t) => (
            <View key={t} style={{ flexDirection: 'row', gap: 8 }}>
              <T size={13} w={700} c={color.brandText}>✓</T>
              <T size={13} style={{ flex: 1, lineHeight: 19 }}>{t}</T>
            </View>
          ))}
        </View>

        {/* 本体：買い切り */}
        <View style={{ marginTop: 20, padding: 16, borderRadius: radius.card, borderWidth: 1.5, borderColor: color.text, gap: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={15} w={700}>本体</T>
            <Badge>サブスクなし</Badge>
          </View>
          <N size={28} w={600}>¥3,800<T size={13} c={color.sub}> 買い切り</T></N>
          <T size={12} c={color.sub} style={{ lineHeight: 18 }}>一度の購入で、ずっと使えます。Apple IDに残るので、機種変更しても「購入を復元」で戻せます。</T>
          {paid ? <Notice tone="plain">購入済みです。</Notice> : <PrimaryButton label={busy === 'full' ? '処理中…' : '買い切りで購入 ¥3,800'} disabled={busy !== null} onPress={buyFull} />}
        </View>

        {/* AIプラス：任意のサブスク */}
        <View style={{ marginTop: 12, padding: 16, borderRadius: radius.card, borderWidth: hairline, borderColor: color.line, gap: 10 }}>
          <T size={14} w={700}>AIプラス（任意）</T>
          <N size={20} w={600}>¥300<T size={12} c={color.sub}> / 月</T></N>
          <T size={12} c={color.sub} style={{ lineHeight: 18 }}>写真・文章からの推定を、1日{AI_LIMIT_BASE}回から{AI_LIMIT_PLUS}回に増やします。あとから追加・解約できます。</T>
          <OutlineButton label={aiPlus ? '登録済み（解約はApple IDの設定から）' : busy === 'ai' ? '処理中…' : 'AIプラスに登録 ¥300/月'} onPress={() => busy === null && void toggleAiPlus()} />
        </View>

        <View style={{ marginTop: 16 }}>
          <OutlineButton label={busy === 'restore' ? '確認中…' : '購入を復元する'} onPress={() => busy === null && void restore()} />
        </View>
        {!billingConfigured() && (
          <Notice tone="plain">
            {__DEV__ ? '課金の設定がまだ済んでいません（確認用に、下の開発用トグルで切り替えられます）。' : '現在、購入はできません。しばらくしてからもう一度お試しください。'}
          </Notice>
        )}
        {msg && <T size={12} c={color.brandText} style={{ marginTop: 10 }}>{msg}</T>}

        <T size={11} c={color.sub} style={{ marginTop: 20, lineHeight: 17 }}>
          本体（買い切り）は一度だけの請求です。AIプラスは、購入の確認時に Apple ID に請求され、期間が終わる24時間前までに解約しない限り、同じ期間・同じ料金で自動更新されます。解約は、端末の「設定」→ Apple ID →「サブスクリプション」から、いつでもできます。
        </T>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          {TERMS_URL ? <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={{ minHeight: 44, justifyContent: 'center' }}><T size={12} w={700}>利用規約</T></Pressable> : null}
          {PRIVACY_URL ? <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={{ minHeight: 44, justifyContent: 'center' }}><T size={12} w={700}>プライバシーポリシー</T></Pressable> : null}
        </View>
        {__DEV__ && (
          <View style={{ marginTop: 10, padding: 12, borderRadius: radius.button, borderWidth: 1, borderColor: color.lineStrong, gap: 8 }}>
            <T size={11} c={color.sub}>開発用</T>
            <OutlineButton label={paid ? '購入をオフにする' : '購入済みとして扱う'} onPress={() => setPaid(!paid)} />
            <OutlineButton label={aiPlus ? 'AIプラスをオフにする' : 'AIプラスとして扱う'} onPress={() => setAiPlus(!aiPlus)} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** 無料公開のビルドでは、購入まわりの画面を開かせない */
export default function Paywall() {
  if (FREE_LAUNCH) return <Redirect href="/" />;
  return <PaywallInner />;
}
