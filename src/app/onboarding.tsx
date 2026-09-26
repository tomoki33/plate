import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, ListRow, N, Notice, PrimaryButton, SectionLabel, Segmented, Stepper, T, color, hairline, radius } from '@/design-system';
import { ACTIVITY_LEVELS, DEFAULT_PROFILE, GOAL_JP, checkWarnings, clampPace, defaultPace, initialTdee, paceOptions, weekKcalOf, type Goal, type Sex } from '../domain/nutrition';
import { TRIAL_DAYS } from '../domain/entitlement';
import { useStore } from '../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();

/** 初回起動：プロフィールを入れて、週のカロリー目標を出す */
export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const complete = useStore((s) => s.completeOnboarding);
  const [sex, setSex] = useState<Sex>(DEFAULT_PROFILE.sex);
  const [birthYear, setBirthYear] = useState(1995);
  const [heightCm, setHeightCm] = useState(172);
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState(1.55);
  const [goal, setGoal] = useState<Goal>('cut');
  const [pace, setPace] = useState(defaultPace('cut', 70));

  const p = useMemo(() => {
    const now = new Date();
    const clamped = clampPace(goal, weight, pace);
    const profile = { sex, birthYear, heightCm, activity, goal, pace: clamped };
    const tdee = Math.round(initialTdee(profile, weight, now));
    const week = weekKcalOf(tdee, clamped);
    return { profile, tdee, week, warnings: checkWarnings(profile, weight, week, now), options: paceOptions(goal, weight), pace: clamped };
  }, [sex, birthYear, heightCm, weight, activity, goal, pace]);

  const pickGoal = (g: Goal) => {
    setGoal(g);
    setPace(defaultPace(g, weight));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32, paddingHorizontal: 22 }}>
      <T size={28} w={900} style={{ letterSpacing: 3 }}>PLATE</T>
      <T size={13} c={color.sub} style={{ marginTop: 4 }}>今日のトレで、今日の一皿が決まる。</T>
      <T size={13} style={{ marginTop: 20, lineHeight: 21 }}>あなたの週のカロリーの目安を出すために、体のことを少しだけ教えてください。あとから設定で変えられます。</T>

      <View style={{ marginTop: 22 }}><SectionLabel>基本情報</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented value={sex} onChange={setSex} options={[{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }]} />
      </View>
      <ListRow title="生まれた年" right={<Stepper value={String(birthYear)} width={56} onDown={() => setBirthYear((v) => Math.max(1950, v - 1))} onUp={() => setBirthYear((v) => Math.min(new Date().getFullYear() - 15, v + 1))} />} />
      <ListRow title="身長" right={<Stepper value={`${heightCm} cm`} width={64} onDown={() => setHeightCm((v) => Math.max(130, v - 1))} onUp={() => setHeightCm((v) => Math.min(220, v + 1))} />} />
      <ListRow title="体重" right={<Stepper value={`${weight.toFixed(1)} kg`} width={72} onDown={() => setWeight((v) => Math.max(30, Math.round((v - 0.1) * 10) / 10))} onUp={() => setWeight((v) => Math.min(200, Math.round((v + 0.1) * 10) / 10))} />} />

      <View style={{ marginTop: 22 }}><SectionLabel>普段の活動量</SectionLabel></View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {ACTIVITY_LEVELS.map((a) => (
          <Chip key={a.value} label={a.label} selected={activity === a.value} onPress={() => setActivity(a.value)} />
        ))}
      </View>
      <T size={12} c={color.sub} style={{ marginTop: 6 }}>{ACTIVITY_LEVELS.find((a) => a.value === activity)?.note}</T>

      <View style={{ marginTop: 22 }}><SectionLabel>目的とペース</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented value={goal} onChange={pickGoal} options={(['cut', 'maintain', 'bulk'] as const).map((g) => ({ value: g, label: GOAL_JP[g] }))} />
      </View>
      {goal !== 'maintain' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {p.options.map((o) => (
              <Chip key={o} label={`${o > 0 ? '+' : '−'}${Math.abs(o).toFixed(2)} kg/週`} selected={Math.abs(o - p.pace) < 0.005} onPress={() => setPace(o)} />
            ))}
          </View>
          <T size={12} c={color.sub} style={{ marginTop: 6 }}>{goal === 'cut' ? '減量は体重の0.5〜1%/週の範囲で選べます。' : '増量は体重の0.25〜0.5%/週の範囲で選べます。'}</T>
        </>
      )}

      <View style={{ marginTop: 24, padding: 16, borderRadius: radius.card, backgroundColor: '#fff', borderWidth: hairline, borderColor: color.line }}>
        <T size={11} c={color.sub}>週の目安</T>
        <N size={40} w={600} style={{ lineHeight: 44 }}>{fmt(p.week)}<T size={13} c={color.sub}> kcal / 週</T></N>
        <T size={12} c={color.sub} style={{ marginTop: 4 }}>
          1日平均 {fmt(p.week / 7)}kcal・維持カロリーの推定 {fmt(p.tdee)}kcal。数字はすべて目安で、記録がたまると実データで補正します。
        </T>
      </View>
      {p.warnings.map((w) => (
        <View key={w.code} style={{ marginTop: 10 }}><Notice>{w.text}</Notice></View>
      ))}

      <PrimaryButton label="はじめる" style={{ marginTop: 24 }} disabled={p.warnings.some((w) => w.code === 'below-floor')} onPress={() => complete({ sex, birthYear, heightCm, activity, goal, pace: p.pace, weight })} />
      <T size={11} c={color.sub} style={{ marginTop: 10, textAlign: 'center' }}>はじめの{TRIAL_DAYS}日間は、有料の機能もすべて使えます。</T>
    </ScrollView>
  );
}
