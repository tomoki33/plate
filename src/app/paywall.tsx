import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice, OutlineButton, PrimaryButton, T, color, hairline, radius } from '@/design-system';
import { useNow } from '../components/useNow';
import { AI_LIMIT_FREE, AI_LIMIT_PAID, REVIEW_WEEKS_FREE, TRIAL_DAYS } from '../domain/entitlement';
import { billingConfigured, loadOffers, purchase, restorePurchases, type Offer } from '../services/billing';
import { usePlan } from '../store/selectors';
import { useStore } from '../store/store';

const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL;
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

const ROWS: [string, string, string][] = [
  ['トレ記録・テンプレート', '無制限', '無制限'],
  ['食事記録（マイ食品・成分表検索）', '無制限', '無制限'],
  ['目標', '固定のPFC目標のみ', '日タイプ連動・週内の再配分'],
  ['AIテキスト入力', `1日${AI_LIMIT_FREE}回`, `1日${AI_LIMIT_PAID}回`],
  ['週次レビュー・1RM推移', `直近${REVIEW_WEEKS_FREE}週`, '全期間'],
  ['データ書き出し（CSV）', 'あり', 'あり'],
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { plan, trialLeft } = usePlan(now);
  const setPaid = useStore((s) => s.setPaid);
  const paid = useStore((s) => s.paid);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void loadOffers().then(setOffers);
  }, []);

  const buy = async (o: Offer) => {
    setBusy(true);
    const ok = await purchase(o);
    setBusy(false);
    if (ok) {
      setPaid(true);
      setMsg('ありがとうございます。有料プランになりました。');
    } else setMsg('購入は完了しませんでした。');
  };
  const restore = async () => {
    setBusy(true);
    const ok = await restorePurchases();
    setBusy(false);
    if (ok) setPaid(true);
    setMsg(ok ? '購入を復元しました。' : '復元できる購入が見つかりませんでした。');
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
          <Notice tone={plan === 'free' ? 'plain' : 'brand'}>
            {plan === 'paid' ? '有料プランです。すべての機能が使えます。' : plan === 'trial' ? `無料体験中です（あと${trialLeft}日）。体験が終わると、日タイプ連動などが有料になります。` : `無料プランです。はじめの${TRIAL_DAYS}日間の無料体験は終わっています。`}
          </Notice>
        </View>

        <View style={{ marginTop: 18, borderTopWidth: hairline, borderTopColor: color.line }}>
          <View style={{ flexDirection: 'row', paddingVertical: 8 }}>
            <View style={{ flex: 1.2 }} />
            <T size={11} c={color.sub} style={{ flex: 1 }}>無料</T>
            <T size={11} w={700} style={{ flex: 1.1 }}>有料</T>
          </View>
          {ROWS.map(([k, a, b]) => (
            <View key={k} style={{ flexDirection: 'row', paddingVertical: 10, borderTopWidth: hairline, borderTopColor: color.line, gap: 6 }}>
              <T size={12} style={{ flex: 1.2 }}>{k}</T>
              <T size={12} c={color.sub} style={{ flex: 1 }}>{a}</T>
              <T size={12} w={700} style={{ flex: 1.1 }}>{b}</T>
            </View>
          ))}
        </View>

        {plan !== 'paid' && (
          <View style={{ marginTop: 20, gap: 10 }}>
            {offers.map((o) => (
              <PrimaryButton key={o.id} label={`${o.period === 'annual' ? '年額' : o.period === 'monthly' ? '月額' : o.title}　${o.price}`} disabled={busy} onPress={() => buy(o)} />
            ))}
            {offers.length === 0 && (
              <Notice tone="plain">{billingConfigured() ? 'プランを読み込めませんでした。時間をおいてもう一度お試しください。' : '課金の設定がまだ済んでいません（月額480円／年額3,800円の予定）。'}</Notice>
            )}
            <OutlineButton label="購入を復元する" onPress={restore} />
          </View>
        )}
        {msg && <T size={12} c={color.brandText} style={{ marginTop: 10 }}>{msg}</T>}

        <T size={11} c={color.sub} style={{ marginTop: 20, lineHeight: 17 }}>
          有料プランは、購入の確認時に Apple ID に請求され、期間が終わる24時間前までに解約しない限り、同じ期間・同じ料金で自動更新されます。解約は、端末の「設定」→ Apple ID →「サブスクリプション」から、いつでもできます。
        </T>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          {TERMS_URL ? <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={{ minHeight: 44, justifyContent: 'center' }}><T size={12} w={700}>利用規約</T></Pressable> : null}
          {PRIVACY_URL ? <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={{ minHeight: 44, justifyContent: 'center' }}><T size={12} w={700}>プライバシーポリシー</T></Pressable> : null}
        </View>
        {__DEV__ && (
          <View style={{ marginTop: 10, padding: 12, borderRadius: radius.button, borderWidth: 1, borderColor: color.lineStrong }}>
            <T size={11} c={color.sub}>開発用</T>
            <OutlineButton label={paid ? '有料をオフにする' : '有料として扱う'} onPress={() => setPaid(!paid)} style={{ marginTop: 8 }} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
