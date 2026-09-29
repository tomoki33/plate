import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * 通知はこの2種類だけ（README_launch 19f）。記録を催促する通知は送らない。
 * - トレーニング後：「おつかれさま。あとP◯g・C◯g」（トレーニングを完了した直後）
 * - 月曜の朝：「先週のまとめができました」（毎週くり返す）
 *
 * 許可は、初めてトレーニングを完了した直後に1回だけ聞く（src/app/(tabs)/training.tsx）。
 * Web・許可がない環境では、静かに何もしない。
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const WEEKLY_SUMMARY_ID = 'plate-weekly-summary';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

/** プロンプトを出さずに、いまの許可状態だけ確かめる */
export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (Platform.OS === 'web') return 'undetermined';
  const s = await Notifications.getPermissionsAsync();
  if (s.granted) return 'granted';
  return s.status === 'denied' ? 'denied' : 'undetermined';
}

/** 「通知をオンにする」を押してから呼ぶ：iOSの許可ダイアログを出す */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const s = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
  return !!s.granted;
}

/** トレーニングを完了した直後：あとP・Cの通知（許可がなければ何もしない） */
export async function sendWorkoutDoneNotification(remaining: { P: number; C: number }): Promise<void> {
  if (Platform.OS === 'web') return;
  if ((await getPermissionStatus()) !== 'granted') return;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'おつかれさま', body: `あとP${remaining.P}g・C${remaining.C}g` },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  });
}

/** 月曜の朝、先週のまとめ（毎週くり返す。許可がなければ何もしない） */
export async function scheduleWeeklySummary(): Promise<void> {
  if (Platform.OS === 'web') return;
  if ((await getPermissionStatus()) !== 'granted') return;
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_SUMMARY_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_SUMMARY_ID,
    content: { title: 'PLATE', body: '先週のまとめができました' },
    // 月曜（weekday は 1=日曜始まり）の朝8時
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 8, minute: 0 },
  });
}
