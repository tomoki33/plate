import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { N, Sheet, T, color, hairline, lightPalette, radius } from '@/design-system';
import { shortMd } from '../../features/coach/dateKeys';
import { useCoach } from '../../store/coachStore';
import { Avatar } from './CoachBits';

/** 今日画面の上の1行：コーチからのひとこと／目標の更新。タップすると既読になって消える（コーチにつながっていない人には出ない） */
export function TodayCoachBanners() {
  const router = useRouter();
  const notes = useCoach((s) => s.notes);
  const seenNote = useCoach((s) => s.seenNoteId);
  const managed = useCoach((s) => s.managed);
  const seenPlan = useCoach((s) => s.seenPlanId);
  const link = useCoach((s) => s.link);
  const markNote = useCoach((s) => s.markNoteSeen);
  const markPlan = useCoach((s) => s.markPlanSeen);
  const [planOpen, setPlanOpen] = useState(false);
  if (!link) return null;

  const note = notes[0];
  const showNote = !!note && note.id !== seenNote;
  const showPlan = !!managed && managed.planId !== seenPlan && link.managesGoals;
  if (!showNote && !showPlan) return null;

  const row = (text: React.ReactNode, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 52, marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 14, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color.brand }} />
      <T size={14} style={{ flex: 1 }}>{text}</T>
      <T size={16} c={color.sub}>›</T>
    </Pressable>
  );

  return (
    <View style={{ paddingTop: 8 }}>
      {showNote && row(<><T size={14} w={700}>{note.coachName}</T>からひとこと</>, () => { markNote(note.id); router.navigate('/review'); })}
      {showPlan && managed && row(<T size={14} w={700}>コーチが目標を更新しました</T>, () => setPlanOpen(true))}
      <Sheet visible={planOpen} onClose={() => { setPlanOpen(false); if (managed) markPlan(managed.planId); }}>
        {managed && (
          <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 10 }}>
            <T size={17} w={900}>{managed.coachName}が目標を更新しました</T>
            {[
              ['目標体重', `${managed.targetWeight.toFixed(1)}kg`],
              ['ペース', managed.pace === 0 ? '維持' : `${managed.pace > 0 ? '+' : '−'}${Math.abs(managed.pace).toFixed(2)}kg/週`],
              ['たんぱく質', `${managed.proteinG}g / 日`],
              ['脂質', `${managed.fatPct}%`],
              ['メニュー', managed.templateIds.length ? `${managed.templateIds.length}つ（トレーニングタブに入っています）` : '変更なし'],
            ].map(([k, v]) => (
              <View key={k} style={{ minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, gap: 12 }}>
                <T size={14}>{k}</T>
                <N size={16} numberOfLines={1} style={{ flexShrink: 1 }}>{v}</N>
              </View>
            ))}
            <T size={11.5} c={color.sub} style={{ lineHeight: 18 }}>今日の目安に反映されています。設定の目標には「コーチが設定」と表示され、見るだけになります。</T>
          </View>
        )}
      </Sheet>
    </View>
  );
}

/** レビュー画面の最上部：コーチ名＋本文の小さな黒いカード */
export function ReviewNoteCard() {
  const note = useCoach((s) => s.notes[0]);
  const markNote = useCoach((s) => s.markNoteSeen);
  React.useEffect(() => {
    if (note) markNote(note.id);
  }, [note, markNote]);
  if (!note) return null;
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, marginBottom: 4, padding: 16, gap: 10, borderRadius: 12, backgroundColor: lightPalette.text }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={note.coachName} size={28} />
        <T size={13} w={700} c={lightPalette.bg}>{note.coachName}</T>
        <T size={11} c={lightPalette.brandPale2} style={{ marginLeft: 'auto' }}>{shortMd(note.weekStart)}〜の週</T>
      </View>
      <T size={15} c={lightPalette.bg} style={{ lineHeight: 26 }}>{note.body}</T>
    </View>
  );
}
