import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { color } from '@/design-system';

/** カメラ（assets/icon-camera.svg・線幅1.6） */
export function CameraIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={1.6}>
      <Rect x={3} y={7} width={18} height={13} rx={2} />
      <Path d="M8.5 7l1.5-2.5h4L15.5 7" />
      <Circle cx={12} cy={13.5} r={3.5} />
    </Svg>
  );
}

/** 写真（assets/icon-photo.svg・線幅1.6） */
export function PhotoIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color.text} strokeWidth={1.6}>
      <Rect x={3.5} y={4.5} width={17} height={15} rx={2} />
      <Path d="M3.5 16l5-5 4 4 3-3 5 5" />
      <Circle cx={15.5} cy={8.5} r={1.5} />
    </Svg>
  );
}
