import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, N, OutlineButton, PrimaryButton, StepButton, T } from '../../components/ui';
import { useNow } from '../../components/useNow';
import { DEFAULT_MEDIAN_VOLUME, median, TEMPLATES } from '../../domain/training';
import { DAY_LABELS, DAY_TYPE_JP } from '../../domain/types';
import { useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';
import { color, hairline, radius } from '../../theme';

const fmt = (n: number) => Math.round(n).toLocaleString();
const sign = (n: number) => (n >= 0 ? '+' : '−');
const mmss = (r: number) => `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;

export default function TrainingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const session = useStore((s) => s.session);
  const workouts = useStore((s) => s.workouts);
  const doneOpen = useStore((s) => s.doneOpen);
  const st = useStore();

  const todayTemplateId = w.settings.plan[w.ti];
  const scheduled = todayTemplateId ? TEMPLATES[todayTemplateId] : null;
  const others = Object.values(TEMPLATES).filter((t) => t.id !== todayTemplateId);
  const history = workouts.slice(-5).reverse();

  if (session) return <Recording insetsTop={insets.top} />;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: 22 }}>
        <T size={22} w={900}>トレ</T>

        <View style={{ marginTop: 16, padding: 16, borderRadius: radius.card, backgroundColor: '#fff', borderWidth: hairline, borderColor: color.line }}>
          <T size={11} c={color.sub}>今日の予定</T>
          {w.todayWorkout ? (
            <View style={{ marginTop: 8, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T size={20} w={900}>{w.todayWorkout.name}</T>
                <Badge>完了</Badge>
              </View>
              <OutlineButton label="結果を見る" onPress={() => st.setDoneOpen(true)} />
            </View>
          ) : scheduled && w.today.type !== 'off' ? (
            <View style={{ marginTop: 8, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T size={20} w={900}>{scheduled.name}</T>
                <Badge high={scheduled.type === 'high'}>{DAY_TYPE_JP[scheduled.type]}</Badge>
              </View>
              <T size={12} c={color.sub}>{scheduled.meta}</T>
              <PrimaryButton label="開始" onPress={() => st.startSession(scheduled.id)} />
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
                  <T size={12} c={color.sub}>{t.meta}　日タイプ：{DAY_TYPE_JP[t.type]}</T>
                </View>
                <Pressable accessibilityRole="button" onPress={() => st.startSession(t.id)} style={{ minWidth: 64, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={13} w={700}>開始</T>
                </Pressable>
              </View>
            ))}
            {w.today.type !== 'off' && (
              <View style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, paddingVertical: 8 }}>
                <View style={{ flex: 1 }}>
                  <T size={14} w={700}>今日は休む</T>
                  <T size={12} c={color.sub}>オフにして、残りの日に配り直す</T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    const prev = useStore.getState().todayTypes[w.todayKey] ?? null;
                    st.setTodayType(w.todayKey, 'off');
                    st.showToast('今日をオフに変更。目標を配り直しました', () => useStore.getState().setTodayType(w.todayKey, prev));
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
          const d = new Date(h.finishedAt);
          return (
            <View key={h.id} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line }}>
              <T size={12} c={color.sub} style={{ width: 64 }}>{d.getMonth() + 1}/{d.getDate()} {DAY_LABELS[(d.getDay() + 6) % 7]}</T>
              <T size={14} w={700} style={{ flex: 1 }}>{h.name}</T>
              <T size={12} c={color.sub}>{h.doneSets}セット</T>
            </View>
          );
        })}
      </ScrollView>

      <DoneModal
        open={doneOpen && !!w.todayWorkout}
        onClose={() => {
          st.setDoneOpen(false);
          router.navigate('/');
        }}
        onMeal={() => {
          st.setDoneOpen(false);
          router.navigate({ pathname: '/', params: { meal: '1' } });
        }}
        w={w}
        median={median(workouts.filter((x) => x.id !== w.todayWorkout?.id).map((x) => x.volume))}
      />
    </View>
  );
}

function Recording({ insetsTop }: { insetsTop: number }) {
  const s = useStore();
  const ses = s.session!;
  const tpl = TEMPLATES[ses.templateId];
  const ex = ses.ex[ses.cur];
  const doneN = ses.ex.reduce((a, e) => a + e.sets.filter((x) => x.done).length, 0);
  const total = ses.ex.length * 3;
  const sel = ex.sets[ses.sel];
  const hasNext = ses.cur < ses.ex.length - 1;
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insetsTop + 12, paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <T size={22} w={900}>{tpl.name}</T>
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
              <Pressable key={e.name} accessibilityRole="button" onPress={() => s.selectExercise(i)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: radius.button, borderWidth: 1, borderColor: on ? color.text : color.line, backgroundColor: on ? color.text : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} w={on ? 700 : 400} c={on ? '#fff' : all ? color.sub : color.text}>{(all ? '✓ ' : '') + e.name}</T>
              </Pressable>
            );
          })}
        </ScrollView>

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
              <Pressable key={i} accessibilityRole="button" onPress={() => s.selectSet(i)} style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: i === ses.sel ? color.bg : '#fff', borderTopWidth: hairline, borderTopColor: color.line, borderRadius: i === ses.sel ? radius.input : 0, borderWidth: i === ses.sel ? 1 : 0, borderColor: color.lineStrong }}>
                <N size={16} w={500} c={color.sub} style={{ width: 44 }}>{i + 1}</N>
                <N size={24} w={600} c={vc} style={{ flex: 1, textAlign: 'center' }}>{st.kg}</N>
                <N size={24} w={600} c={vc} style={{ flex: 1, textAlign: 'center' }}>{st.reps}</N>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: st.done }} onPress={() => s.toggleSet(i)} style={{ width: 44, height: 44, borderRadius: radius.input, borderWidth: 1, borderColor: st.done ? color.text : color.lineStrong, backgroundColor: st.done ? color.text : '#fff', alignItems: 'center', justifyContent: 'center' }}>
                  <T size={18} w={700} c={st.done ? '#fff' : color.lineStrong}>✓</T>
                </Pressable>
              </Pressable>
            );
          })}
        </View>

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
        <View style={{ marginTop: 18, marginHorizontal: 16, flexDirection: 'row', gap: 12 }}>
          <Stepper label="kg" value={String(sel.kg)} onDown={() => s.adjustSet('kg', -2.5)} onUp={() => s.adjustSet('kg', 2.5)} />
          <Stepper label="回" value={String(sel.reps)} onDown={() => s.adjustSet('reps', -1)} onUp={() => s.adjustSet('reps', 1)} />
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', gap: 8 }}>
        {hasNext && <OutlineButton label="次の種目" onPress={s.nextExercise} style={{ flex: 1 }} />}
        <PrimaryButton label="トレを完了" onPress={() => s.finishSession()} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

function Stepper({ label, value, onDown, onUp }: { label: string; value: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: radius.card, backgroundColor: '#fff', borderWidth: hairline, borderColor: color.line }}>
      <T size={11} c={color.sub}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
        <StepButton label="−" size={56} onPress={onDown} />
        <N size={28} w={600} style={{ minWidth: 48, textAlign: 'center' }}>{value}</N>
        <StepButton label="+" size={56} onPress={onUp} />
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
  const t = new Date(rec.finishedAt);
  const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
  const base = med || DEFAULT_MEDIAN_VOLUME;
  const ratio = (rec.volume / base).toFixed(1);
  const stats: [string, string][] = [
    ['ボリュームスコア', `${rec.volume.toFixed(1)}（普段 ${base.toFixed(1)}）`],
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
            <N size={64} w={600} style={{ lineHeight: 68 }}>{Math.max(0, rem.P)}<T size={20}>g</T></N>
          </View>
          <View>
            <T size={12} w={700} c={color.C}>C あと</T>
            <N size={64} w={600} style={{ lineHeight: 68 }}>{Math.max(0, rem.C)}<T size={20}>g</T></N>
          </View>
        </View>
        <T size={12.5} c={color.badgeFg} style={{ paddingHorizontal: 22, marginTop: 12, lineHeight: 21 }}>
          F あと{Math.max(0, rem.F)}g・残り{fmt(Math.max(0, rem.kcal))}kcal（目安）。ボリュームは普段の{ratio}倍。
          {w.changed ? '' : `今日は予定どおり「${DAY_TYPE_JP[w.today.type]}」のまま。`}
        </T>
        {w.changed && (
          <View style={{ marginHorizontal: 22, marginTop: 14, padding: 12, borderRadius: radius.button, backgroundColor: color.brandPale }}>
            <T size={12.5} style={{ lineHeight: 20 }}>
              <T size={12.5} w={700} c={color.brandText}>目標を変更</T>　今日を「{DAY_TYPE_JP[w.today.type]}」に変更。今日 C{sign(dC)}{Math.abs(dC)}g、残りの日に {sign(restDiff)}{fmt(Math.abs(restDiff))}kcal を配り直しました。
            </T>
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
