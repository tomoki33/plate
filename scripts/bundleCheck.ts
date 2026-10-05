/**
 * 本番バンドル（JS）の検査。純粋関数だけ（書き出しは scripts/check-bundle.ts）。
 * 本番の JS は日本語が \uXXXX にエスケープされるので、先に戻してから文字列を探す。
 */

/** 本番バンドルに出てはいけない文字（開発用ボタン・開発用の注記・開発用の環境変数） */
export const FORBIDDEN: readonly string[] = [
  '（開発用）',
  '開発用トグル',
  'サンプルデータで始める',
  '初めて入れた状態に戻す',
  '有料として扱う',
  '有料をオフにする',
  'EXPO_PUBLIC_AUTO_SAMPLE',
  '反映日を今日にする',
  '今日から反映',
];

/** 本番バンドルに必ずある文字。検査が空振りしていない（バンドルを正しく読めている）ことの対照 */
export const CONTROLS: readonly string[] = ['設定', '週間スケジュール', 'COACH_MODE'];

export function decodeEscapes(js: string): string {
  return js.replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * コーチモードの旗が、書き出し時に false へ確定しているか。
 * コーチの画面の文言は実行時の旗で隠すだけなのでバンドルには残る。出さない保証は旗の値で確かめる。
 * 書き出しの形が変わって見つけられないときは null（呼び出し側は失敗として扱う）。
 */
export function coachFlagOff(decoded: string): boolean | null {
  const getter = /"COACH_MODE",\{enumerable:!0,get:function\(\)\{return ([A-Za-z_$][\w$]*)\}\}\)/.exec(decoded);
  if (!getter) return null;
  // 縮めた変数名はモジュールごとに使い回されるので、旗のモジュール（前後の __d( の間）の中だけで宣言を探す
  const start = decoded.lastIndexOf('__d(', getter.index);
  if (start < 0) return null;
  const next = decoded.indexOf('__d(', getter.index);
  const scope = decoded.slice(start, next < 0 ? undefined : next);
  const name = getter[1].replace(/\$/g, '\\$');
  const decls = [...scope.matchAll(new RegExp(`[,;{\\s]${name}=(!0|!1|true|false)[,;}]`, 'g'))];
  if (decls.length !== 1) return null;
  return decls[0][1] === '!1' || decls[0][1] === 'false';
}

export type BundleReport = { forbiddenFound: string[]; controlsMissing: string[]; coachOff: boolean | null };

export function checkBundle(js: string): BundleReport {
  const d = decodeEscapes(js);
  return {
    forbiddenFound: FORBIDDEN.filter((s) => d.includes(s)),
    controlsMissing: CONTROLS.filter((s) => !d.includes(s)),
    coachOff: coachFlagOff(d),
  };
}

export function problems(r: BundleReport): string[] {
  const out: string[] = [];
  for (const s of r.forbiddenFound) out.push(`本番バンドルに出てはいけない文字がある：${s}`);
  for (const s of r.controlsMissing) out.push(`対照の文言が見つからない（検査が空振りの疑い）：${s}`);
  if (r.coachOff === null) out.push('コーチモードの旗の値を読み取れない（書き出しの形が変わった？ scripts/bundleCheck.ts を見直す）');
  else if (!r.coachOff) out.push('コーチモードの旗が true で書き出されている（EXPO_PUBLIC_COACH_MODE が混ざった？）');
  return out;
}
