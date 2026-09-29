/**
 * 無料公開モード（EXPO_PUBLIC_FREE_LAUNCH=1 のビルド）。
 * 課金の設定をせずに公開するとき用：全員が最初から全機能を使える。体験期間・購入画面・AIプラスは出さない。
 * あとで課金を始めるときは、この変数を外し、課金商品を登録したビルドを出す
 * （既存の利用者を無料のまま残すなら、サーバーの comp_access に登録する）。
 */
export const FREE_LAUNCH = process.env.EXPO_PUBLIC_FREE_LAUNCH === '1';

/**
 * コーチモード（EXPO_PUBLIC_COACH_MODE=1 のビルドだけ有効）。
 * 初回公開（v1.0）はコア機能だけにするため、本番ビルドでは付けない。
 * 付けないと、コーチに関わる入口（設定のモード・コーチと共有、切り替え、同期）がすべて出ず、既存の画面のまま。
 */
export const COACH_MODE = process.env.EXPO_PUBLIC_COACH_MODE === '1';
