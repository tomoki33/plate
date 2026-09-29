import { Platform } from 'react-native';

/**
 * 課金（RevenueCat）。設計書どおり、本体は買い切り（README_onboarding「課金の実装」）。
 * - 本体：買い切り（Non-Consumable、¥3,800）。
 * - 無料体験（4週間）：0円の買い切り商品「plate_trial_4weeks」を購入したことにして始める。
 *   開始日はその購入記録（購入日時）から判定するので、端末を変えても同じ期限になる。
 * - AIプラス（任意）：自動更新のサブスク（¥300/月）。写真・文章の推定回数を1日30回にする。
 *
 * キー（EXPO_PUBLIC_REVENUECAT_IOS_KEY）が未設定、または Expo Go では課金そのものが無効になる。
 * その場合、体験の開始・本体の購入・AIプラスは、端末内の状態（Zustand の `trialStartedAt` / `paid` / `aiPlus`）
 * だけで確認用に切り替えられる（開発用トグル。src/app/paywall.tsx の __DEV__ ブロック）。
 */
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;

/** RevenueCat の商品識別子（App Store Connect 側と一致させる） */
export const PRODUCT_TRIAL = 'plate_trial_4weeks';
export const PRODUCT_FULL = 'plate_full_unlock';
export const PRODUCT_AI_PLUS = 'plate_ai_plus_monthly';
/** RevenueCat の Entitlement 識別子 */
export const ENTITLEMENT_FULL = 'plate_full';
export const ENTITLEMENT_AI_PLUS = 'plate_ai_plus';

type RC = typeof import('react-native-purchases').default;
let rc: RC | null | undefined;

function lib(): RC | null {
  if (Platform.OS !== 'ios' || !IOS_KEY) return null;
  if (rc !== undefined) return rc;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    rc = (require('react-native-purchases') as { default: RC }).default;
  } catch {
    rc = null;
  }
  return rc;
}

export const billingConfigured = () => lib() !== null;

let configured = false;
export function initBilling(appUserId?: string) {
  const p = lib();
  if (!p || configured) return;
  try {
    p.configure({ apiKey: IOS_KEY!, appUserID: appUserId });
    configured = true;
  } catch {
    // 端末側の初期化に失敗したときは、開発用トグルで確認する
  }
}

export interface Entitlements {
  /** 4週間の無料体験の開始日時（0円の買い切り商品の購入日時）。まだ体験していなければ null */
  trialStartedAt: number | null;
  /** 本体（買い切り）を購入済みか */
  paid: boolean;
  /** AIプラス（サブスク）が有効か */
  aiPlus: boolean;
}

const NONE: Entitlements = { trialStartedAt: null, paid: false, aiPlus: false };

async function readEntitlements(): Promise<Entitlements> {
  const p = lib();
  if (!p || !configured) return NONE;
  try {
    const info = await p.getCustomerInfo();
    const trialPurchases = info.nonSubscriptionTransactions.filter((t) => t.productIdentifier === PRODUCT_TRIAL);
    const trialStartedAt = trialPurchases.length ? Math.min(...trialPurchases.map((t) => new Date(t.purchaseDate).getTime())) : null;
    return {
      trialStartedAt,
      paid: !!info.entitlements.active[ENTITLEMENT_FULL],
      aiPlus: !!info.entitlements.active[ENTITLEMENT_AI_PLUS],
    };
  } catch {
    return NONE;
  }
}

/** 起動時に、購入の記録から権利を読み直す */
export const checkEntitlements = readEntitlements;

async function findPackage(productId: string) {
  const p = lib()!;
  const offerings = await p.getOfferings();
  return offerings.current?.availablePackages.find((x) => x.product.identifier === productId) ?? null;
}

/**
 * 4週間の無料体験を始める（0円の買い切り商品を購入する）。
 * 課金の設定が済んでいないときは null を返す（呼び出し側が、端末内だけの開始日で代わりに始める）。
 */
export async function startTrial(): Promise<number | null> {
  const p = lib();
  if (!p || !configured) return null;
  try {
    const pkg = await findPackage(PRODUCT_TRIAL);
    if (!pkg) return null;
    const r = await p.purchasePackage(pkg);
    const t = r.customerInfo.nonSubscriptionTransactions.find((x) => x.productIdentifier === PRODUCT_TRIAL);
    return t ? new Date(t.purchaseDate).getTime() : Date.now();
  } catch {
    return null; // キャンセルを含む
  }
}

async function purchaseProduct(productId: string, entitlementId: string): Promise<boolean> {
  const p = lib();
  if (!p || !configured) return false;
  try {
    const pkg = await findPackage(productId);
    if (!pkg) return false;
    const r = await p.purchasePackage(pkg);
    return !!r.customerInfo.entitlements.active[entitlementId];
  } catch {
    return false; // キャンセルを含む
  }
}

/** 本体を買い切りで購入する（¥3,800・Non-Consumable） */
export const purchaseFull = () => purchaseProduct(PRODUCT_FULL, ENTITLEMENT_FULL);
/** AIプラスに登録する（¥300/月・自動更新） */
export const purchaseAiPlus = () => purchaseProduct(PRODUCT_AI_PLUS, ENTITLEMENT_AI_PLUS);

export async function restorePurchases(): Promise<Entitlements | null> {
  const p = lib();
  if (!p || !configured) return null;
  try {
    await p.restorePurchases();
    return await readEntitlements();
  } catch {
    return null;
  }
}

/** ログインしたら、購入を Supabase のユーザーに結びつける（機種変更でも購入が引き継がれる） */
export async function identifyBilling(userId: string | null) {
  const p = lib();
  if (!p || !configured) return;
  try {
    if (userId) await p.logIn(userId);
    else await p.logOut();
  } catch {
    // 失敗しても、端末の購入としては動く
  }
}
