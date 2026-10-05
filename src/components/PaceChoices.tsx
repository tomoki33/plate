import React from 'react';
import { View } from 'react-native';
import { Chip, T, color } from '@/design-system';
import { paceHint, paceInfo, type Goal } from '../domain/nutrition';

/** ペースの選択肢。各候補の下に「体重の何%/週」と速さの一言を添える */
export function PaceChoices({ goal, weightKg, options, pace, onPick, label }: {
  goal: Goal;
  weightKg: number;
  options: number[];
  pace: number;
  onPick: (pace: number) => void;
  label: (pace: number) => string;
}) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const info = paceInfo(goal, weightKg, o);
          return (
            <View key={o} style={{ alignItems: 'center' }}>
              <Chip label={label(o)} selected={Math.abs(o - pace) < 0.005} onPress={() => onPick(o)} />
              {info ? <T size={11} c={color.sub} style={{ marginTop: 3 }}>{`体重の${info.pct}% ・${info.word}`}</T> : null}
            </View>
          );
        })}
      </View>
      {goal !== 'maintain' ? <T size={12} c={color.sub} style={{ marginTop: 8 }}>{paceHint(goal)}</T> : null}
    </>
  );
}
