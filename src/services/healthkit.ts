import { Platform } from 'react-native';

/**
 * Apple ヘルスケアから体重・体脂肪率を読み込む（読み込みのみ）。
 * Expo Go では動かない（開発ビルドが必要）。ライブラリは実行時に読み込み、
 * 使えない環境では何もせず { available: false } を返す。
 */
export interface HealthWeight {
  date: string;
  kg: number;
  bodyFatPct: number | null;
}

type HK = typeof import('@kingstinct/react-native-healthkit');
let cached: HK | null | undefined;

function lib(): HK | null {
  if (Platform.OS !== 'ios') return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    cached = null;
  }
  return cached;
}

const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function healthAvailable(): Promise<boolean> {
  const hk = lib();
  if (!hk) return false;
  try {
    return await hk.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** 直近 days 日の体重（1日1件・その日の最後の値）と、同じ日の体脂肪率 */
export async function readBodyComposition(days = 30): Promise<{ available: boolean; rows: HealthWeight[] }> {
  const hk = lib();
  if (!hk || !(await healthAvailable())) return { available: false, rows: [] };
  try {
    const ok = await hk.requestAuthorization({ toRead: ['HKQuantityTypeIdentifierBodyMass', 'HKQuantityTypeIdentifierBodyFatPercentage'] });
    if (!ok) return { available: true, rows: [] };
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const filter = { date: { startDate: from } };
    const mass = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', { filter, limit: -1, ascending: true, unit: 'kg' });
    const fat = await hk.queryQuantitySamples('HKQuantityTypeIdentifierBodyFatPercentage', { filter, limit: -1, ascending: true, unit: '%' });
    const fatByDay = new Map<string, number>();
    for (const f of fat) fatByDay.set(key(new Date(f.endDate)), f.quantity);
    const byDay = new Map<string, HealthWeight>();
    for (const m of mass) {
      const d = key(new Date(m.endDate));
      byDay.set(d, { date: d, kg: Math.round(m.quantity * 10) / 10, bodyFatPct: fatByDay.get(d) ?? null });
    }
    return { available: true, rows: [...byDay.values()] };
  } catch {
    return { available: false, rows: [] };
  }
}
