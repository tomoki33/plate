import * as Clipboard from 'expo-clipboard';
import React from 'react';
import { Share, View } from 'react-native';
import { N, OutlineButton, PrimaryButton, Sheet, T, color, hairline, radius } from '@/design-system';
import { useCoach } from '../../store/coachStore';
import { useStore } from '../../store/store';

export const inviteLink = (code: string) => `plate://coach-join?code=${code}`;

/** 招待コードの表示：コピー／リンクを送る。生徒がコードを入れると、共有の依頼が生徒に届く */
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const coach = useCoach((s) => s.coach);
  const showToast = useStore((s) => s.showToast);
  const code = coach?.invite_code ?? '';
  const message = `PLATE のコーチ（${coach?.name ?? ''}）から招待です。PLATE の 設定 →「コーチと共有」に、次のコードを入れてください。\n\nコード：${code}\n${inviteLink(code)}`;
  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 14 }}>
        <T size={17} w={900}>生徒を招待</T>
        <T size={12} c={color.sub} style={{ lineHeight: 19 }}>生徒が設定でこのコードを入れると、共有の依頼が生徒に届きます。生徒が承認するまで、記録は何も見えません。</T>
        <View style={{ height: 76, borderRadius: radius.card, borderWidth: hairline, borderColor: color.lineStrong, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
          <N size={34} w={700} style={{ letterSpacing: 6 }}>{code || '——'}</N>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <OutlineButton
              label="コピー"
              onPress={async () => {
                await Clipboard.setStringAsync(code);
                showToast('招待コードをコピーしました');
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton label="リンクを送る" disabled={!code} onPress={() => void Share.share({ message })} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}
