import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NumberStepper, PrimaryButton, Sheet, T } from '@/design-system';

export function WeightSheet({ open, onClose, initial, onSave, title = '体重を記録' }: { open: boolean; onClose: () => void; initial: number; onSave: (kg: number) => void; title?: string }) {
  const [kg, setKg] = useState(initial);
  useEffect(() => {
    if (open) setKg(initial);
  }, [open, initial]);
  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ padding: 16 }}>
        <T size={17} w={900}>{title}</T>
        <View style={{ alignItems: 'center', marginVertical: 24 }}>
          <NumberStepper value={kg} onChange={setKg} step={0.1} min={30} max={200} decimals={1} unit="kg" size={44} width={130} buttonSize={56} accessibilityLabel="体重" />
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
