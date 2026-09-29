import { useEffect } from 'react';
import { AppState } from 'react-native';
import { COACH_MODE } from '../../lib/flags';
import { syncComp } from '../../services/comp';
import { useStore } from '../../store/store';
import { publishNow, syncStudent } from './sync';

/**
 * 生徒側の同期を動かす：ログインしたとき・アプリに戻ったときに、コーチからの目標・ひとことを取り込む。
 * 共有中に記録が変わったら、15秒ほど待ってまとめてスナップショットを送る。
 * コーチにつながっていなければ、通信は inbox の1回だけ（何も送らない）。
 */
export function useCoachSync(ready: boolean) {
  const userId = useStore((s) => s.account?.userId ?? null);

  useEffect(() => {
    if (!ready || !userId) return;
    if (COACH_MODE) void syncStudent().catch(() => {});
    void syncComp().catch(() => {});
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        if (COACH_MODE) void syncStudent().catch(() => {});
        void syncComp().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [ready, userId]);

  useEffect(() => {
    if (!ready || !COACH_MODE) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = useStore.subscribe((s, prev) => {
      if (s.meals === prev.meals && s.weights === prev.weights && s.sessions === prev.sessions && s.profile === prev.profile && s.weekPlan === prev.weekPlan) return;
      clearTimeout(timer);
      timer = setTimeout(() => void publishNow().catch(() => {}), 15_000);
    });
    return () => {
      unsub();
      clearTimeout(timer);
    };
  }, [ready]);
}
