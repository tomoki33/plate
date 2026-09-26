import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bar, Badge, Chip, N, Notice, OutlineButton, PrimaryButton, StepBox, T, color, hairline, radius } from '@/design-system';
import { ExercisePicker } from '../../components/ExercisePicker';
import { useNow } from '../../components/useNow';
import { DEFAULT_MEDIAN_VOLUME, median } from '../../domain/training';
import { DAY_LABELS, DAY_TYPE_JP } from '../../domain/types';
import { useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const sign = (n: number) => (n >= 0 ? '+' : '−');
const mmss = (r: number) => `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;

export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const session = useStore((s) => s.session);
  const sessions = useStore((s) => s.sessions);
  const doneOpen = useStore((s) => s.doneOpen);
  const templates = useStore((s) => s.templates);
  const exercises = useStore((s) => s.exercises);
  const startSession = useStore((s) => s.startSession);
  const setDayType = useStore((s) => s.setDayType);
  const showToast = useStore((s) => s.showToast);
  const setDoneOpen = useStore((s) => s.setDoneOpen);
  const deleteSession = useStore((s) => s.deleteSession);
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const scheduled = templates.find((t) => t.id === w.todayTemplateId) ?? null;
  const others = templates.filter((t) => t.id !== w.todayTemplateId);
  const history = sessions.slice(-8).reverse();
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? '';

  if (session) return <Recording insetsTop={insets.top} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 40 }}>
        <T size={22} w={900} style={{ paddingHorizontal: 20 }}>トレーニング</T>

        {w.todayWorkout ? (
          <View style={{ marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: radius.card, backgroundColor: color.brandPale, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <T size={13} numberOfLines={1} style={{ flex: 1 }}><T size={13} w={700} c={color.brandText}>今日は完了</T>　{w.todayWorkout.name}</T>
            <Pressable accessibilityRole="button" onPress={() => setDoneOpen(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={13} w={700}>結果を見る ›</T>
            </Pressable>
          </View>
        ) : scheduled && w.today.type !== 'off' ? (
          <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, overflow: 'hidden' }}>
            <View style={{ padding: 16, paddingBottom: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={12} c={color.sub}>今日の予定</T>
                <Badge high={scheduled.defaultDayType === 'high'}>{DAY_TYPE_JP[scheduled.defaultDayType]}</Badge>
              </View>
              <T size={22} w={900}>{scheduled.name}</T>
              <T size={12} c={color.sub}>{scheduled.exercises.length}種目・{scheduled.exercises.reduce((a, e) => a + e.sets, 0)}セット</T>
            </View>
            {/* 種目は1行ずつ（メニューの中身が、ひと目で分かる） */}
            <View style={{ paddingHorizontal: 16 }}>
              {scheduled.exercises.map((e, i) => (
                <View key={`${e.exerciseId}-${i}`} style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: hairline, borderTopColor: color.line }}>
                  <N size={12} w={600} c={color.faint} style={{ width: 16 }}>{i + 1}</N>
                  <T size={14} numberOfLines={1} style={{ flex: 1 }}>{exName(e.exerciseId)}</T>
                  <N size={12} w={500} c={color.sub}>{e.sets}セット × {e.reps}回</N>
                </View>
              ))}
            </View>
            <View style={{ padding: 16, paddingTop: 14 }}>
              <PrimaryButton label="開始" onPress={() => startSession(scheduled.id)} />
            </View>
          </View>
        ) : (
          <View style={{ marginHorizontal: 16, marginTop: 14, padding: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, gap: 4 }}>
            <T size={12} c={color.sub}>今日の予定</T>
            <T size={22} w={900}>今日はオフ</T>
            <T size={12} c={color.sub}>やる日に変えるときは、下から選べます。</T>
          </View>
        )}

        {!w.todayWorkout && (
          <>
            <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 6 }}>予定を変える</T>
            <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, overflow: 'hidden' }}>
              {others.map((t) => (
                <PlanRow key={t.id} title={t.name} meta={`${t.exercises.length}種目・${t.exercises.reduce((a, e) => a + e.sets, 0)}セット・日タイプ ${DAY_TYPE_JP[t.defaultDayType]}`} action="開始" onPress={() => startSession(t.id)} />
              ))}
              <PlanRow title="フリートレーニング" meta="種目をその場で選ぶ" action="開始" onPress={() => startSession(null)} last={w.today.type === 'off'} />
              {w.today.type !== 'off' && (
                <PlanRow
                  title="今日は休む"
                  meta={w.features.linkedTargets ? '残りの日に配り直す' : '目標は変わりません（無料プラン）'}
                  action="オフにする"
                  last
                  onPress={() => {
                    const prev = useStore.getState().dayTypes[w.todayKey] ?? null;
                    setDayType(w.todayKey, 'off');
                    showToast(w.features.linkedTargets ? '今日をオフに変更。目標を配り直しました' : '今日をオフにしました', () => useStore.getState().setDayType(w.todayKey, prev));
                    router.navigate('/');
                  }}
                />
              )}
            </View>
          </>
        )}

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4 }}>履歴</T>
        <View style={{ paddingHorizontal: 20 }}>
          {history.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>まだトレーニングの記録がありません。</T>}
          {history.map((h) => {
            const d = new Date(h.endedAt);
            const isOpen = open === h.id;
            const mins = Math.max(1, Math.round((h.endedAt - h.startedAt) / 60000));
            return (
              <View key={h.id} style={{ borderBottomWidth: hairline, borderBottomColor: color.line }}>
                <Pressable accessibilityRole="button" onPress={() => { setOpen(isOpen ? null : h.id); setConfirm(null); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', flex: 1, minWidth: 0 }}>
                    <T size={13} c={color.sub} style={{ width: 56 }}>{d.getMonth() + 1}/{d.getDate()} {DAY_LABELS[(d.getDay() + 6) % 7]}</T>
                    <T size={13} numberOfLines={1} style={{ flex: 1 }}>{h.name}</T>
                  </View>
                  <T size={12} c={color.sub} numberOfLines={1} style={{ marginLeft: 8 }}>{h.doneSets}セット・{mins}分</T>
                </Pressable>
                {isOpen && (
                  <View style={{ paddingBottom: 10, gap: 4 }}>
                    {h.exercises.map((e) => (
                      <View key={e.exerciseId} style={{ flexDirection: 'row', gap: 8 }}>
                        <T size={12} style={{ flex: 1 }}>{e.name}</T>
                        <N size={12} w={500} c={color.sub}>{e.sets.map((x) => `${x.kg}×${x.reps}`).join('・')}</N>
                      </View>
                    ))}
                    <Pressable accessibilityRole="button" onPress={() => (confirm === h.id ? (deleteSession(h.id), setOpen(null)) : setConfirm(h.id))} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <T size={12} w={700} c={color.brandText}>{confirm === h.id ? 'もう一度押すと、この記録を削除' : 'この記録を削除'}</T>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <DoneModal
        open={doneOpen && !!w.todayWorkout}
        onClose={() => {
          setDoneOpen(false);
          router.navigate('/');
        }}
        onMeal={() => {
          setDoneOpen(false);
          router.navigate({ pathname: '/', params: { meal: '1' } });
        }}
        w={w}
        median={sessions.length > 3 ? median(sessions.filter((x) => x.id !== w.todayWorkout?.id).map((x) => x.volume)) : DEFAULT_MEDIAN_VOLUME}
      />
    </View>
  );
}

function Recording({ insetsTop }: { insetsTop: number }) {
  const s = useStore();
  const ses = s.session!;
  const ex = ses.ex[ses.cur];
  const [picker, setPicker] = useState(ses.ex.length === 0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const doneN = ses.ex.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const total = ses.ex.reduce((a, e) => a + e.sets.length, 0);
  const sel = ex?.sets[ses.sel];
  const hasNext = ses.cur < ses.ex.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insetsTop + 8, paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <T size={12} c={color.sub}>{ses.name}・{doneN}/{total} セット</T>
            <T size={20} w={900} numberOfLines={1}>{ex?.name ?? '種目を選ぶ'}</T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => (confirmCancel ? s.cancelSession() : setConfirmCancel(true))} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
            <T size={12} w={confirmCancel ? 700 : 400} c={confirmCancel ? color.brandText : color.sub}>{confirmCancel ? 'もう一度押すと中止' : '中止'}</T>
          </Pressable>
        </View>

        {/* 種目の切替（選択中は黒） */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, marginTop: 10 }}>
          {ses.ex.map((e, i) => {
            const all = e.sets.every((x) => x.done);
            const on = i === ses.cur;
            return (
              <Pressable key={`${e.exerciseId}-${i}`} accessibilityRole="button" onPress={() => s.selectExercise(i)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: radius.input, borderWidth: hairline, borderColor: on ? color.text : color.line, backgroundColor: on ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                <T size={12} c={on ? color.onText : all ? color.sub : color.text}>{(all ? '✓ ' : '') + e.name}</T>
              </Pressable>
            );
          })}
          <Chip label="＋ 種目" onPress={() => setPicker(true)} />
        </ScrollView>

        {ex ? (
          <>
            <T size={12} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 10 }}>前回 {ex.prevKg}kg × {ex.prevReps}・{ex.prevReps}・{ex.prevReps}</T>

            {/* セット表 */}
            <View style={{ marginHorizontal: 16, marginTop: 10, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 }}>
                <T size={10.5} c={color.sub} style={{ width: 40 }}>セット</T>
                <T size={10.5} c={color.sub} style={{ flex: 1 }}>kg</T>
                <T size={10.5} c={color.sub} style={{ flex: 1 }}>回</T>
                <View style={{ width: 52 }} />
              </View>
              {ex.sets.map((st, i) => {
                const touched = st.done || st.kg !== ex.prevKg || st.reps !== ex.prevReps;
                const vc = touched ? color.text : color.faint;
                return (
                  <Pressable key={i} accessibilityRole="button" onPress={() => s.selectSet(i)} style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: i === ses.sel ? color.bg : color.surface, borderTopWidth: hairline, borderTopColor: color.line }}>
                    <N size={15} w={600} c={color.sub} style={{ width: 40 }}>{i + 1}</N>
                    <N size={22} w={600} c={vc} style={{ flex: 1 }}>{st.kg}</N>
                    <N size={22} w={600} c={vc} style={{ flex: 1 }}>{st.reps}</N>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: st.done }} onPress={() => s.toggleSet(i)} style={{ width: 44, height: 44, marginLeft: 8, borderRadius: radius.button, borderWidth: 1, borderColor: st.done ? color.text : color.lineStrong, backgroundColor: st.done ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={16} w={700} c={st.done ? color.onText : color.lineStrong}>✓</T>
                    </Pressable>
                  </Pressable>
                );
              })}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: hairline, borderTopColor: color.line }}>
                <Pressable accessibilityRole="button" onPress={s.addSet} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}><T size={12} w={700}>＋ セット追加</T></Pressable>
                {ex.sets.length > 1 && <Pressable accessibilityRole="button" onPress={s.removeSet} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }}><T size={12} c={color.sub}>選んだセットを削除</T></Pressable>}
              </View>
            </View>

            {/* 大きな±ボタン（kg±2.5、回±1） */}
            {sel && (
              <View style={{ marginTop: 10, marginHorizontal: 16, flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <StepBox value={String(sel.kg)} caption="kg ±2.5" onDown={() => s.adjustSet('kg', -2.5)} onUp={() => s.adjustSet('kg', 2.5)} height={48} buttonWidth={44} size={18} label="kg" />
                </View>
                <View style={{ flex: 1 }}>
                  <StepBox value={String(sel.reps)} caption="回" onDown={() => s.adjustSet('reps', -1)} onUp={() => s.adjustSet('reps', 1)} height={48} buttonWidth={44} size={18} label="回" />
                </View>
              </View>
            )}
            <T size={11.5} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 8 }}>行を押して選び、下のボタンで調整。薄い数字は前回の値。</T>

            {/* RIR（あと何回できたか・任意） */}
            {sel && (
              <View style={{ marginHorizontal: 16, marginTop: 8 }}>
                <T size={11} c={color.sub}>RIR（あと何回できたか・任意）</T>
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                  {[0, 1, 2, 3, 4].map((r) => (
                    <Chip key={r} label={r === 4 ? '4+' : String(r)} selected={sel.rir === r} onPress={() => s.setRir(sel.rir === r ? null : r)} />
                  ))}
                </View>
              </View>
            )}

            {/* 休憩タイマー */}
            {s.rest > 0 && (
              <View style={{ marginTop: 12, marginHorizontal: 16, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.surface, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <T size={12} c={color.sub}>休憩</T>
                    <N size={28} w={600} style={{ lineHeight: 28 }}>{mmss(s.rest)}</N>
                  </View>
                  <Bar pct={Math.round((s.rest / s.restMax) * 100)} fill={color.text} height={4} />
                </View>
                <Pressable accessibilityRole="button" onPress={s.addRest} style={{ height: 44, paddingHorizontal: 10, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12}>＋30秒</T>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={s.skipRest} style={{ height: 44, paddingHorizontal: 10, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12}>終了</T>
                </Pressable>
              </View>
            )}
          </>
        ) : (
          <View style={{ padding: 22 }}>
            <T size={13} c={color.sub}>種目を選んで始めましょう。</T>
            <PrimaryButton label="種目を選ぶ" style={{ marginTop: 12 }} onPress={() => setPicker(true)} />
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', gap: 8 }}>
        {hasNext && <OutlineButton label="次の種目" onPress={s.nextExercise} style={{ flex: 1 }} />}
        <PrimaryButton label="トレーニングを完了" onPress={() => s.finishSession()} style={{ flex: 1 }} />
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => s.addExerciseToSession(e.id)} />
    </View>
  );
}

function DoneModal({ open, onClose, onMeal, w, median: med }: { open: boolean; onClose: () => void; onMeal: () => void; w: ReturnType<typeof useWeek>; median: number }) {
  const rec = w.todayWorkout;
  if (!rec) return null;
  const rem = w.remaining;
  const dC = w.today.C - w.plan.days[w.ti].C;
  const restDiff = w.eng.days.slice(w.ti + 1).reduce((a, d, i) => a + d.kcal - w.plan.days[w.ti + 1 + i].kcal, 0);
  const t = new Date(rec.endedAt);
  const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  const ratio = (rec.volume / med).toFixed(1);
  const stats: [string, string][] = [
    ['ボリュームスコア', `${rec.volume.toFixed(1)}（普段 ${med.toFixed(1)}）`],
    [rec.best ? `${rec.best.name} 推定1RM` : '推定1RM', rec.best ? `${rec.best.e1rm.toFixed(1)} kg` : '—'],
    ['今日の目標', `${fmt(w.today.kcal)} kcal`],
  ];
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 54 }}>
        <View style={{ paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Badge high>完了 {time}</Badge>
          <T size={12} c={color.sub}>{rec.name}・{rec.doneSets}セット</T>
        </View>
        <T size={13} c={color.sub} style={{ paddingHorizontal: 22, marginTop: 24 }}>この後の食事で</T>
        <View style={{ paddingHorizontal: 22, marginTop: 4, flexDirection: 'row', gap: 22, alignItems: 'flex-end' }}>
          <View>
            <T size={12} w={700} c={color.P}>P あと</T>
            <N size={64} w={600} style={{ lineHeight: 68 }}>{Math.max(0, Math.round(rem.P))}<T size={20}>g</T></N>
          </View>
          <View>
            <T size={12} w={700} c={color.C}>C あと</T>
            <N size={64} w={600} style={{ lineHeight: 68 }}>{Math.max(0, Math.round(rem.C))}<T size={20}>g</T></N>
          </View>
        </View>
        <T size={12.5} c={color.badgeFg} style={{ paddingHorizontal: 22, marginTop: 12, lineHeight: 21 }}>
          F あと{Math.max(0, Math.round(rem.F))}g・残り{fmt(Math.max(0, rem.kcal))}kcal（目安）。ボリュームは普段の{ratio}倍。
          {w.changed || !w.features.linkedTargets ? '' : `今日は予定どおり「${DAY_TYPE_JP[w.today.type]}」のまま。`}
        </T>
        {w.changed && (
          <View style={{ marginHorizontal: 22, marginTop: 14 }}>
            <Notice>
              <T size={12.5} w={700} c={color.brandText}>目標を変更</T>　今日を「{DAY_TYPE_JP[w.today.type]}」に変更。今日 C{sign(dC)}{Math.abs(dC)}g、残りの日に {sign(restDiff)}{fmt(Math.abs(restDiff))}kcal を配り直しました。
            </Notice>
          </View>
        )}
        {!w.features.linkedTargets && (
          <View style={{ marginHorizontal: 22, marginTop: 14 }}>
            <Notice tone="plain">無料プランでは、トレーニングの内容で目標は変わりません。日タイプ連動は有料プランで使えます。</Notice>
          </View>
        )}
        <View style={{ marginHorizontal: 22, marginTop: 18, borderTopWidth: hairline, borderTopColor: color.line }}>
          {stats.map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={13} c={color.sub}>{k}</T>
              <N size={18} w={600}>{v}</N>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 34, flexDirection: 'row', gap: 8 }}>
          <OutlineButton label="閉じる" onPress={onClose} style={{ flex: 1 }} />
          <PrimaryButton label="トレーニング後の食事を記録" onPress={onMeal} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Modal>
  );
}

/** 「予定を変える」の1行。名前とメタ情報は1行に収め、ボタンとは間をあける */
function PlanRow({ title, meta, action, onPress, last }: { title: string; meta: string; action: string; onPress: () => void; last?: boolean }) {
  return (
    <View style={{ minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16, paddingRight: 12, borderBottomWidth: last ? 0 : hairline, borderBottomColor: color.line }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T size={14} w={500} numberOfLines={1}>{title}</T>
        <T size={11} c={color.sub} numberOfLines={1}>{meta}</T>
      </View>
      <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, minWidth: 68, paddingHorizontal: 14, borderWidth: hairline, borderColor: color.text, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center' }}>
        <T size={12} w={700}>{action}</T>
      </Pressable>
    </View>
  );
}
