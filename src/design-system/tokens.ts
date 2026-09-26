/** 明るい配色（既定）。ブランドのコーラルとP/F/Cは、ダークでも同じ色 */
export const lightPalette = {
  brand: '#E85C31', // 塗りに使う。今日・完了・日タイプ「高」だけ
  brandText: '#B5421C', // 文字用コーラル（小さい文字やバッジの文字）
  brandPale: '#FDE9DF', // お知らせ・バッジの背景
  brandPale2: '#F7CDBB', // 日タイプ「通常」
  off: '#E4DAD1', // 日タイプ「オフ」
  bg: '#FBF7F3',
  surface: '#FFFFFF',
  text: '#1F1712', // 主要テキスト。主ボタンの背景
  onText: '#FFFFFF', // 主ボタンの文字（text の上に載る色）
  sub: '#8A7B70', // 補助、ラベル、前回値
  line: '#E9DFD6', // 0.5pxの区切り線
  lineStrong: '#CFC3B8', // 入力欄とアウトラインボタンの枠
  track: '#EFE7E0', // プログレスバーの下地
  faint: '#C9BCB1', // 未入力の前回値（薄い数字）
  badgeBg: '#F1EAE3',
  badgeFg: '#5A4D44',
  scrim: 'rgba(31,23,18,.32)', // シートの背景の暗がり
  P: '#D9434E',
  F: '#E9A81F',
  C: '#3A8FDB', // 全画面で固定。ブランド色とは別扱い
};

export type Palette = { [K in keyof typeof lightPalette]: string };

/** ダークは、同じ色の役割を反転して作る。コーラルはそのまま使う */
export const darkPalette: Palette = {
  brand: '#E85C31',
  brandText: '#F08A63',
  brandPale: '#3A211A',
  brandPale2: '#7A4330',
  off: '#3A322C',
  bg: '#14100D',
  surface: '#1F1A16',
  text: '#F4EDE6',
  onText: '#1F1712',
  sub: '#A39488',
  line: '#2E2721',
  lineStrong: '#4A4038',
  track: '#2A231E',
  faint: '#5E5349',
  badgeBg: '#2A231E',
  badgeFg: '#CBBFB3',
  scrim: 'rgba(0,0,0,.55)',
  P: '#D9434E',
  F: '#E9A81F',
  C: '#3A8FDB',
};

/**
 * 画面が読む色。配色が切り替わったら applyScheme() で中身を差し替える
 * （ルートで配色ごとに画面を作り直すので、各画面は `color.text` のように読むだけでよい）。
 */
export const color: Palette = { ...lightPalette };
export type Scheme = 'light' | 'dark';
export function applyScheme(scheme: Scheme) {
  Object.assign(color, scheme === 'dark' ? darkPalette : lightPalette);
}

export const radius = { input: 6, card: 10, button: 8, badge: 5, bar: 2, sheet: 14 } as const;

export const font = {
  jp: 'NotoSansJP_400Regular',
  jp500: 'NotoSansJP_500Medium',
  jp700: 'NotoSansJP_700Bold',
  jp900: 'NotoSansJP_900Black',
  num500: 'BarlowSemiCondensed_500Medium',
  num600: 'BarlowSemiCondensed_600SemiBold',
  num700: 'BarlowSemiCondensed_700Bold',
} as const;

export const hairline = 0.5;
