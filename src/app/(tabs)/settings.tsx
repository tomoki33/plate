import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '../../components/coach/Frames';
import { Badge, Bar, Card, CardRow, Chip, InlineStepper, N, Notice, PrimaryButton, Segmented, Sheet, T, color, hairline, radius } from '@/design-system';
import { AccountSheetsHost } from '../../components/AccountSheets';
import { CoachBadge } from '../../components/coach/CoachBits';
import { CoachModeSection } from '../../components/coach/CoachModeSection';
import { getFoodsByIds } from '../../db/repo';
import type { FoodItem, MealSet } from '../../domain/models';
import { DaySpreadSection, ProteinSection } from '../../components/DaySpread';
import { useNow } from '../../components/useNow';
import { TRIAL_DAYS } from '../../domain/entitlement';
import { computeTargets } from '../../domain/engine';
import { ACTIVITY_LEVELS, GOAL_JP, ageOf, bmr, checkWarnings, nearestActivity, paceOptions, type Goal } from '../../domain/nutrition';
import { DAY_LABELS, DAY_TYPE_JP, type DayType } from '../../domain/types';
import { avg7 } from '../../domain/weight';
import { readBodyComposition } from '../../services/healthkit';
import { backupLabel } from '../../store/backupRunner';
import { templateType, useWeek } from '../../store/selectors';
import { FREE_LAUNCH } from '../../lib/flags';
import { useCoach, useEngineOverrides, useIsManaged } from '../../store/coachStore';
import { USUAL_SLOTS, useStore, type UsualSlot } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const typeColor = (t: DayType): string => (t === 'high' ? color.brand : t === 'normal' ? color.brandPale2 : color.off);
const PLAN_JP = { view_only: '見るだけ', trial: '無料体験中', paid: '購入済み' } as const;
const PROVIDER_JP: Record<string, string> = { apple: 'Apple', email: 'メール' };

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
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
  const [usualSlot, setUsualSlot] = useState<UsualSlot | null>(null);
  const overrides = useEngineOverrides();
  const managed = useIsManaged();
  const managedPlan = useCoach((s) => s.managed);

  // 高い日・通常の日・オフの日の1日あたり kcal（日タイプ連動を使った場合の値）
  const dayKcal = useMemo(() => {
    const types: DayType[] = w.weekPlan.map((id) => templateType(w.templates, id));
    const orig = computeTargets({ weekKcal: w.weekKcal, coef: profile.coef, pk: profile.pk, weight: w.weight, todayIndex: 0, plan: types, todayType: null, linked: true, ...overrides }).orig;
    const pick = (t: DayType, fallback: number) => orig.find((d) => d.type === t)?.kcal ?? fallback;
    const normal = pick('normal', Math.round(w.weekKcal / 7));
    return { high: pick('high', Math.round(normal * profile.coef.high)), normal, off: pick('off', Math.round(normal * profile.coef.off)) };
  }, [w.weekPlan, w.templates, w.weekKcal, w.weight, profile.coef, profile.pk, overrides]);

  const warnings = checkWarnings(profile, w.weight, w.weekKcal, now);
  const opts = paceOptions(profile.goal, w.weight);
  const trialLeft = st.trialStartedAt ? Math.max(0, Math.ceil((st.trialStartedAt + TRIAL_DAYS * 86400000 - now.getTime()) / 86400000)) : 0;
  const avg = avg7(st.weights, now) ?? w.weight;
  const goalWeight = profile.goalWeightKg ?? Math.round((avg + (profile.goal === 'bulk' ? 3 : profile.goal === 'cut' ? -3 : 0)) * 2) / 2;
  const account = st.account;
  const age = ageOf(profile.birthYear, now);
  const bmrNow = Math.round(bmr(profile, w.weight, age));
  const activity = nearestActivity(profile.activity);

  const importHealth = async () => {
    setHk('読み込み中…');
    const r = await readBodyComposition(30);
    if (!r.available) return setHk(Platform.OS === 'ios' ? 'ヘルスケアを使えませんでした（開発ビルドが必要です）。' : 'ヘルスケアは iPhone でのみ使えます。');
    r.rows.forEach((x) => st.setWeight(x.date, x.kg, { source: 'healthkit', bodyFat: x.bodyFatPct, silent: true }));
    setHk(r.rows.length ? `${r.rows.length}日分の体重を取り込みました。` : '取り込める体重がありませんでした。');
  };

  const label = (text: string) => <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 6 }}>{text}</T>;
  /** プロフィールの1行（高さ56以上）。右に、読み取り専用の値・±・切り替え */
  const profRow = (title: string, sub: string, right: React.ReactNode, last?: boolean) => (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 6, paddingLeft: 14, paddingRight: 6, borderBottomWidth: last ? 0 : hairline, borderBottomColor: color.line }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T size={14}>{title}</T>
        {sub ? <T size={11} c={color.sub}>{sub}</T> : null}
      </View>
      {right}
    </View>
  );
  const ro = (v: string) => <N size={16} w={600} style={{ paddingRight: 8 }}>{v}</N>;
  const seg = <V extends string | number>(opts: { value: V; label: string }[], cur: V, onChange: (v: V) => void) => (
    <View style={{ minWidth: 140, marginRight: 8 }}>
      <Segmented value={cur} onChange={onChange} options={opts} />
    </View>
  );
  const usualName = (sl: UsualSlot) => st.mealSets.find((m) => m.id === st.usualMeals[sl])?.name ?? 'なし';

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 30 }}>
        <T size={22} w={900} style={{ paddingHorizontal: 20 }}>設定</T>

        {/* 一番上：無料体験中・見るだけのカード（購入済みなら出さない） */}
        {w.entitlement !== 'paid' && (
          <View style={{ marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, gap: 10 }}>
            <T size={14} w={700}>{w.entitlement === 'trial' ? `無料体験中　あと${trialLeft}日` : '無料体験は終わりました'}</T>
            <Bar pct={w.entitlement === 'trial' ? ((TRIAL_DAYS - trialLeft) / TRIAL_DAYS) * 100 : 100} fill={color.brand} height={4} />
            <PrimaryButton label="買い切りで購入 ¥3,800" onPress={() => router.push('/paywall')} />
          </View>
        )}

        {/* 1. アカウント */}
        <View style={{ marginTop: 14 }}>
          {account ? (
            <Card style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T size={15} w={500} numberOfLines={1}>{account.email ?? 'ログイン中'}</T>
                <T size={12} c={color.sub}>{PROVIDER_JP[account.provider] ?? 'メール'}でログイン中・バックアップ {st.lastBackupAt ? backupLabel(st.lastBackupAt, now) : 'まだ'}</T>
              </View>
              <Badge high>{st.lastBackupAt ? '同期済み' : '未バックアップ'}</Badge>
            </Card>
          ) : (
            <Card style={{ padding: 14, gap: 12 }}>
              <View style={{ gap: 3 }}>
                <T size={14} w={700}>ログインしていません</T>
                <T size={12} c={color.sub} style={{ lineHeight: 19 }}>記録はこの端末にだけ保存されています。機種変更に備えてバックアップできます。</T>
              </View>
              <PrimaryButton label="ログイン" onPress={() => setSheet('login')} style={{ height: 48 }} />
            </Card>
          )}
        </View>

        {/* コーチ（モードの切り替えと、コーチとの共有。コーチ機能を使わない人には、入口の1行だけ） */}
        <CoachModeSection onLogin={() => setSheet('login')} />

        {/* 2. プロフィール（編集できる。変えると、目標がすぐ変わる） */}
        {label('プロフィール')}
        <Card>
          {profRow('性別', '', seg([{ value: 'male' as const, label: '男性' }, { value: 'female' as const, label: '女性' }], profile.sex, (v) => st.updateProfile({ sex: v }, w.weight)))}
          {profRow('生まれた年', `${age}歳`, <InlineStepper value={`${profile.birthYear}年`} width={64} size={16} onDown={() => st.updateProfile({ birthYear: Math.max(1950, profile.birthYear - 1) }, w.weight)} onUp={() => st.updateProfile({ birthYear: Math.min(now.getFullYear() - 15, profile.birthYear + 1) }, w.weight)} />)}
          {profRow('身長', '', <InlineStepper value={`${profile.heightCm} cm`} width={64} size={16} onDown={() => st.updateProfile({ heightCm: Math.max(130, profile.heightCm - 1) }, w.weight)} onUp={() => st.updateProfile({ heightCm: Math.min(220, profile.heightCm + 1) }, w.weight)} />)}
          {profRow('体重', '記録の7日平均から自動', ro(`${w.weight.toFixed(1)} kg`))}
          {profRow('活動量', activity.note, seg(ACTIVITY_LEVELS.map((a) => ({ value: a.value, label: a.label })), activity.value, (v) => st.updateProfile({ activity: v }, w.weight)))}
          {profRow('基礎代謝（目安）', '上の内容から計算', ro(`${fmt(bmrNow)} kcal`))}
          {profRow('維持カロリー（目安）', 'ここから減量分を引いて週の合計に', ro(`${fmt(profile.tdee)} kcal/日`), true)}
        </Card>

        {/* 3. 目標 */}
        {label('目標')}
        <Card>
          <CardRow title="目的" right={managed ? <CoachBadge /> : <T size={14} c={color.badgeFg}>{GOAL_JP[profile.goal]}　{goalOpen ? '˄' : '˅'}</T>} meta={managed ? GOAL_JP[profile.goal] : undefined} onPress={managed ? undefined : () => setGoalOpen(!goalOpen)} />
          {goalOpen && !managed && (
            <View style={{ padding: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <Segmented value={profile.goal} onChange={(g: Goal) => st.updateProfile({ goal: g }, w.weight)} options={(['cut', 'maintain', 'bulk'] as const).map((g) => ({ value: g, label: GOAL_JP[g] }))} />
            </View>
          )}
          <CardRow
            title="目標体重"
            right={managed ? <N size={17} w={600}>{goalWeight.toFixed(1)} kg</N> : <InlineStepper value={`${goalWeight.toFixed(1)} kg`} width={70} size={17} onDown={() => st.setGoalWeight(goalWeight - 0.5)} onUp={() => st.setGoalWeight(goalWeight + 0.5)} />}
          />
          <CardRow
            title="ペース"
            right={<N size={17} w={600}>{profile.goal === 'maintain' ? '維持' : `${profile.pace > 0 ? '+' : '−'}${Math.abs(profile.pace).toFixed(2)} kg/週`}{managed ? null : <T size={14} c={color.badgeFg}>　{paceOpen ? '˄' : '˅'}</T>}</N>}
            onPress={managed ? undefined : () => profile.goal !== 'maintain' && setPaceOpen(!paceOpen)}
          />
          {paceOpen && !managed && profile.goal !== 'maintain' && (
            <View style={{ padding: 12, flexDirection: 'row', gap: 8, flexWrap: 'wrap', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              {opts.map((o) => (
                <Chip key={o} label={`${o > 0 ? '+' : '−'}${Math.abs(o).toFixed(2)}`} selected={Math.abs(o - profile.pace) < 0.005} onPress={() => st.updateProfile({ pace: o }, w.weight)} />
              ))}
            </View>
          )}
          <CardRow
            title="週の合計"
            meta={profile.weekAdjustKcal !== 0 ? `見直しで ${profile.weekAdjustKcal > 0 ? '+' : '−'}${fmt(Math.abs(profile.weekAdjustKcal))}kcal を反映中・押すと元に戻す` : `（維持カロリー ${fmt(profile.tdee)} ${profile.pace < 0 ? '−' : '+'} ${fmt(Math.abs(profile.pace * 7700) / 7)}）× 7`}
            right={<N size={17} w={600}>{fmt(w.weekKcal)} kcal</N>}
            onPress={profile.weekAdjustKcal !== 0 ? () => st.addWeekAdjust(-profile.weekAdjustKcal, `週の合計を ${fmt(w.weekKcal - profile.weekAdjustKcal)}kcal に戻しました`) : undefined}
            minHeight={60}
            last
          />
        </Card>
        {warnings.map((x) => (
          <View key={x.code} style={{ marginHorizontal: 16, marginTop: 8 }}><Notice>{x.text}</Notice></View>
        ))}

        {/* 4. いつもの食事（「いつも通り」で入る内容） */}
        {label('いつもの食事（「いつも通り」で入る内容）')}
        <Card>
          {USUAL_SLOTS.map((sl, i) => {
            const set = st.usualMeals[sl];
            return (
              <Pressable key={sl} accessibilityRole="button" onPress={() => setUsualSlot(sl)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderBottomWidth: i === 2 ? 0 : hairline, borderBottomColor: color.line }}>
                <T size={12} w={700} c={color.sub} style={{ width: 36 }}>{sl}</T>
                <T size={14} c={set ? color.text : color.sub} numberOfLines={1} style={{ flex: 1 }}>{usualName(sl)}</T>
                <T size={16} c={color.sub}>›</T>
              </Pressable>
            );
          })}
        </Card>

        {/* 5. 日ごとの食べる量 */}
        <DaySpreadSection coef={profile.coef} kcal={dayKcal} onCoef={(c) => st.setCoefs(c)} />

        {/* 6. たんぱく質（毎日同じ量） */}
        <ProteinSection pk={profile.pk} weight={w.weight} onPk={(v) => st.setPkTo(v)} fixedG={managed ? managedPlan?.proteinG : undefined} />

        {/* 7. 週間スケジュール */}
        {label(managed ? '週間スケジュール（コーチが設定）' : '週間スケジュール')}
        <Card>
          {w.weekPlan.map((id, i) => {
            const type = templateType(w.templates, id);
            return (
              <View key={i}>
                <Pressable accessibilityRole="button" disabled={managed} onPress={() => setEditDay(editDay === i ? null : i)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: i === 6 && editDay !== i ? 0 : hairline, borderBottomColor: color.line }}>
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
        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 6 }}>メニューの追加・編集は、トレーニングタブの「メニュー」から。</T>

        {/* ここから先は、機能のための設定 */}
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

        {label(FREE_LAUNCH ? 'データ' : 'プランとデータ')}
        <Card>
          {!FREE_LAUNCH && (
          <CardRow
            title={PLAN_JP[w.entitlement]}
            meta={w.entitlement === 'trial' ? `あと${trialLeft}日。体験が終わると、新しい記録には購入が必要になります` : w.entitlement === 'view_only' ? '新しい記録はできません（過去の記録は見られます）' : 'すべての機能が使えます'}
            right={<T size={12} c={color.sub}>{w.entitlement === 'paid' ? '管理 ›' : 'プランを見る ›'}</T>}
            onPress={() => router.push('/paywall')}
            minHeight={60}
          />
          )}
          <CardRow title="書き出し・バックアップ・削除" meta="CSV、バックアップ、記録の削除、出典" right={<T size={12} c={color.sub}>›</T>} onPress={() => router.push('/data')} minHeight={60} last />
        </Card>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 14 }}>PLATE　数字はすべて目安で、医療的な助言ではありません。</T>
        {__DEV__ && (
          <View style={{ marginTop: 10 }}>
            <Pressable accessibilityRole="button" onPress={() => st.setPaid(!st.paid)} style={{ marginHorizontal: 16, height: 44, borderRadius: radius.button, borderWidth: hairline, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} c={color.sub}>{w.entitlement === 'paid' ? '（開発用）有料をオフにする' : '（開発用）有料として扱う'}</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => void st.devResetToFresh()} style={{ marginHorizontal: 16, marginTop: 8, height: 44, borderRadius: radius.button, borderWidth: hairline, borderColor: color.brandText, alignItems: 'center', justifyContent: 'center' }}>
              <T size={12} w={700} c={color.brandText}>（開発用）初めて入れた状態に戻す</T>
            </Pressable>
          </View>
        )}

        {/* ログアウト（一番下。ログイン中だけ）：高さ56、白地に枠、太字のbrandText。その下に、小さな下線付きの「アカウントを削除」 */}
        {account && (
          <View style={{ marginTop: 8, marginBottom: 24, gap: 10 }}>
            <Pressable accessibilityRole="button" onPress={() => setSheet('logout')} style={{ marginHorizontal: 16, height: 56, alignItems: 'center', justifyContent: 'center', borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.surface }}>
              <T size={15} w={700} c={color.brandText}>ログアウト</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/delete-account')} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
              <T size={12.5} c={color.sub} style={{ textDecorationLine: 'underline' }}>アカウントを削除</T>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <AccountSheetsHost sheet={sheet} onClose={() => setSheet(null)} />
      <UsualSheet slot={usualSlot} onClose={() => setUsualSlot(null)} />
    </View>
  );
}

/** 「いつもの食事」を選ぶシート：マイセットか「なし」 */
function UsualSheet({ slot, onClose }: { slot: UsualSlot | null; onClose: () => void }) {
  const mealSets = useStore((s) => s.mealSets);
  const usual = useStore((s) => s.usualMeals);
  const setUsualMeal = useStore((s) => s.setUsualMeal);
  const [foods, setFoods] = useState<Record<string, FoodItem>>({});
  useEffect(() => {
    if (!slot) return;
    getFoodsByIds([...new Set(mealSets.flatMap((m) => m.items.map((i) => i.foodId)))]).then((fs) => setFoods(Object.fromEntries(fs.map((f) => [f.id, f]))));
  }, [slot, mealSets]);
  const pfc = (m: MealSet) => {
    const t = { kcal: 0, P: 0, F: 0, C: 0 };
    for (const it of m.items) {
      const f = foods[it.foodId];
      if (!f) continue;
      const k = it.g / 100;
      t.kcal += f.kcal * k;
      t.P += f.p * k;
      t.F += f.f * k;
      t.C += f.c * k;
    }
    return `P${Math.round(t.P)} F${Math.round(t.F)} C${Math.round(t.C)}・${fmt(t.kcal)}kcal`;
  };
  const cur = slot ? usual[slot] : null;
  const pick = (id: string | null) => {
    if (slot) setUsualMeal(slot, id);
    onClose();
  };
  return (
    <Sheet visible={!!slot} onClose={onClose}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 }}>
        <T size={17} w={900}>{slot}のいつも通り</T>
      </View>
      <ScrollView style={{ maxHeight: 470 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
        {[...mealSets.map((m) => ({ id: m.id as string | null, name: m.name, meta: pfc(m) })), { id: null, name: 'なし', meta: 'この時間帯は入れない' }].map((o) => (
          <Pressable key={o.id ?? 'none'} accessibilityRole="button" onPress={() => pick(o.id)} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: hairline, borderBottomColor: color.line }}>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <T size={15} numberOfLines={1}>{o.name}</T>
              <N size={12} w={500} c={color.sub}>{o.meta}</N>
            </View>
            <T size={16} w={700} style={{ width: 28, textAlign: 'center' }}>{cur === o.id ? '✓' : ''}</T>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}
