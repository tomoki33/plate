import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleProp, TextInput, View, ViewStyle } from 'react-native';
import { color, font, radius } from '../tokens';
import { StepButton } from './Button';
import { N, T } from './Text';
import { fitNumber, parseNumber } from './numberParse';

export interface NumberFieldProps {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  /** 小数の桁数（既定 0） */
  decimals?: number;
  unit?: string;
  size?: number;
  w?: 500 | 600 | 700;
  width?: number;
  c?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * 数字をタップして、キーボードで直接入力できる欄。
 * 確定（改行・フォーカスが外れる）で範囲に収めて反映する。読めない入力は元に戻す。
 */
export function NumberField({ value, onChange, min, max, decimals = 0, unit, size = 20, w = 600, width = 64, c = color.text, accessibilityLabel, style }: NumberFieldProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef<TextInput>(null);
  const shown = value.toFixed(decimals);

  useEffect(() => {
    if (editing) {
      const id = setTimeout(() => ref.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [editing]);

  const commit = () => {
    const v = parseNumber(text);
    setEditing(false);
    if (v === null) return;
    const next = fitNumber(v, { min, max, decimals });
    if (next !== value) onChange(next);
  };

  if (editing) {
    return (
      <View style={[{ minWidth: width, height: 44, justifyContent: 'center' }, style]}>
        <TextInput
          ref={ref}
          value={text}
          onChangeText={setText}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          returnKeyType="done"
          accessibilityLabel={accessibilityLabel}
          style={{ minWidth: width, height: 44, borderWidth: 1.5, borderColor: color.text, borderRadius: radius.input, backgroundColor: color.surface, textAlign: 'center', fontFamily: font.num600, fontSize: size, color: c, paddingHorizontal: 6, fontVariant: ['tabular-nums'] }}
        />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ? `${accessibilityLabel}を入力` : '数値を入力'}
      onPress={() => {
        setText(shown);
        setEditing(true);
      }}
      style={[{ minWidth: width, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: color.line, borderStyle: 'dashed' }, style]}
    >
      <N size={size} w={w} c={c}>
        {shown}
        {unit ? <T size={Math.max(11, size * 0.55)} c={color.sub}> {unit}</T> : null}
      </N>
    </Pressable>
  );
}

export interface NumberStepperProps extends NumberFieldProps {
  /** ＋−で動かす幅 */
  step: number;
  /** ＋−ボタンの大きさ */
  buttonSize?: number;
}

/** −（数字：タップで直接入力）＋ */
export function NumberStepper({ step, buttonSize = 44, value, onChange, min, max, decimals = 0, ...rest }: NumberStepperProps) {
  const bump = (d: number) => onChange(fitNumber(value + d, { min, max, decimals }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <StepButton label="−" size={buttonSize} onPress={() => bump(-step)} />
      <NumberField value={value} onChange={onChange} min={min} max={max} decimals={decimals} {...rest} />
      <StepButton label="+" size={buttonSize} onPress={() => bump(step)} />
    </View>
  );
}
