import React from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { N, T, color, lightPalette } from '@/design-system';

/** コーチ画面のヘッダー帯・アイコンの固定色（ダークモードでも黒帯にして、モードをひと目で分ける） */
export const BAND_BG = lightPalette.text;
export const BAND_FG = lightPalette.bg;
export const BAND_SUB = lightPalette.brandPale2;

/** 生徒のアバター（名前の頭文字） */
export function Avatar({ name, size = 40, invert }: { name: string; size?: number; invert?: boolean }) {
  const ch = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: invert ? lightPalette.text : color.track, alignItems: 'center', justifyContent: 'center' }}>
      <T size={Math.round(size * 0.35)} w={700} c={invert ? lightPalette.bg : color.text}>{ch}</T>
    </View>
  );
}

/** 警告バッジ（淡コーラル地・コーラルの文字） */
export function WarnBadge({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: color.brandPale, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
      <T size={10.5} w={700} c={color.brandText} numberOfLines={1}>{text}</T>
    </View>
  );
}

/** 今週7日のバー：トレーニング日 brand / 記録のみ text / なし off（14×6・間隔3） */
export function WeekBars({ marks }: { marks: ('train' | 'log' | 'none')[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {marks.map((m, i) => (
        <View key={i} style={{ width: 14, height: 6, borderRadius: 2, backgroundColor: m === 'train' ? color.brand : m === 'log' ? lightPalette.text : lightPalette.off }} />
      ))}
    </View>
  );
}

/** ワードマーク「PLATE」＋（コーチ画面では COACH）＋下向き矢印。押すと切り替えシート */
export function Wordmark({ coach, onPress }: { coach?: boolean; onPress?: () => void }) {
  const fg = coach ? BAND_FG : color.text;
  const sub = coach ? BAND_SUB : color.sub;
  const body = (
    <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <N size={19} w={700} c={fg} style={{ letterSpacing: 3 }}>PLATE</N>
      {coach ? <N size={11} w={600} c={BAND_SUB} style={{ letterSpacing: 2 }}>COACH</N> : null}
      {onPress ? (
        <Svg width={12} height={8} viewBox="0 0 12 8" fill="none" stroke={sub} strokeWidth={1.6}>
          <Path d="M1.5 1.5L6 6l4.5-4.5" />
        </Svg>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel="モードを切り替える" onPress={onPress} hitSlop={8}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export type CoachTabName = 'people' | 'menu' | 'settings';
/** コーチのタブアイコン（線幅 1.6、選択中は 2）：生徒＝2人並び、メニュー＝バーベル、設定＝スライダー */
export function CoachTabIcon({ name, focused }: { name: CoachTabName; focused: boolean }) {
  const stroke = focused ? color.text : color.sub;
  const sw = focused ? 2 : 1.6;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw}>
      {name === 'people' && (
        <G>
          <Circle cx={9} cy={8.5} r={3.2} />
          <Path d="M3.5 19.5c0-3.2 2.5-5.5 5.5-5.5s5.5 2.3 5.5 5.5" />
          <Circle cx={17} cy={9.5} r={2.4} />
          <Path d="M16 14.2c2.6-.4 4.8 1.6 4.8 4.6" />
        </G>
      )}
      {name === 'menu' && (
        <G>
          <Path d="M2.5 12h19" />
          <Rect x={5.5} y={6.5} width={3} height={11} rx={0.5} />
          <Rect x={15.5} y={6.5} width={3} height={11} rx={0.5} />
        </G>
      )}
      {name === 'settings' && (
        <G>
          <Path d="M4 8h16M4 16h16" />
          <Circle cx={9} cy={8} r={2.2} fill={color.bg} />
          <Circle cx={15} cy={16} r={2.2} fill={color.bg} />
        </G>
      )}
    </Svg>
  );
}

/** モード切り替えシートの丸いアイコン（アプリアイコン 7a の小型版）。coach は明るい地の反転 */
export function ModeIcon({ inverted }: { inverted?: boolean }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: inverted ? lightPalette.bg : lightPalette.text, overflow: 'hidden', borderWidth: 0.5, borderColor: color.line }}>
      <View style={{ position: 'absolute', left: 9, top: 9, width: 22, height: 22, borderRadius: 11, backgroundColor: lightPalette.brand }} />
      <View style={{ position: 'absolute', left: 4, right: 4, top: 19, height: 2.5, backgroundColor: inverted ? lightPalette.text : lightPalette.bg }} />
    </View>
  );
}

/** 生徒の設定で、コーチが決めた項目に付ける小さなバッジ（見るだけ） */
export function CoachBadge() {
  return (
    <View style={{ backgroundColor: color.brandPale, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }}>
      <T size={11} w={700} c={color.brandText}>コーチが設定</T>
    </View>
  );
}
