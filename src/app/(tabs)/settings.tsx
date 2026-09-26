import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, ListRow, N, Notice, OutlineButton, SectionLabel, Segmented, Stepper, T, color, hairline } from '@/design-system';
import { useNow } from '../../components/useNow';
import { DAY_LABELS, DAY_TYPE_JP, type DayType } from '../../domain/types';
import { ACTIVITY_LEVELS, GOAL_JP, checkWarnings, paceOptions, type Goal } from '../../domain/nutrition';
import { readBodyComposition } from '../../services/healthkit';
import { templateType, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
/** 日タイプの色（配色が変わっても読み直せるよう関数にする） */
const typeColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const PLAN_JP = { free: '無料プラン', trial: '無料体験中', paid: '有料プラン' } as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const st = useStore();
  const { profile } = w;
  const [editDay, setEditDay] = useState<number | null>(null);
  const [hk, setHk] = useState<string | null>(null);

  const warnings = checkWarnings(profile, w.weight, w.weekKcal, now);
  const opts = paceOptions(profile.goal, w.weight);
  const trialLeft = st.trialStartedAt ? Math.max(0, Math.ceil((st.trialStartedAt + 14 * 86400000 - now.getTime()) / 86400000)) : 0;

  const importHealth = async () => {
    setHk('読み込み中…');
    const r = await readBodyComposition(30);
    if (!r.available) return setHk(Platform.OS === 'ios' ? 'ヘルスケアを使えませんでした（開発ビルドが必要です）。' : 'ヘルスケアは iPhone でのみ使えます。');
    r.rows.forEach((x) => st.setWeight(x.date, x.kg, { source: 'healthkit', bodyFat: x.bodyFatPct, silent: true }));
    setHk(r.rows.length ? `${r.rows.length}日分の体重を取り込みました。` : '取り込める体重がありませんでした。');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
      <T size={22} w={900}>設定</T>

      <View style={{ marginTop: 20 }}><SectionLabel>プラン</SectionLabel></View>
      <ListRow
        title={PLAN_JP[w.entitlement]}
        meta={w.entitlement === 'trial' ? `あと${trialLeft}日。体験が終わると、日タイプ連動などが有料になります` : w.entitlement === 'free' ? '目標は毎日同じ・AI入力は1日3回・レビューは直近2週' : 'すべての機能が使えます'}
        right={<T size={13} w={700}>{w.entitlement === 'paid' ? '管理' : 'プランを見る ›'}</T>}
        onPress={() => router.push('/paywall')}
      />

      <View style={{ marginTop: 22 }}><SectionLabel>目標</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented value={profile.goal} onChange={(g: Goal) => st.updateProfile({ goal: g }, w.weight)} options={(['cut', 'maintain', 'bulk'] as const).map((g) => ({ value: g, label: GOAL_JP[g] }))} />
      </View>
      {profile.goal !== 'maintain' && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {opts.map((o) => (
            <Chip key={o} label={`${o > 0 ? '+' : '−'}${Math.abs(o).toFixed(2)} kg/週`} selected={Math.abs(o - profile.pace) < 0.005} onPress={() => st.updateProfile({ pace: o }, w.weight)} />
          ))}
        </View>
      )}
      <ListRow title="週合計（目安）" meta={`1日平均 ${fmt(w.weekKcal / 7)}kcal・維持カロリーの推定 ${fmt(profile.tdee)}kcal${profile.tdeeWeek ? '（記録で補正済み）' : ''}`} right={<N size={20} w={600}>{fmt(w.weekKcal)}<T size={11} c={color.sub}> kcal</T></N>} minHeight={64} />
      {warnings.map((x) => (
        <View key={x.code} style={{ marginTop: 8 }}><Notice>{x.text}</Notice></View>
      ))}

      <View style={{ marginTop: 22 }}><SectionLabel>基本情報</SectionLabel></View>
      <View style={{ marginTop: 8 }}>
        <Segmented value={profile.sex} onChange={(v) => st.updateProfile({ sex: v }, w.weight)} options={[{ value: 'male' as const, label: '男性' }, { value: 'female' as const, label: '女性' }]} />
      </View>
      <ListRow title="生まれた年" right={<Stepper value={String(profile.birthYear)} width={56} onDown={() => st.updateProfile({ birthYear: Math.max(1950, profile.birthYear - 1) }, w.weight)} onUp={() => st.updateProfile({ birthYear: Math.min(now.getFullYear() - 15, profile.birthYear + 1) }, w.weight)} />} />
      <ListRow title="身長" right={<Stepper value={`${profile.heightCm} cm`} width={64} onDown={() => st.updateProfile({ heightCm: Math.max(130, profile.heightCm - 1) }, w.weight)} onUp={() => st.updateProfile({ heightCm: Math.min(220, profile.heightCm + 1) }, w.weight)} />} />
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {ACTIVITY_LEVELS.map((a) => (
          <Chip key={a.value} label={`活動量：${a.label}`} selected={profile.activity === a.value} onPress={() => st.updateProfile({ activity: a.value }, w.weight)} />
        ))}
      </View>
      <T size={11} c={color.sub} style={{ marginTop: 6 }}>基本情報を変えると、維持カロリーの推定は式から出し直します。</T>

      <View style={{ marginTop: 22 }}><SectionLabel>日タイプ係数</SectionLabel></View>
      {(['high', 'normal', 'off'] as const).map((t) => (
        <ListRow key={t} title={DAY_TYPE_JP[t]} dot={typeColor(t)} meta={`${fmt(w.plan.days.find((d) => d.type === t)?.kcal ?? 0)} kcal/日`} minHeight={60} right={<Stepper value={profile.coef[t].toFixed(2)} width={52} onDown={() => st.setCoef(t, -0.05)} onUp={() => st.setCoef(t, 0.05)} />} />
      ))}
      <ListRow title="P係数（g/kg）" dot={color.P} meta={`P ${w.today.P}g/日（毎日同じ）`} minHeight={60} right={<Stepper value={profile.pk.toFixed(1)} width={52} onDown={() => st.setPk(-0.1)} onUp={() => st.setPk(0.1)} />} />
      {!w.features.linkedTargets && <T size={11} c={color.sub} style={{ marginTop: 6 }}>日タイプ係数は、有料プラン（体験中を含む）で目標に反映されます。</T>}

      <View style={{ marginTop: 22 }}><SectionLabel>週間スケジュール</SectionLabel></View>
      {w.weekPlan.map((id, i) => {
        const type = templateType(w.templates, id);
        return (
          <View key={i}>
            <ListRow
              title={`${DAY_LABELS[i]}　${id ? (w.templates.find((t) => t.id === id)?.name ?? '—') : 'オフ'}`}
              dot={typeColor(type)}
              minHeight={48}
              right={<T size={12} c={color.sub}>{DAY_TYPE_JP[type]} ›</T>}
              onPress={() => setEditDay(editDay === i ? null : i)}
            />
            {editDay === i && (
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingVertical: 10 }}>
                <Chip label="オフ" selected={id === null} onPress={() => (st.setWeekPlan(i, null), setEditDay(null))} />
                {w.templates.map((t) => (
                  <Chip key={t.id} label={t.name} selected={id === t.id} onPress={() => (st.setWeekPlan(i, t.id), setEditDay(null))} />
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ marginTop: 22 }}><SectionLabel>トレのテンプレート</SectionLabel></View>
      {w.templates.map((t) => (
        <ListRow key={t.id} title={t.name} meta={`${t.exercises.length}種目・日タイプ ${DAY_TYPE_JP[t.defaultDayType]}`} right={<T size={12} c={color.sub}>編集 ›</T>} onPress={() => router.push({ pathname: '/template/[id]', params: { id: t.id } })} />
      ))}
      <ListRow title="＋ テンプレートをつくる" onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new' } })} />

      <View style={{ marginTop: 22 }}><SectionLabel>食事</SectionLabel></View>
      <ListRow title="マイ食品" meta={`${st.myFoods.length}件`} right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/my-foods')} />
      <ListRow title="マイセット" meta={`${st.mealSets.length}件`} right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/my-sets')} />

      <View style={{ marginTop: 22 }}><SectionLabel>Apple ヘルスケア</SectionLabel></View>
      <ListRow title="体重・体脂肪率を取り込む" meta="体組成計の値を、読み込みだけします（直近30日）" right={<T size={13} w={700}>取り込む</T>} onPress={importHealth} minHeight={60} />
      {hk && <T size={12} c={color.sub} style={{ marginTop: 6 }}>{hk}</T>}

      <View style={{ marginTop: 22 }}><SectionLabel>データ</SectionLabel></View>
      <ListRow title="書き出し・バックアップ・削除" meta="CSV、ログインしてバックアップ、記録の削除、出典" right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/data')} minHeight={60} />

      <View style={{ height: hairline, backgroundColor: color.line, marginTop: 18 }} />
      <T size={11} c={color.sub} style={{ marginTop: 10, lineHeight: 17 }}>PLATE　数字はすべて目安で、医療的な助言ではありません。</T>
      <View style={{ marginTop: 12 }}>{__DEV__ && <OutlineButton label={w.entitlement === 'paid' ? '（開発用）有料をオフにする' : '（開発用）有料として扱う'} onPress={() => st.setPaid(!st.paid)} />}</View>
    </ScrollView>
  );
}
