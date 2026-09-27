import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { color } from '@/design-system';

export type TabIconName = 'today' | 'train' | 'review' | 'settings';

/** assets/tab-icons.svg（24pt・線幅1.6）。選択中は太字、「今日」の小さな四角は選択中だけbrand */
export function TabIcon({ name, focused }: { name: TabIconName; focused: boolean }) {
  const stroke = focused ? color.text : color.sub;
  const sw = focused ? 2 : 1.6;
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw}>
      {name === 'today' && (
        <G>
          <Rect x={4} y={5} width={16} height={15} rx={2} />
          <Path d="M4 9.5h16" />
          <Rect x={13} y={13} width={4} height={4} fill={focused ? color.brand : color.sub} stroke="none" />
        </G>
      )}
      {name === 'train' && (
        <G>
          <Path d="M2.5 12h19" />
          <Rect x={5.5} y={6.5} width={3} height={11} rx={0.5} />
          <Rect x={15.5} y={6.5} width={3} height={11} rx={0.5} />
        </G>
      )}
      {name === 'review' && (
        <G>
          <Path d="M4 4v16h16" />
          <Path d="M8.5 16v-4M12.5 16v-7M16.5 16v-9" />
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
