import { Platform } from 'react-native';

/**
 * 課金（RevenueCat）。App Store のサブスク（月480円／年3,800円）の購入・検証を任せる。
 * キー（EXPO_PUBLIC_REVENUECAT_IOS_KEY）が未設定、または Expo Go では無効になり、
 * 「有料」の判定はアプリ内の無料体験（14日）だけで行う。
 */
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
/** RevenueCat で作る Entitlement の識別子 */
export const ENTITLEMENT_ID = 'plate_pro';

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
    // 端末側の初期化に失敗したときは無料扱いにする
  }
}

export interface Offer {
  id: string;
  title: string;
  price: string;
  period: 'monthly' | 'annual' | 'other';
  /** 購入時に渡すパッケージ */
  pkg: unknown;
}

export async function loadOffers(): Promise<Offer[]> {
  const p = lib();
  if (!p || !configured) return [];
  try {
    const o = await p.getOfferings();
    return (o.current?.availablePackages ?? []).map((pkg) => ({
      id: pkg.identifier,
      title: pkg.product.title,
      price: pkg.product.priceString,
      period: pkg.packageType === 'MONTHLY' ? 'monthly' : pkg.packageType === 'ANNUAL' ? 'annual' : 'other',
      pkg,
    }));
  } catch {
    return [];
  }
}

/** 有料の権利があるか（購入の検証は RevenueCat 側） */
export async function checkPaid(): Promise<boolean> {
  const p = lib();
  if (!p || !configured) return false;
  try {
    const info = await p.getCustomerInfo();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
  }
}

export async function purchase(offer: Offer): Promise<boolean> {
  const p = lib();
  if (!p || !configured) return false;
  try {
    const r = await p.purchasePackage(offer.pkg as never);
    return !!r.customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false; // キャンセルを含む
  }
}

export async function restorePurchases(): Promise<boolean> {
  const p = lib();
  if (!p || !configured) return false;
  try {
    const info = await p.restorePurchases();
    return !!info.entitlements.active[ENTITLEMENT_ID];
  } catch {
    return false;
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
