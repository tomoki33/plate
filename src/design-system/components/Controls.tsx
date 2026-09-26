import React from 'react';
import { Pressable, StyleProp, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { color, font, hairline, radius } from '../tokens';
import { StepButton } from './Button';
import { N, T } from './Text';

/** 切り替え（下地 track、選択中は白） */
export function Segmented<V extends string | number>({ options, value, onChange }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: color.track, borderRadius: radius.button, padding: 3 }}>
      {options.map((o) => (
        <Pressable key={String(o.value)} accessibilityRole="tab" accessibilityState={{ selected: o.value === value }} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: o.value === value ? '#fff' : 'transparent' }}>
          <T size={13} w={o.value === value ? 700 : 400}>{o.label}</T>
        </Pressable>
      ))}
    </View>
  );
}

/** ＋−で数値を変える */
export function Stepper({ value, onDown, onUp, width = 64 }: { value: string; onDown: () => void; onUp: () => void; width?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <StepButton label="−" onPress={onDown} />
      <N size={20} w={600} style={{ minWidth: width, textAlign: 'center' }}>{value}</N>
      <StepButton label="+" onPress={onUp} />
    </View>
  );
}

/** ラベルと値の行（0.5pxの区切り線つき）。onPress があればタップできる */
export function ListRow({ title, meta, right, onPress, dot, style, minHeight = 52 }: { title: string; meta?: string; right?: React.ReactNode; onPress?: () => void; dot?: string; style?: StyleProp<ViewStyle>; minHeight?: number }) {
  const body = (
    <View style={[{ minHeight, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 6 }, style]}>
      {dot && <View style={{ width: 4, height: 28, backgroundColor: dot }} />}
      <View style={{ flex: 1 }}>
        <T size={14} w={500}>{title}</T>
        {meta ? <T size={12} c={color.sub}>{meta}</T> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** 選択肢（チップ） */
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.button, borderWidth: 1, borderColor: selected ? color.text : color.lineStrong, backgroundColor: selected ? color.text : '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <T size={13} w={selected ? 700 : 400} c={selected ? '#fff' : color.text}>{label}</T>
    </Pressable>
  );
}

/** 入力欄（枠は lineStrong、角丸6） */
export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View>
      {label ? <T size={11} c={color.sub} style={{ marginBottom: 4 }}>{label}</T> : null}
      <TextInput
        placeholderTextColor={color.faint}
        {...rest}
        style={[{ minHeight: 44, borderWidth: 1, borderColor: color.lineStrong, borderRadius: radius.input, paddingHorizontal: 12, fontFamily: font.jp, fontSize: 14, color: color.text, backgroundColor: '#fff' }, style]}
      />
    </View>
  );
}

/** お知らせ（淡いコーラルの枠） */
export function Notice({ children, tone = 'brand' }: { children: React.ReactNode; tone?: 'brand' | 'plain' }) {
  return (
    <View style={{ padding: 12, borderRadius: radius.button, backgroundColor: tone === 'brand' ? color.brandPale : color.badgeBg }}>
      <T size={12.5} style={{ lineHeight: 20 }}>{children}</T>
    </View>
  );
}
