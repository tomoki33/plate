import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, hairline, N, OutlineButton, SectionLabel, StepButton, T } from '@/design-system';
import { useNow } from '../../components/useNow';
import { DAY_LABELS, DAY_TYPE_JP, type DayType } from '../../domain/types';
import { planMenuOf, planTypeOf, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const TYPE_COLOR: Record<DayType, string> = { high: color.brand, normal: color.brandPale2, off: color.off };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const now = useNow();
  const w = useWeek(now);
  const st = useStore();
  const { settings } = w;

  const Row = ({ k, v, meta, dot, onDown, onUp }: { k: string; v: string; meta?: string; dot?: string; onDown?: () => void; onUp?: () => void }) => (
    <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, gap: 10, paddingVertical: 6 }}>
      {dot && <View style={{ width: 4, height: 28, backgroundColor: dot }} />}
      <View style={{ flex: 1 }}>
        <T size={14} w={500}>{k}</T>
        {meta && <T size={12} c={color.sub}>{meta}</T>}
      </View>
      {onDown && <StepButton label="−" onPress={onDown} />}
      <N size={20} w={600} style={{ minWidth: onDown ? 52 : 0, textAlign: 'right' }}>{v}</N>
      {onUp && <StepButton label="+" onPress={onUp} />}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
      <T size={22} w={900}>設定</T>

      <View style={{ marginTop: 20 }}><SectionLabel>目標</SectionLabel></View>
      <Row k="目的" v={settings.goal} />
      <Row k="ペース" v={settings.pace} />
      <Row k="週合計（目安）" v={`${fmt(settings.weekKcal)} kcal`} onDown={() => st.setWeekKcal(-250)} onUp={() => st.setWeekKcal(250)} />

      <View style={{ marginTop: 22 }}><SectionLabel>日タイプ係数</SectionLabel></View>
      {(['high', 'normal', 'off'] as const).map((t) => (
        <Row key={t} k={DAY_TYPE_JP[t]} dot={TYPE_COLOR[t]} v={settings.coef[t].toFixed(2)} meta={`${fmt(w.plan.days.find((d) => d.type === t)?.kcal ?? 0)} kcal/日`} onDown={() => st.setCoef(t, -0.05)} onUp={() => st.setCoef(t, 0.05)} />
      ))}
      <Row k="P係数（g/kg）" dot={color.P} v={settings.pk.toFixed(1)} meta={`P ${w.today.P}g/日（毎日同じ）`} onDown={() => st.setPk(-0.1)} onUp={() => st.setPk(0.1)} />

      <View style={{ marginTop: 22 }}><SectionLabel>週間スケジュール</SectionLabel></View>
      {settings.plan.map((id, i) => (
        <View key={i} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, gap: 10 }}>
          <View style={{ width: 4, height: 24, backgroundColor: TYPE_COLOR[planTypeOf(id)] }} />
          <T size={13} c={i === w.ti ? color.brandText : color.sub} w={i === w.ti ? 700 : 400} style={{ width: 24 }}>{DAY_LABELS[i]}</T>
          <T size={14} style={{ flex: 1 }}>{planMenuOf(id)}</T>
          <T size={12} c={color.sub}>{DAY_TYPE_JP[planTypeOf(id)]}</T>
        </View>
      ))}

      <View style={{ marginTop: 28 }}>
        <OutlineButton label="記録をすべて消す" onPress={() => st.resetAll()} />
        <T size={11} c={color.sub} style={{ marginTop: 8 }}>体重・食事・トレの記録と設定が初期状態に戻ります。</T>
      </View>
    </ScrollView>
  );
}
