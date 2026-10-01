import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Notice, T, color, hairline, radius } from '@/design-system';
import { BASES, DISCLAIMER } from '../domain/citations';

/**
 * 計算の根拠と出典。アプリが表示する数値（カロリー・PFC・ペースなど）の元になっている資料へのリンク。
 * 出典がないものは、「本アプリ独自の設計」とはっきり書く。設定・今日の画面・データの画面から開ける。
 */
export default function Sources() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 12 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 48 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={{ height: 44, justifyContent: 'center' }}>
          <T size={14} c={color.sub}>‹ 戻る</T>
        </Pressable>
        <T size={15} w={700}>計算の根拠と出典</T>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          <Notice>{DISCLAIMER}</Notice>
        </View>
        <T size={12} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 14, lineHeight: 19 }}>
          PLATE が表示する数値が、何をもとに計算されているかの一覧です。リンクを押すと、元の論文や公的資料が開きます。
        </T>
        {BASES.map((b) => (
          <View key={b.id} style={{ marginHorizontal: 16, marginTop: 14, padding: 14, gap: 10, backgroundColor: color.surface, borderWidth: hairline, borderColor: color.line, borderRadius: radius.card }}>
            <T size={15} w={700}>{b.topic}</T>
            <T size={13} c={color.badgeFg} style={{ lineHeight: 21 }}>{b.usage}</T>
            {b.sources.map((s) => (
              <Pressable key={s.url} accessibilityRole="link" onPress={() => void Linking.openURL(s.url)} style={{ minHeight: 44, justifyContent: 'center', gap: 2, borderTopWidth: hairline, borderTopColor: color.line }}>
                <T size={13} w={500} style={{ textDecorationLine: 'underline' }}>{s.title}</T>
                {s.note ? <T size={11.5} c={color.sub}>{s.note}</T> : null}
              </Pressable>
            ))}
            {b.original ? (
              <T size={12} c={color.brandText} style={{ lineHeight: 19 }}>
                {b.sources.length ? '補足：' : ''}
                {b.original}
              </T>
            ) : null}
          </View>
        ))}
        <T size={11} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 16, lineHeight: 18 }}>
          食品の栄養成分：文部科学省「日本食品標準成分表（八訂）」を加工して作成。
        </T>
      </ScrollView>
    </View>
  );
}
