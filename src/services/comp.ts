import { useStore } from '../store/store';
import { supabase } from './supabase';

/**
 * 課金なしで使える利用者（許可リスト）の反映。サーバーの comp_access に自分の行があれば、
 * 本体（買い切り）／AIプラス を有効にする。行が消えたら、購入状態（RevenueCat）に戻る。
 * 通信できないときは何もしない（前回の状態のまま）。
 */
export async function syncComp(): Promise<void> {
  const c = supabase();
  const st = useStore.getState();
  if (!c || !st.account) return;
  const { data, error } = await c.from('comp_access').select('paid,ai_plus').maybeSingle();
  if (error) return;
  await st.applyComp({ paid: !!data?.paid, aiPlus: !!data?.ai_plus });
}
