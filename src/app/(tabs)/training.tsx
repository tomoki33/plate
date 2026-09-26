import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Chip, N, Notice, NumberStepper, OutlineButton, PrimaryButton, T, color, hairline, radius } from '@/design-system';
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

  if (session) return <Recording insetsTop={insets.top} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
        <T size={22} w={900}>トレ</T>

        <View style={{ marginTop: 16, padding: 16, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line }}>
          <T size={11} c={color.sub}>今日の予定</T>
          {w.todayWorkout ? (
            <View style={{ marginTop: 8, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T size={20} w={900}>{w.todayWorkout.name}</T>
                <Badge>完了</Badge>
              </View>
              <OutlineButton label="結果を見る" onPress={() => setDoneOpen(true)} />
            </View>
          ) : scheduled && w.today.type !== 'off' ? (
            <View style={{ marginTop: 8, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T size={20} w={900}>{scheduled.name}</T>
                <Badge high={scheduled.defaultDayType === 'high'}>{DAY_TYPE_JP[scheduled.defaultDayType]}</Badge>
              </View>
              <T size={12} c={color.sub}>{scheduled.exercises.length}種目・{scheduled.exercises.reduce((a, e) => a + e.sets, 0)}セット</T>
              <PrimaryButton label="開始" onPress={() => startSession(scheduled.id)} />
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <T size={20} w={900}>今日はオフ</T>
              <T size={12} c={color.sub} style={{ marginTop: 4 }}>やる日に変えるときは、下から選べます。</T>
            </View>
          )}
        </View>

        {!w.todayWorkout && (
          <>
            <T size={11} c={color.sub} style={{ marginTop: 22 }}>予定を変える</T>
            {others.map((t) => (
              <View key={t.id} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <T size={14} w={700}>{t.name}</T>
                  <T size={12} c={color.sub}>{t.exercises.length}種目　日タイプ：{DAY_TYPE_JP[t.defaultDayType]}</T>
                </View>
                <Pressable accessibilityRole="button" onPress={() => startSession(t.id)} style={{ minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={13} w={700}>開始</T>
                </Pressable>
              </View>
            ))}
            <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <T size={14} w={700}>フリートレ</T>
                <T size={12} c={color.sub}>テンプレートなし。種目をその場で選ぶ</T>
              </View>
              <Pressable accessibilityRole="button" onPress={() => startSession(null)} style={{ minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} w={700}>開始</T>
              </Pressable>
            </View>
            {w.today.type !== 'off' && (
              <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <T size={14} w={700}>今日は休む</T>
                  <T size={12} c={color.sub}>{w.features.linkedTargets ? 'オフにして、残りの日に配り直す' : 'オフにする（無料プランでは目標は変わりません）'}</T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const prev = useStore.getState().dayTypes[w.todayKey] ?? null;
                    setDayType(w.todayKey, 'off');
                    showToast(w.features.linkedTargets ? '今日をオフに変更。目標を配り直しました' : '今日をオフにしました', () => useStore.getState().setDayType(w.todayKey, prev));
                    router.navigate('/');
                  }}
                  style={{ minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' }}
                >
                  <T size={13} w={700}>オフにする</T>
                </Pressable>
              </View>
            )}
          </>
        )}

        <T size={11} c={color.sub} style={{ marginTop: 22 }}>履歴</T>
        {history.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 14 }}>まだトレの記録がありません。</T>}
        {history.map((h) => {
          const d = new Date(h.endedAt);
          const isOpen = open === h.id;
          return (
            <View key={h.id} style={{ borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <Pressable accessibilityRole="button" onPress={() => { setOpen(isOpen ? null : h.id); setConfirm(null); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
                <T size={12} c={color.sub} style={{ width: 64 }}>{d.getMonth() + 1}/{d.getDate()} {DAY_LABELS[(d.getDay() + 6) % 7]}</T>
                <T size={14} w={700} style={{ flex: 1 }}>{h.name}</T>
                <T size={12} c={color.sub}>{h.doneSets}セット</T>
              </Pressable>
              {isOpen && (
                <View style={{ paddingBottom: 10, gap: 4 }}>
                  {h.exercises.map((e) => (
                    <View key={e.exerciseId} style={{ flexDirection: 'row', gap: 8 }}>
                      <T size={12} style={{ flex: 1 }}>{e.name}</T>
                      <N size={12} w={500} c={color.sub}>{e.sets.map((s) => `${s.kg}×${s.reps}`).join('・')}</N>
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
      <ScrollView contentContainerStyle={{ paddingTop: insetsTop + 12, paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <T size={22} w={900}>{ses.name}</T>
            <T size={12} c={color.sub}>{doneN}/{total} セット</T>
          </View>
          <Pressable accessibilityRole="button" onPress={() => (confirmCancel ? s.cancelSession() : setConfirmCancel(true))} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
            <T size={13} w={confirmCancel ? 700 : 400} c={confirmCancel ? color.brandText : color.sub}>{confirmCancel ? 'もう一度押すと中止' : '中止'}</T>
          </Pressable>
        </View>

        {/* 種目の切替 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 6, marginTop: 12 }}>
          {ses.ex.map((e, i) => {
            const all = e.sets.every((x) => x.done);
            const on = i === ses.cur;
            return (
              <Pressable key={`${e.exerciseId}-${i}`} accessibilityRole="button" onPress={() => s.selectExercise(i)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.button, borderWidth: 1, borderColor: on ? color.text : color.line, backgroundColor: on ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} w={on ? 700 : 400} c={on ? color.onText : all ? color.sub : color.text}>{(all ? '✓ ' : '') + e.name}</T>
              </Pressable>
            );
          })}
          <Chip label="＋ 種目" onPress={() => setPicker(true)} />
        </ScrollView>

        {ex ? (
          <>
            <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
              <T size={20} w={900}>{ex.name}</T>
              <T size={12} c={color.sub} style={{ marginTop: 2 }}>前回 {ex.prevKg}kg × {ex.prevReps}</T>
            </View>

            {/* セット表 */}
            <View style={{ marginTop: 10, marginHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', paddingHorizontal: 6, paddingBottom: 4 }}>
                <T size={11} c={color.sub} style={{ width: 44 }}>セット</T>
                <T size={11} c={color.sub} style={{ flex: 1, textAlign: 'center' }}>kg</T>
                <T size={11} c={color.sub} style={{ flex: 1, textAlign: 'center' }}>回</T>
                <View style={{ width: 44 }} />
              </View>
              {ex.sets.map((st, i) => {
                const touched = st.done || st.kg !== ex.prevKg || st.reps !== ex.prevReps;
                const vc = touched ? color.text : color.faint;
                return (
                  <Pressable key={i} accessibilityRole="button" onPress={() => s.selectSet(i)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: i === ses.sel ? color.bg : color.surface, borderTopWidth: i === ses.sel ? 1 : hairline, borderTopColor: i === ses.sel ? color.lineStrong : color.line, borderWidth: i === ses.sel ? 1 : 0, borderColor: color.lineStrong, borderRadius: i === ses.sel ? radius.input : 0 }}>
                    <N size={16} w={500} c={color.sub} style={{ width: 44 }}>{i + 1}</N>
                    <N size={24} w={600} c={vc} style={{ flex: 1, textAlign: 'center' }}>{st.kg}</N>
                    <N size={24} w={600} c={vc} style={{ flex: 1, textAlign: 'center' }}>{st.reps}</N>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: st.done }} onPress={() => s.toggleSet(i)} style={{ width: 44, height: 44, borderRadius: radius.input, borderWidth: 1, borderColor: st.done ? color.text : color.lineStrong, backgroundColor: st.done ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                      <T size={18} w={700} c={st.done ? color.onText : color.lineStrong}>✓</T>
                    </Pressable>
                  </Pressable>
                );
              })}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Pressable accessibilityRole="button" onPress={s.addSet} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}><T size={13} w={700}>＋ セット追加</T></Pressable>
                {ex.sets.length > 1 && <Pressable accessibilityRole="button" onPress={s.removeSet} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}><T size={13} c={color.sub}>選んだセットを削除</T></Pressable>}
              </View>
            </View>

            {/* RIR（あと何回できたか） */}
            {sel && (
              <View style={{ marginHorizontal: 16, marginTop: 6 }}>
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
              <View style={{ marginTop: 14, marginHorizontal: 16, padding: 12, borderRadius: radius.card, backgroundColor: color.brandPale, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <T size={11} w={700} c={color.brandText}>休憩</T>
                  <N size={28} w={600} c={color.brandText}>{mmss(s.rest)}</N>
                </View>
                <Pressable accessibilityRole="button" onPress={s.addRest} style={{ height: 44, paddingHorizontal: 14, borderRadius: radius.button, borderWidth: 1, borderColor: color.brandText, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={13} w={700} c={color.brandText}>＋30秒</T>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={s.skipRest} style={{ height: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={13} w={700} c={color.brandText}>終了</T>
                </Pressable>
              </View>
            )}

            {/* 大きな±ボタン（kg±2.5、回±1） */}
            {sel && (
              <View style={{ marginTop: 16, marginHorizontal: 16, flexDirection: 'row', gap: 12 }}>
                <SetStepper label="kg" value={sel.kg} step={2.5} decimals={1} max={1000} onChange={(v) => s.setSetValue('kg', v)} />
                <SetStepper label="回" value={sel.reps} step={1} decimals={0} min={1} max={200} onChange={(v) => s.setSetValue('reps', v)} />
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
        <PrimaryButton label="トレを完了" onPress={() => s.finishSession()} style={{ flex: 1 }} />
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={(e) => s.addExerciseToSession(e.id)} />
    </View>
  );
}

/** 大きな±ボタン（kg±2.5、回±1）。数字をタップすると、直接入力できる */
function SetStepper({ label, value, step, decimals, min = 0, max, onChange }: { label: string; value: number; step: number; decimals: number; min?: number; max: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: radius.card, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line }}>
      <T size={11} c={color.sub}>{label}</T>
      <View style={{ marginTop: 4 }}>
        <NumberStepper value={value} onChange={onChange} step={step} min={min} max={max} decimals={decimals} size={28} width={56} buttonSize={56} accessibilityLabel={label} />
      </View>
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
            <Notice tone="plain">無料プランでは、トレの内容で目標は変わりません。日タイプ連動は有料プランで使えます。</Notice>
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
          <PrimaryButton label="トレ後の食事を記録" onPress={onMeal} style={{ flex: 1.4 }} />
        </View>
      </View>
    </Modal>
  );
}
