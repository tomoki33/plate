import React from 'react';
import { View } from 'react-native';
import { color } from '../tokens';
import { StepButton } from './Button';
import { N, T } from './Text';

export interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  /** ＋−で動かす幅 */
  step: number;
  min?: number;
  max?: number;
  /** 小数の桁数（既定 0） */
  decimals?: number;
  unit?: string;
  size?: number;
  width?: number;
  buttonSize?: number;
  /** 数字の色 */
  c?: string;
  /** 読み上げ用の名前（「体重」など） */
  accessibilityLabel?: string;
}

const fit = (v: number, o: { min?: number; max?: number; decimals: number }) => {
  const p = 10 ** o.decimals;
  return Math.round(Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v)) * p) / p;
};

/** −（数字）＋。範囲に収め、小数の桁数にそろえる */
export function NumberStepper({ step, buttonSize = 44, value, onChange, min, max, decimals = 0, unit, size = 20, width = 64, c = color.text, accessibilityLabel }: NumberStepperProps) {
  const bump = (d: number) => onChange(fit(value + d, { min, max, decimals }));
  return (
    <View accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <StepButton label="−" size={buttonSize} onPress={() => bump(-step)} />
      <View style={{ minWidth: width, alignItems: 'center' }}>
        <N size={size} w={600} c={c}>
          {value.toFixed(decimals)}
          {unit ? <T size={Math.max(11, size * 0.55)} c={color.sub}> {unit}</T> : null}
        </N>
      </View>
      <StepButton label="+" size={buttonSize} onPress={() => bump(step)} />
    </View>
  );
}
