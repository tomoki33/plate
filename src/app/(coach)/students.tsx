import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { N, Segmented, T, color, hairline } from '@/design-system';
import { Avatar, WarnBadge, WeekBars } from '../../components/coach/CoachBits';
import { BandButton, CoachFrame } from '../../components/coach/Frames';
import { InviteSheet } from '../../components/coach/InviteSheet';
import { needCount, sortJoined, sortStalled, summarize } from '../../features/coach/aggregate';
import { useCoach } from '../../store/coachStore';

/** 生徒（一覧）：止まっている人が上。警告バッジ・今週7日のバー・記録日数 n/7 */
export default function Students() {
  const router = useRouter();
  const students = useCoach((s) => s.students);
  const busy = useCoach((s) => s.busy);
  const error = useCoach((s) => s.error);
  const refresh = useCoach((s) => s.refreshCoach);
  const [sort, setSort] = useState<'stalled' | 'joined'>('stalled');
  const [invite, setInvite] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const list = useMemo(() => {
    const items = students.map((r) => summarize(r));
    return sort === 'stalled' ? sortStalled(items) : sortJoined(items);
  }, [students, sort]);
  const need = useMemo(() => needCount(list), [list]);

  return (
    <CoachFrame right={<BandButton label="＋ 生徒を招待" onPress={() => setInvite(true)} />}>
      <ScrollView refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} />} contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={18} w={700}>生徒</T>
          {students.length > 0 && (
            <T size={12} c={color.sub}>
              <N size={15} w={600}>{need}</N> 人に声かけを
            </T>
          )}
        </View>
        {students.length > 1 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            <Segmented value={sort} onChange={setSort} options={[{ value: 'stalled', label: '止まっている順' }, { value: 'joined', label: '登録順' }]} />
          </View>
        )}
        {error ? <T size={12} c={color.brandText} style={{ paddingHorizontal: 18, paddingBottom: 8 }}>{error}</T> : null}
        <View style={{ backgroundColor: color.surface, borderTopWidth: hairline, borderTopColor: color.line }}>
          {list.map((s) => (
            <Pressable
              key={s.row.userId}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/student/[id]', params: { id: s.row.userId } })}
              style={{ minHeight: 72, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}
            >
              <Avatar name={s.row.studentName} />
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                  <T size={15} w={700} numberOfLines={1} style={{ flexShrink: 1 }}>{s.row.studentName || '（名前なし）'}</T>
                  {s.paused ? <WarnBadge text="ひとりで使用中" /> : s.badge ? <WarnBadge text={s.badge} /> : null}
                </View>
                <WeekBars marks={s.marks} />
              </View>
              {!s.paused && (
                <N size={19} w={600}>
                  {s.days}
                  <T size={12} c={color.sub}>/7</T>
                </N>
              )}
              <T size={16} c={color.sub}>›</T>
            </Pressable>
          ))}
          {!students.length && !busy && (
            <View style={{ padding: 28, gap: 8, alignItems: 'center' }}>
              <T size={14} w={700}>まだ生徒がいません</T>
              <T size={12} c={color.sub} style={{ textAlign: 'center', lineHeight: 19 }}>右上の「＋ 生徒を招待」から招待コードを送ってください。生徒が承認すると、ここに表示されます。</T>
            </View>
          )}
        </View>
      </ScrollView>
      <InviteSheet open={invite} onClose={() => setInvite(false)} />
    </CoachFrame>
  );
}
