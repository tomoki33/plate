import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { color, N, PrimaryButton, Sheet, StepButton, T } from '@/design-system';

export function WeightSheet({ open, onClose, initial, onSave }: { open: boolean; onClose: () => void; initial: number; onSave: (kg: number) => void }) {
  const [kg, setKg] = useState(initial);
  useEffect(() => {
    if (open) setKg(initial);
  }, [open, initial]);
  const step = (d: number) => setKg((x) => Math.round((x + d) * 10) / 10);
  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ padding: 16 }}>
        <T size={17} w={900}>体重を記録</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginVertical: 24 }}>
          <StepButton label="−" size={56} onPress={() => step(-0.1)} />
          <N size={52} w={600}>{kg.toFixed(1)}<T size={16} c={color.sub}> kg</T></N>
          <StepButton label="+" size={56} onPress={() => step(0.1)} />
        </View>
        <PrimaryButton
          label="記録"
          onPress={() => {
            onSave(kg);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
