import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useTopInset } from '../../components/coach/Frames';
import { Badge, N, Notice, T, color, font, hairline, radius } from '@/design-system';
import { getFoodsByIds } from '../../db/repo';
import { ExercisePicker } from '../../components/ExercisePicker';
import { NotificationPrompt } from '../../components/NotificationPrompt';
import { useNow } from '../../components/useNow';
import { sendWorkoutDoneNotification } from '../../services/notifications';
import { shortExName } from '../../domain/exerciseNames';
import type { SessionRecord, WorkoutTemplate } from '../../domain/models';
import { DEFAULT_MEDIAN_VOLUME, estimate1RM, median } from '../../domain/training';
import { DAY_TYPE_JP } from '../../domain/types';
import { useWeek } from '../../store/selectors';
import { useStore } from '../../store/store';

const fmt = (n: number) => Math.round(n).toLocaleString();
const sign = (n: number) => (n >= 0 ? '+' : '−');
const mmss = (r: number) => `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
const WD = ['日', '月', '火', '水', '木', '金', '土'];
const kgTimes = (kg: number) => (kg > 0 ? `${kg}kg × ` : '× ');
/** 休憩の黒い帯は、ダークモードでも黒のまま */
const REST_BG = '#1F1712';
const REST_TRACK = '#3A2E26';
const REST_TEXT = '#FBF7F3';
const REST_ACCENT = '#F7CDBB';

export default function TrainingScreen() {
  const topInset = useTopInset();
  const router = useRouter();
  const now = useNow();
  const w = useWeek(now);
  const session = useStore((s) => s.session);
  const sessions = useStore((s) => s.sessions);
  const doneOpen = useStore((s) => s.doneOpen);
  const templates = useStore((s) => s.templates);
  const exercises = useStore((s) => s.exercises);
  const startSession = useStore((s) => s.startSession);
  const resumeSession = useStore((s) => s.resumeSession);
  const setDayType = useStore((s) => s.setDayType);
  const showToast = useStore((s) => s.showToast);
  const setDoneOpen = useStore((s) => s.setDoneOpen);
  const justCompleted = useStore((s) => s.justCompletedSession);
  const clearJustCompleted = useStore((s) => s.clearJustCompletedSession);
  const notifyPromptSeen = useStore((s) => s.notifyPromptSeen);
  const markNotifyPromptSeen = useStore((s) => s.markNotifyPromptSeen);
  const [notifyOpen, setNotifyOpen] = useState(false);

  // 初めてトレーニングを完了した直後だけ、通知の許可の前の案内を出す（19f）。
  // あとの完了でも、許可済みなら「あとP・C」の通知を送る（催促の通知は送らない）
  useEffect(() => {
    if (!justCompleted) return;
    clearJustCompleted();
    void sendWorkoutDoneNotification({ P: Math.max(0, Math.round(w.remaining.P)), C: Math.max(0, Math.round(w.remaining.C)) });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたとき・props が変わったときに、state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
    if (!notifyPromptSeen) setNotifyOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted]);

  const scheduled = templates.find((t) => t.id === w.todayTemplateId) ?? null;
  const done = !!w.todayWorkout;
  const history = sessions.slice(-8).reverse();
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? '';

  if (session) return <Recording insetsTop={topInset} />;

  /** 見るだけ（体験が終わって未購入）のときは、新しいトレーニングを始めさせず、購入の案内を出す */
  const guardRecord = () => {
    if (w.features.canRecord) return true;
    router.push('/paywall');
    return false;
  };
  const start = (templateId: string | null) => guardRecord() && startSession(templateId);

  /** そのメニューの前回の記録 */
  const lastOf = (t: WorkoutTemplate): SessionRecord | null => [...sessions].reverse().find((x) => x.templateId === t.id) ?? null;
  const rowMeta = (t: WorkoutTemplate, i: number) => {
    const e = t.exercises[i];
    const prev = lastOf(t)?.exercises.find((x) => x.exerciseId === e.exerciseId);
    const sets = prev?.sets.filter((x) => x.done);
    if (sets?.length) return `${kgTimes(sets[0].kg)}${sets.map((x) => x.reps).join('・')}`;
    return `${kgTimes(e.kg)}${Array.from({ length: e.sets }, () => e.reps).join('・')}`;
  };
  const prevLabel = (t: WorkoutTemplate) => {
    const l = lastOf(t);
    if (!l) return null;
    const [, m, d] = l.date.split('-').map(Number);
    return `前回の${t.name} ${m}/${d}（${WD[new Date(l.date.replace(/-/g, '/')).getDay()]}）`;
  };
  const menuMeta = (t: WorkoutTemplate) => t.exercises.map((e) => shortExName(exName(e.exerciseId))).join('・');
  const typeJp = (t: WorkoutTemplate) => (t.defaultDayType === 'high' ? '高' : '通常');
  // 予定を変える／もう1回トレーニングする：予定のメニュー以外（完了後は、すべて）
  const others = done ? templates : templates.filter((t) => t.id !== w.todayTemplateId);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: topInset + 8, paddingBottom: 30 }}>
        <T size={22} w={900} style={{ paddingHorizontal: 20 }}>トレーニング</T>

        {done && (
          <View style={{ marginHorizontal: 16, marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: color.brandPale, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={15} w={700} c={color.brandText} numberOfLines={1} style={{ flex: 1 }}>今日の{w.todayWorkout!.name} 完了</T>
              <N size={14} w={500} c={color.badgeFg}>{w.todayWorkout!.doneSets}セット</N>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <SoftButton label="結果を見る" onPress={() => setDoneOpen(true)} />
              <SoftButton label="続きを記録" onPress={resumeSession} />
            </View>
          </View>
        )}

        {!done && scheduled && w.today.type !== 'off' && (
          <View style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 10, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={12} c={color.sub}>今日の予定</T>
              <Badge high={scheduled.defaultDayType === 'high'}>{typeJp(scheduled)}</Badge>
            </View>
            <T size={20} w={900}>{scheduled.name}</T>
            {prevLabel(scheduled) && <T size={12} c={color.sub} style={{ marginBottom: -6 }}>{prevLabel(scheduled)}</T>}
            <View style={{ borderTopWidth: hairline, borderTopColor: color.line }}>
              {scheduled.exercises.map((e, i) => (
                <View key={`${e.exerciseId}-${i}`} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                  <N size={15} w={600} c={color.sub} style={{ width: 24 }}>{i + 1}</N>
                  <T size={14} style={{ flex: 1 }}>{exName(e.exerciseId)}</T>
                  <N size={15} w={600} c={color.badgeFg} style={{ flexShrink: 0 }}>{rowMeta(scheduled, i)}</N>
                </View>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => start(scheduled.id)} style={{ height: 64, borderRadius: radius.button, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
              <T size={16} w={700} c={color.onText}>開始</T>
            </Pressable>
          </View>
        )}

        {!done && (!scheduled || w.today.type === 'off') && (
          <View style={{ marginHorizontal: 16, marginTop: 14, padding: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 10, gap: 4 }}>
            <T size={12} c={color.sub}>今日の予定</T>
            <T size={20} w={900}>今日はオフ</T>
            <T size={12} c={color.sub}>やる日に変えるときは、下から選べます。</T>
          </View>
        )}

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>{done ? 'もう1回トレーニングする' : '予定を変える'}</T>
        <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }}>
          {others.map((t) => (
            <ListLine key={t.id} height={64} title={t.name} meta={menuMeta(t)} badge={typeJp(t)} onPress={() => start(t.id)} />
          ))}
          <ListLine height={64} title="フリートレーニング" meta="種目をその場で選ぶ" badge="通常" onPress={() => start(null)} last={done || w.today.type === 'off'} />
          {!done && w.today.type !== 'off' && (
            <ListLine
              height={64}
              title="今日は休む"
              meta="残りの日に配り直す"
              badge="オフ"
              last
              onPress={() => {
                const prev = useStore.getState().dayTypes[w.todayKey] ?? null;
                setDayType(w.todayKey, 'off');
                showToast('今日をオフに変更。目標を配り直しました', () => useStore.getState().setDayType(w.todayKey, prev));
                router.navigate('/');
              }}
            />
          )}
        </View>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>メニュー</T>
        <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }}>
          {templates.map((t) => (
            <ListLine key={t.id} height={60} title={t.name} meta={`${t.exercises.length}種目`} badge={typeJp(t)} onPress={() => router.push({ pathname: '/template/[id]', params: { id: t.id } })} />
          ))}
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/template/[id]', params: { id: 'new' } })} style={{ minHeight: 56, alignItems: 'center', justifyContent: 'center' }}>
            <T size={14} w={700}>＋ 新しいメニュー</T>
          </Pressable>
        </View>

        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}>履歴</T>
        <View style={{ marginHorizontal: 16, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 12, overflow: 'hidden' }}>
          {history.length === 0 && <T size={13} c={color.sub} style={{ padding: 16 }}>まだトレーニングの記録がありません。</T>}
          {history.map((h, i) => {
            const [, m, d] = h.date.split('-').map(Number);
            const wd = WD[new Date(h.date.replace(/-/g, '/')).getDay()];
            const mins = Math.max(1, Math.round((h.endedAt - h.startedAt) / 60000));
            return (
              <Pressable key={h.id} accessibilityRole="button" onPress={() => router.navigate({ pathname: '/review', params: { date: h.date } })} style={{ minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, paddingRight: 12, borderBottomWidth: i === history.length - 1 ? 0 : hairline, borderBottomColor: color.line }}>
                <View style={{ width: 52 }}>
                  <N size={18} w={600} style={{ lineHeight: 21 }}>{m}/{d}</N>
                  <T size={10.5} c={color.sub}>{wd}</T>
                </View>
                <T size={15} w={500} numberOfLines={1} style={{ flex: 1 }}>{h.name}</T>
                <N size={15} w={500} c={color.badgeFg}>{h.doneSets}セット · {mins}分</N>
                <T size={16} c={color.sub}>›</T>
              </Pressable>
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
      <NotificationPrompt visible={notifyOpen} onDone={() => { setNotifyOpen(false); markNotifyPromptSeen(); }} />
    </View>
  );
}

function SoftButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex: 1, height: 52, borderRadius: 10, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
      <T size={14} w={700}>{label}</T>
    </Pressable>
  );
}

/** 一覧の1行：名前・メタ・日タイプのバッジ・›。押すとその行の動作（開始・編集） */
function ListLine({ title, meta, badge, onPress, height, last }: { title: string; meta: string; badge: string; onPress: () => void; height: number; last?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: height, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 8, paddingLeft: 14, paddingRight: 12, borderBottomWidth: last ? 0 : hairline, borderBottomColor: color.line }}>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <T size={15} w={500} numberOfLines={1}>{title}</T>
        <T size={12} c={color.sub} numberOfLines={1}>{meta}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ backgroundColor: color.badgeBg, borderRadius: radius.badge, paddingHorizontal: 8, paddingVertical: 4 }}>
          <T size={11} w={700} c={color.badgeFg}>{badge}</T>
        </View>
        <T size={16} c={color.sub}>›</T>
      </View>
    </Pressable>
  );
}

function Recording({ insetsTop }: { insetsTop: number }) {
  const s = useStore();
  const ses = s.session!;
  const ex = ses.ex[ses.cur];
  const [picker, setPicker] = useState(ses.ex.length === 0);
  const sel = ex?.sets[ses.sel];
  // 種目を1つも入れずに始めたら、最初に種目を選ぶシートを出す
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 開いたとき・props が変わったときに、state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
    if (ses.ex.length === 0) setPicker(true);
  }, [ses.ex.length]);

  // 主ボタン：✓ Nセット目を記録 → その種目が全部終わったら「次へ：（種目名）」→ すべて終わったら「トレーニングを完了」
  let mainLabel = '種目を追加';
  let mainAct: () => void = () => setPicker(true);
  if (ex && sel) {
    const nu = ex.sets.findIndex((x) => !x.done);
    const allDone = ses.ex.every((e) => e.sets.every((x) => x.done));
    if (!sel.done) {
      mainLabel = `✓ ${ses.sel + 1}セット目を記録`;
      mainAct = () => s.toggleSet(ses.sel);
    } else if (nu >= 0) {
      mainLabel = `✓ ${nu + 1}セット目を記録`;
      mainAct = () => s.toggleSet(nu);
    } else if (!allDone) {
      const ni = ses.ex.findIndex((e, j) => j !== ses.cur && e.sets.some((x) => !x.done));
      mainLabel = `次へ：${ses.ex[ni].name}`;
      mainAct = () => s.selectExercise(ni);
    } else {
      mainLabel = 'トレーニングを完了';
      mainAct = () => s.finishSession();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insetsTop + 4, paddingBottom: 16 }}>
        {/* 種目の列：どれを押しても切り替わる。右に固定の「＋」と「終了」 */}
        <View style={{ paddingLeft: 14, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ gap: 6, paddingRight: 16 }}>
            {ses.ex.map((e, i) => {
              const all = e.sets.every((x) => x.done);
              const on = i === ses.cur;
              return (
                <Pressable key={`${e.exerciseId}-${i}`} accessibilityRole="button" onPress={() => s.selectExercise(i)} style={{ height: 40, paddingHorizontal: 12, borderRadius: radius.button, borderWidth: hairline, borderColor: on ? color.text : all ? color.track : color.lineStrong, backgroundColor: on ? color.text : all ? color.track : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12.5} w={on ? 700 : 400} c={on ? color.onText : all ? color.sub : color.text}>{(all ? '✓ ' : '') + e.name}</T>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable accessibilityRole="button" accessibilityLabel="種目を追加" onPress={() => setPicker(true)} style={{ width: 44, height: 40, borderRadius: radius.button, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
            <T size={20}>＋</T>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => s.finishSession()} style={{ height: 44, paddingHorizontal: 4, justifyContent: 'center' }}>
            <T size={14} w={700}>終了</T>
          </Pressable>
        </View>

        {ex ? (
          <>
            <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T size={26} w={900} numberOfLines={1} style={{ flexShrink: 1 }}>{ex.name}</T>
              {!!ex.tip && <Badge high>{ex.tip}</Badge>}
            </View>
            <N size={13} w={500} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 2 }}>前回 {ex.prevKg > 0 ? `${ex.prevKg} × ` : '× '}{(ex.prevRepsList ?? [ex.prevReps, ex.prevReps, ex.prevReps]).join('・')}</N>

            {/* セットの表：選んでいる行だけ開き、kgと回の±ボタンを出す */}
            <View style={{ marginHorizontal: 14, marginTop: 12, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: 14, overflow: 'hidden' }}>
              {ex.sets.map((st, i) => {
                const open = i === ses.sel;
                const vc = st.done || open ? color.text : color.faint;
                return (
                  <View key={i}>
                    <Pressable accessibilityRole="button" onPress={() => s.selectSet(i)} style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                      <N size={16} w={600} c={color.sub} style={{ width: 36 }}>{i + 1}</N>
                      <N size={24} w={600} c={vc} style={{ flex: 1 }}>{st.kg}</N>
                      <N size={24} w={600} c={vc} style={{ flex: 1 }}>{st.reps}</N>
                      <Pressable accessibilityRole="checkbox" accessibilityLabel={`${i + 1}セット目`} accessibilityState={{ checked: st.done }} onPress={() => s.toggleSet(i)} style={{ width: 46, height: 46, marginLeft: 6, borderRadius: 10, borderWidth: 1, borderColor: st.done ? color.text : color.lineStrong, backgroundColor: st.done ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
                        <T size={16} w={700} c={st.done ? color.onText : color.lineStrong}>✓</T>
                      </Pressable>
                    </Pressable>
                    {open && (
                      <View style={{ padding: 12, backgroundColor: color.bg, borderBottomWidth: hairline, borderBottomColor: color.line, flexDirection: 'row', gap: 10 }}>
                        <BigStep value={String(st.kg)} unit="kg" onDown={() => s.adjustSet('kg', -2.5)} onUp={() => s.adjustSet('kg', 2.5)} />
                        <BigStep value={String(st.reps)} unit="回" onDown={() => s.adjustSet('reps', -1)} onUp={() => s.adjustSet('reps', 1)} />
                      </View>
                    )}
                  </View>
                );
              })}
              <Pressable accessibilityRole="button" onPress={s.addSet} style={{ height: 48, alignItems: 'center', justifyContent: 'center' }}>
                <T size={14} w={700}>＋ セットを追加</T>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ padding: 22 }}>
            <T size={13} c={color.sub}>種目を選んで始めましょう。</T>
          </View>
        )}
      </ScrollView>

      {/* スクロールさせない部分：休憩の黒い帯と、主ボタン */}
      <View style={{ paddingTop: 8 }}>
        {s.rest > 0 && (
          <View style={{ marginHorizontal: 14, backgroundColor: REST_BG, borderRadius: 14, paddingTop: 10, paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <T size={13} w={700} c={REST_ACCENT}>休憩</T>
              <N size={40} w={600} c={REST_TEXT} style={{ lineHeight: 42 }}>{mmss(s.rest)}</N>
            </View>
            <View style={{ height: 4, backgroundColor: REST_TRACK, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: 4, width: `${Math.min(100, Math.round((s.rest / s.restMax) * 100))}%`, backgroundColor: REST_ACCENT }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <RestBtn label="−15秒" onPress={s.subRest} flex={1} />
              <RestBtn label="+15秒" onPress={s.addRest} flex={1} />
              <RestBtn label="スキップ" onPress={s.skipRest} flex={1.2} light />
            </View>
          </View>
        )}
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 }}>
          <Pressable accessibilityRole="button" onPress={mainAct} style={{ height: 68, borderRadius: 12, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center' }}>
            <T size={18} w={700} c={color.onText}>{mainLabel}</T>
          </Pressable>
        </View>
      </View>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} usedIds={ses.ex.map((e) => e.exerciseId)} onPick={(e) => s.addExerciseToSession(e.id)} />
    </View>
  );
}

function RestBtn({ label, onPress, flex, light }: { label: string; onPress: () => void; flex: number; light?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flex, height: 46, borderRadius: 8, backgroundColor: light ? REST_TEXT : REST_TRACK, alignItems: 'center', justifyContent: 'center' }}>
      {light ? <T size={14} w={700} c={REST_BG}>{label}</T> : <N size={17} w={600} c={REST_TEXT}>{label}</N>}
    </Pressable>
  );
}

/** 数字＋単位を中に出した ± ボタン（高さ64） */
function BigStep({ value, unit, onDown, onUp }: { value: string; unit: string; onDown: () => void; onUp: () => void }) {
  return (
    <View style={{ flex: 1, height: 64, flexDirection: 'row', alignItems: 'center', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 10, backgroundColor: color.surface }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${unit}を減らす`} onPress={onDown} style={{ width: 48, height: 64, alignItems: 'center', justifyContent: 'center' }}><T size={22}>−</T></Pressable>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <N size={28} w={600} style={{ lineHeight: 30 }}>{value}</N>
        <T size={10} c={color.sub}>{unit}</T>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${unit}を増やす`} onPress={onUp} style={{ width: 48, height: 64, alignItems: 'center', justifyContent: 'center' }}><T size={22}>＋</T></Pressable>
    </View>
  );
}

function DoneModal({ open, onClose, onMeal, w, median: med }: { open: boolean; onClose: () => void; onMeal: () => void; w: ReturnType<typeof useWeek>; median: number }) {
  const rec = w.todayWorkout;
  const mealSets = useStore((s) => s.mealSets);
  const setSessionMemo = useStore((s) => s.setSessionMemo);
  const [memo, setMemo] = useState('');
  // state を props に合わせる（意図した書き方。派生値への置き換えは挙動が変わるため見送り）
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  useEffect(() => setMemo(rec?.memo ?? ''), [rec?.id, open]);
  if (!rec) return null;
  const rem = w.remaining;
  const dC = w.today.C - w.plan.days[w.ti].C;
  const restDiff = w.eng.days.slice(w.ti + 1).reduce((a, d, i) => a + d.kcal - w.plan.days[w.ti + 1 + i].kcal, 0);
  const ratio = (rec.volume / med).toFixed(1);
  // いちばん重いセット（推定1RMが最大のセットを、重さ × 回数で出す）
  let heavy: { name: string; kg: number; reps: number } | null = null;
  let heavyE = -1;
  for (const e of rec.exercises) for (const x of e.sets) if (estimate1RM(x.kg, x.reps) > heavyE) { heavyE = estimate1RM(x.kg, x.reps); heavy = { name: e.name, kg: x.kg, reps: x.reps }; }
  const stats: [string, string][] = [
    ['ボリュームスコア', `${rec.volume.toFixed(1)}（普段 ${med.toFixed(1)}）`],
    [heavy ? `${heavy.name} いちばん重いセット` : 'いちばん重いセット', heavy ? `${heavy.kg > 0 ? `${heavy.kg}kg × ` : '× '}${heavy.reps}` : '—'],
    ['今日の目標', `${fmt(w.today.kcal)} kcal`],
  ];
  const quick = mealSets.find((m) => m.slotHint === 'トレ後') ?? null;
  const save = () => {
    if (memo !== rec.memo) setSessionMemo(rec.id, memo);
  };
  return (
    <Modal visible={open} animationType="slide" onRequestClose={() => { save(); onClose(); }}>
      <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 54 }}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
          <View style={{ paddingHorizontal: 22, paddingTop: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Badge high>完了</Badge>
            <T size={12} c={color.sub}>{rec.name}・{rec.doneSets}セット</T>
          </View>
          <T size={13} c={color.sub} style={{ paddingHorizontal: 22, marginTop: 24 }}>この後の食事で</T>
          {/* P・F・Cの3つを同じ大きさで並べる */}
          <View style={{ paddingHorizontal: 22, marginTop: 6, flexDirection: 'row', gap: 10 }}>
            {([['P', rem.P, color.P], ['F', rem.F, color.F], ['C', rem.C, color.C]] as const).map(([k, v, c]) => (
              <View key={k} style={{ flex: 1, borderTopWidth: 3, borderTopColor: c, paddingTop: 8 }}>
                <T size={12} w={700} c={color.badgeFg}>{k} あと</T>
                <N size={52} w={600} style={{ lineHeight: 54 }}>{Math.max(0, Math.round(v))}<T size={18}>g</T></N>
              </View>
            ))}
          </View>
          <T size={12.5} c={color.badgeFg} style={{ paddingHorizontal: 22, marginTop: 12, lineHeight: 21 }}>
            残り{fmt(Math.max(0, rem.kcal))}kcal。ボリュームは普段の{ratio}倍。
            {w.changed ? '' : `今日は予定どおり「${DAY_TYPE_JP[w.today.type]}」のまま。`}
          </T>
          {w.changed && (
            <View style={{ marginHorizontal: 22, marginTop: 14 }}>
              <Notice>
                <T size={12.5} w={700} c={color.brandText}>目標を変更</T>　今日を「{DAY_TYPE_JP[w.today.type]}」に変更。今日 C{sign(dC)}{Math.abs(dC)}g、残りの日に {sign(restDiff)}{fmt(Math.abs(restDiff))}kcal を配り直しました。
              </Notice>
            </View>
          )}
          <View style={{ marginHorizontal: 22, marginTop: 18, borderTopWidth: hairline, borderTopColor: color.line }}>
            {stats.map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingVertical: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                <T size={13} c={color.sub} numberOfLines={1} style={{ flexShrink: 1 }}>{k}</T>
                <N size={18} w={600}>{v}</N>
              </View>
            ))}
          </View>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            onBlur={save}
            placeholder="メモ（任意）"
            placeholderTextColor={color.faint}
            style={{ marginHorizontal: 22, marginTop: 14, height: 44, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, backgroundColor: color.surface, paddingHorizontal: 12, fontFamily: font.jp, fontSize: 14, color: color.text }}
          />
        </ScrollView>
        <View style={{ paddingHorizontal: 16, paddingBottom: 34, gap: 8 }}>
          {quick && (
            <QuickMeal
              name={quick.name}
              onDone={() => { save(); onClose(); }}
              setId={quick.id}
            />
          )}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable accessibilityRole="button" onPress={() => { save(); onMeal(); }} style={{ flex: 1, height: 52, borderRadius: 10, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T size={14}>{quick ? '他を選ぶ' : '食事を記録'}</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { save(); onClose(); }} style={{ flex: 1, height: 52, borderRadius: 10, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T size={14}>閉じる</T>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** 「プロテイン＋バナナを追加」：いつものトレーニング後の食事を、間食として1タップで入れる */
function QuickMeal({ name, setId, onDone }: { name: string; setId: string; onDone: () => void }) {
  const mealSets = useStore((s) => s.mealSets);
  const addFromMealSet = useStore((s) => s.addFromMealSet);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={async () => {
        const ms = mealSets.find((m) => m.id === setId);
        if (!ms) return;
        const foods = await getFoodsByIds(ms.items.map((i) => i.foodId));
        addFromMealSet(ms, foods, { slot: '間食' });
        onDone();
      }}
      style={{ height: 64, borderRadius: 12, backgroundColor: color.text, alignItems: 'center', justifyContent: 'center', gap: 2 }}
    >
      <T size={16} w={700} c={color.onText}>{name}を追加</T>
      <T size={11.5} c={color.faint}>いつものトレーニング後</T>
    </Pressable>
  );
}
