import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { N, T, color } from '@/design-system';
import type { WeightChart as Chart } from '../domain/weight';

const md = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

/**
 * 体重のグラフ。灰色の点が毎日の値、黒の2pxの線が7日平均。
 * 大きいグラフでは、黒の破線が目標体重、灰色の点線が今のペースの見込み、縦の「今日」の線、左に目盛り3本。
 */
export function WeightChartView({ chart, width, height, padL, goal, big }: { chart: Chart; width: number; height: number; padL: number; goal?: number | null; big?: boolean }) {
  if (chart.empty) return <View style={{ width, height }} />;
  const avg = chart.avg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {big && chart.ticks.map((t, i) => <Line key={i} x1={padL} x2={width} y1={t.y} y2={t.y} stroke={color.track} strokeWidth={1} />)}
        {big && chart.proj && <Line x1={chart.todayX} x2={chart.todayX} y1={8} y2={height - 22} stroke={color.lineStrong} strokeWidth={1} />}
        {big && chart.goalY !== null && <Line x1={padL} x2={width} y1={chart.goalY} y2={chart.goalY} stroke={color.text} strokeWidth={1} strokeDasharray="4 3" />}
        {chart.dots.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={2} fill={color.lineStrong} />)}
        {avg ? <Polyline points={avg} fill="none" stroke={color.text} strokeWidth={2} strokeLinejoin="round" /> : null}
        {big && chart.proj && <Line x1={chart.proj.from.x} y1={chart.proj.from.y} x2={chart.proj.to.x} y2={chart.proj.to.y} stroke={color.sub} strokeWidth={1.5} strokeDasharray="2 3" />}
      </Svg>
      {big && chart.ticks.map((t, i) => (
        <N key={i} size={10} w={500} c={color.sub} style={{ position: 'absolute', left: 0, top: t.y - 6 }}>{t.label}</N>
      ))}
      {big && goal != null && chart.goalY !== null && (
        <T size={10} w={700} style={{ position: 'absolute', right: 0, top: chart.goalY - 14 }}>目標 {goal.toFixed(1)}</T>
      )}
      {big && <T size={10} c={color.sub} style={{ position: 'absolute', left: padL, bottom: 0 }}>{md(chart.startDate)}</T>}
      {big && chart.proj && <T size={10} c={color.sub} style={{ position: 'absolute', left: chart.todayX - 10, bottom: 0 }}>今日</T>}
    </View>
  );
}
