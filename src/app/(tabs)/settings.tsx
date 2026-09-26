import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, CardRow, Chip, InlineStepper, N, Notice, PrimaryButton, Segmented, T, color, hairline, radius } from '@/design-system';
import { AccountSheetsHost } from '../../components/AccountSheets';
import { DaySpreadSection, ProteinSection } from '../../components/DaySpread';
import { useNow } from '../../components/useNow';
import { computeTargets } from '../../domain/engine';
import { ACTIVITY_LEVELS, GOAL_JP, checkWarnings, paceOptions, type Goal } from '../../domain/nutrition';
import { DAY_LABELS, DAY_TYPE_JP, type DayType } from '../../domain/types';
import { avg7 } from '../../domain/weight';
import { readBodyComposition } from '../../services/healthkit';
import { backupLabel } from '../../store/backupRunner';
import { templateType, useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const typeColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const PLAN_JP = { free: '無料プラン', trial: '無料体験中', paid: '有料プラン' } as const;
const PROVIDER_JP: Record<string, string> = { apple: 'Apple', google: 'Google', email: 'メール' };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const st = useStore();
  const { profile } = w;
  const [editDay, setEditDay] = useState<number | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [paceOpen, setPaceOpen] = useState(false);
  const [sheet, setSheet] = useState<null | 'login' | 'logout'>(null);
  const [hk, setHk] = useState<string | null>(null);

  // 高い日・通常の日・オフの日の1日あたり kcal（日タイプ連動を使った場合の値）
  const dayKcal = useMemo(() => {
    const types: DayType[] = w.weekPlan.map((id) => templateType(w.templates, id));
    const orig = computeTargets({ weekKcal: w.weekKcal, coef: profile.coef, pk: profile.pk, weight: w.weight, todayIndex: 0, plan: types, todayType: null, linked: true }).orig;
    const pick = (t: DayType, fallback: number) => orig.find((d) => d.type === t)?.kcal ?? fallback;
    const normal = pick('normal', Math.round(w.weekKcal / 7));
    return { high: pick('high', Math.round(normal * profile.coef.high)), normal, off: pick('off', Math.round(normal * profile.coef.off)) };
  }, [w.weekPlan, w.templates, w.weekKcal, w.weight, profile.coef, profile.pk]);

  const warnings = checkWarnings(profile, w.weight, w.weekKcal, now);
  const opts = paceOptions(profile.goal, w.weight);
  const trialLeft = st.trialStartedAt ? Math.max(0, Math.ceil((st.trialStartedAt + 14 * 86400000 - now.getTime()) / 86400000)) : 0;
  const avg = avg7(st.weights, now) ?? w.weight;
  const goalWeight = profile.goalWeightKg ?? Math.round((avg + (profile.goal === 'bulk' ? 3 : profile.goal === 'cut' ? -3 : 0)) * 2) / 2;
  const account = st.account;

  const importHealth = async () => {
    setHk('読み込み中…');
    const r = await readBodyComposition(30);
    if (!r.available) return setHk(Platform.OS === 'ios' ? 'ヘルスケアを使えませんでした（開発ビルドが必要です）。' : 'ヘルスケアは iPhone でのみ使えます。');
    r.rows.forEach((x) => st.setWeight(x.date, x.kg, { source: 'healthkit', bodyFat: x.bodyFatPct, silent: true }));
    setHk(r.rows.length ? `${r.rows.length}日分の体重を取り込みました。` : '取り込める体重がありませんでした。');
  };

  const label = (text: string) => <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{text}</T>;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 30 }}>
        <T size={22} w={900} style={{ paddingHorizontal: 20 }}>設定</T>

        {/* 1. アカウント */}
        <View style={{ marginTop: 14 }}>
          {account ? (
            <Card style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={14} w={500} numberOfLines={1}>{account.email ?? 'ログイン中'}</T>
                <T size={11} c={color.sub}>{PROVIDER_JP[account.provider] ?? 'メール'}でログイン中・バックアップ {st.lastBackupAt ? backupLabel(st.lastBackupAt, now) : 'まだ'}</T>
              </View>
              <Badge high>{st.lastBackupAt ? '同期済み' : '未バックアップ'}</Badge>
            </Card>
          ) : (
            <Card style={{ padding: 14, gap: 12 }}>
              <View style={{ gap: 3 }}>
                <T size={14} w={700}>ログインしていません</T>
                <T size={12} c={color.sub} style={{ lineHeight: 19 }}>記録はこの端末にだけ保存されています。機種変更に備えてバックアップできます。</T>
              </View>
              <PrimaryButton label="ログインしてバックアップ" onPress={() => setSheet('login')} style={{ height: 48 }} />
            </Card>
          )}
        </View>

        {/* 2. 目標 */}
        {label('目標')}
        <Card>
          <CardRow title="目的" right={<T size={14} c={color.badgeFg}>{GOAL_JP[profile.goal]}　{goalOpen ? '˄' : '˅'}</T>} onPress={() => setGoalOpen(!goalOpen)} />
          {goalOpen && (
            <View style={{ padding: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <Segmented value={profile.goal} onChange={(g: Goal) => st.updateProfile({ goal: g }, w.weight)} options={(['cut', 'maintain', 'bulk'] as const).map((g) => ({ value: g, label: GOAL_JP[g] }))} />
            </View>
          )}
          <CardRow
            title="目標体重"
            right={
              <InlineStepper
                value={`${goalWeight.toFixed(1)} kg`}
                width={70}
                sub
                onDown={() => st.setGoalWeight(goalWeight - 0.5)}
                onUp={() => st.setGoalWeight(goalWeight + 0.5)}
              />
            }
          />
          <CardRow
            title="ペース"
            right={<T size={14} c={color.badgeFg}>{profile.goal === 'maintain' ? '維持' : `${profile.pace > 0 ? '+' : '−'}${Math.abs(profile.pace).toFixed(2)} kg/週`}　{paceOpen ? '˄' : '˅'}</T>}
            onPress={() => profile.goal !== 'maintain' && setPaceOpen(!paceOpen)}
          />
          {paceOpen && profile.goal !== 'maintain' && (
            <View style={{ padding: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              {opts.map((o) => (
                <Chip key={o} label={`${o > 0 ? '+' : '−'}${Math.abs(o).toFixed(2)}`} selected={Math.abs(o - profile.pace) < 0.005} onPress={() => st.updateProfile({ pace: o }, w.weight)} />
              ))}
            </View>
          )}
          <CardRow
            title="週の合計"
            meta={profile.weekAdjustKcal !== 0 ? `ペースの見直しで ${profile.weekAdjustKcal > 0 ? '+' : '−'}${fmt(Math.abs(profile.weekAdjustKcal))}kcal を反映中・押すと元に戻す` : `1日平均 ${fmt(w.weekKcal / 7)}kcal・維持カロリーの推定 ${fmt(profile.tdee)}kcal`}
            right={<N size={14} w={600} c={color.badgeFg}>{fmt(w.weekKcal)} kcal</N>}
            onPress={profile.weekAdjustKcal !== 0 ? () => st.addWeekAdjust(-profile.weekAdjustKcal, `週の合計を ${fmt(w.weekKcal - profile.weekAdjustKcal)}kcal に戻しました`) : undefined}
            minHeight={60}
            last
          />
        </Card>
        {warnings.map((x) => (
          <View key={x.code} style={{ marginHorizontal: 16, marginTop: 8 }}><Notice>{x.text}</Notice></View>
        ))}

        {/* 3. 日ごとの食べる量 */}
        <DaySpreadSection coef={profile.coef} kcal={dayKcal} linked={w.features.linkedTargets} onCoef={(c) => st.setCoefs(c)} />

        {/* 4. たんぱく質（毎日同じ量） */}
        <ProteinSection pk={profile.pk} weight={w.weight} onPk={(v) => st.setPkTo(v)} />

        {/* 5. 週間スケジュール */}
        {label('週間スケジュール')}
        <Card>
          {w.weekPlan.map((id, i) => {
            const type = templateType(w.templates, id);
            return (
              <View key={i}>
                <Pressable accessibilityRole="button" onPress={() => setEditDay(editDay === i ? null : i)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: i === 6 && editDay !== i ? 0 : hairline, borderBottomColor: color.line }}>
                  <T size={12} w={700} c={i === w.ti ? color.brandText : color.sub} style={{ width: 28 }}>{DAY_LABELS[i]}</T>
                  <T size={14} style={{ flex: 1 }}>{id ? (w.templates.find((t) => t.id === id)?.name ?? '—') : 'オフ'}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: typeColor(type) }} />
                    <T size={11} c={color.sub}>{DAY_TYPE_JP[type]}</T>
                  </View>
                </Pressable>
                {editDay === i && (
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', padding: 12, borderBottomWidth: i === 6 ? 0 : hairline, borderBottomColor: color.line }}>
                    <Chip label="オフ" selected={id === null} onPress={() => (st.setWeekPlan(i, null), setEditDay(null))} />
                    {w.templates.map((t) => (
                      <Chip key={t.id} label={t.name} selected={id === t.id} onPress={() => (st.setWeekPlan(i, t.id), setEditDay(null))} />
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        {/* ここから先は、目標エンジンと機能のための設定 */}
        {label('基本情報')}
        <Card>
          <View style={{ padding: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <Segmented value={profile.sex} onChange={(v) => st.updateProfile({ sex: v }, w.weight)} options={[{ value: 'male' as const, label: '男性' }, { value: 'female' as const, label: '女性' }]} />
          </View>
          <CardRow title="生まれた年" right={<InlineStepper value={String(profile.birthYear)} width={56} sub onDown={() => st.updateProfile({ birthYear: Math.max(1950, profile.birthYear - 1) }, w.weight)} onUp={() => st.updateProfile({ birthYear: Math.min(now.getFullYear() - 15, profile.birthYear + 1) }, w.weight)} />} />
          <CardRow title="身長" right={<InlineStepper value={`${profile.heightCm} cm`} width={64} sub onDown={() => st.updateProfile({ heightCm: Math.max(130, profile.heightCm - 1) }, w.weight)} onUp={() => st.updateProfile({ heightCm: Math.min(220, profile.heightCm + 1) }, w.weight)} />} />
          <View style={{ padding: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {ACTIVITY_LEVELS.map((a) => (
              <Chip key={a.value} label={`活動量：${a.label}`} selected={profile.activity === a.value} onPress={() => st.updateProfile({ activity: a.value }, w.weight)} />
            ))}
          </View>
        </Card>
        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 6 }}>基本情報を変えると、維持カロリーの推定は式から出し直します。</T>

        {label('トレーニングのテンプレート')}
        <Card>
          {w.templates.map((t) => (
            <CardRow key={t.id} title={t.name} meta={`${t.exercises.length}種目・日タイプ ${DAY_TYPE_JP[t.defaultDayType]}`} right={<T size={12} c={color.sub}>編集 ›</T>} onPress={() => router.push({ pathname: '/template/[id]', params: { id: t.id } })} />
          ))}
          <CardRow title="＋ テンプレートをつくる" onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new' } })} last />
        </Card>

        {label('食事')}
        <Card>
          <CardRow title="マイ食品" meta={`${st.myFoods.length}件`} right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/my-foods')} />
          <CardRow title="マイセット" meta={`${st.mealSets.length}件`} right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/my-sets')} last />
        </Card>

        {label('Apple ヘルスケア')}
        <Card>
          <CardRow
            title="体重を自動で取り込む"
            meta="体組成計の値を、読み込みだけします"
            right={<Switch value={st.healthSync} onValueChange={(v) => { st.setHealthSync(v); if (v) void importHealth(); }} trackColor={{ true: color.text, false: color.lineStrong }} thumbColor={color.surface} />}
            minHeight={60}
          />
          <CardRow title="いま取り込む（直近30日）" right={<T size={13} w={700}>取り込む</T>} onPress={importHealth} last />
        </Card>
        {hk && <T size={12} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 6 }}>{hk}</T>}

        {label('プランとデータ')}
        <Card>
          <CardRow
            title={PLAN_JP[w.entitlement]}
            meta={w.entitlement === 'trial' ? `あと${trialLeft}日。体験が終わると、日タイプ連動などが有料になります` : w.entitlement === 'free' ? '目標は毎日同じ・AI入力は1日3回・レビューは直近2週' : 'すべての機能が使えます'}
            right={<T size={12} c={color.sub}>{w.entitlement === 'paid' ? '管理 ›' : 'プランを見る ›'}</T>}
            onPress={() => router.push('/paywall')}
            minHeight={60}
          />
          <CardRow title="書き出し・バックアップ・削除" meta="CSV、バックアップ、記録の削除、出典" right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/data')} minHeight={60} last />
        </Card>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 14 }}>PLATE　数字はすべて目安で、医療的な助言ではありません。</T>
        {__DEV__ && (
          <View style={{ marginTop: 10 }}>
            <Pressable accessibilityRole="button" onPress={() => st.setPaid(!st.paid)} style={{ marginHorizontal: 16, height: 44, borderRadius: radius.button, borderWidth: hairline, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} c={color.sub}>{w.entitlement === 'paid' ? '（開発用）有料をオフにする' : '（開発用）有料として扱う'}</T>
            </Pressable>
          </View>
        )}

        {/* 6. ログアウト（ログイン中だけ） */}
        {account && (
          <Pressable accessibilityRole="button" onPress={() => setSheet('logout')} style={{ marginHorizontal: 16, marginTop: 20, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, backgroundColor: color.surface }}>
            <T size={14} c={color.brandText}>ログアウト</T>
          </Pressable>
        )}
      </ScrollView>

      <AccountSheetsHost sheet={sheet} onClose={() => setSheet(null)} />
    </View>
  );
}
