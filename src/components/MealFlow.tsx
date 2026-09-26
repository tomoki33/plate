import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { AI_LIMIT_FREE, estimateMeal, type EstimateRow } from '../domain/estimate';
import { calcPfc, FOOD_BY_ID, MY_SETS, searchFoods } from '../domain/foods';
import type { Pfc } from '../domain/types';
import { useStore } from '../store/store';
import { Badge, color, font, hairline, Hairline, N, PrimaryButton, radius, Sheet, StepButton, T } from '@/design-system';

type Mode = 0 | 1 | 2;

interface Props {
  open: boolean;
  initialMode: Mode;
  onClose: () => void;
  remaining: Pfc;
  todayKey: string;
  /** トレ後（完了済み）ならマイセットを「トレ後によく使う順」にする */
  postWorkout: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const pfcLine = (v: Pfc) => `P${v.P} F${v.F} C${v.C}・${v.kcal}kcal`;

export function MealFlow({ open, initialMode, onClose, remaining, todayKey, postWorkout }: Props) {
  const addMeal = useStore((s) => s.addMeal);
  const consumeAi = useStore((s) => s.consumeAi);
  const aiUsed = useStore((s) => s.aiUsed[todayKey] ?? 0);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [query, setQuery] = useState('');
  const [gram, setGram] = useState<{ id: string; g: number } | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiRows, setAiRows] = useState<EstimateRow[] | null>(null);
  const aiLeft = Math.max(0, AI_LIMIT_FREE - aiUsed);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setGram(null);
      setQuery('');
    }
  }, [open, initialMode]);

  const finish = (name: string, v: Pfc, ai?: boolean) => {
    addMeal(name, v, ai);
    setGram(null);
    setAiRows(null);
    onClose();
  };

  // マイセット：トレ後は「トレ後によく使う順」
  const sets = MY_SETS.slice().sort((a, b) => (postWorkout ? Number(!!b.postWorkout) - Number(!!a.postWorkout) : 0));
  const results = searchFoods(query);

  const gramFood = gram ? FOOD_BY_ID[gram.id] : null;
  const gramV = gram ? calcPfc([[gram.id, gram.g]]) : null;
  const setG = (g: number) => setGram((x) => (x ? { ...x, g: Math.max(10, g) } : x));

  const known = (aiRows ?? []).filter((r) => r.id);
  const aiV = calcPfc(known.map((r) => [r.id!, r.grams!]));

  return (
    <>
      <Sheet visible={open && !aiRows} onClose={onClose}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <T size={17} w={900}>夜ごはんに追加</T>
          <T size={12} c={color.sub} style={{ marginTop: 2 }}>
            あと P{remaining.P} F{remaining.F} C{remaining.C}
          </T>
          <View style={{ flexDirection: 'row', backgroundColor: color.track, borderRadius: radius.button, padding: 3, marginTop: 12 }}>
            {['マイセット', '検索', '文章で入力'].map((label, i) => (
              <Pressable
                key={label}
                accessibilityRole="tab"
                onPress={() => {
                  setMode(i as Mode);
                  setGram(null);
                }}
                style={{ flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: mode === i ? '#fff' : 'transparent' }}
              >
                <T size={13} w={mode === i ? 700 : 400}>{label}</T>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {mode === 0 && (
            <>
              <T size={11} c={color.sub} style={{ marginVertical: 8 }}>{postWorkout ? 'トレ後によく使う順' : 'よく使う順'}</T>
              {sets.map((st) => {
                const v = calcPfc(st.items);
                return (
                  <Pressable key={st.name} accessibilityRole="button" onPress={() => finish(st.name.replace('トレ後：', ''), v)} style={{ minHeight: 56, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line, paddingVertical: 8 }}>
                    <T size={14} w={500}>{st.name}</T>
                    <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>{pfcLine(v)}</N>
                  </Pressable>
                );
              })}
            </>
          )}

          {mode === 1 && !gram && (
            <>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="食品名で検索（日本食品標準成分表 八訂）"
                placeholderTextColor={color.faint}
                style={{ height: 44, borderWidth: 1, borderColor: color.lineStrong, borderRadius: radius.input, paddingHorizontal: 12, fontFamily: font.jp, fontSize: 14, color: color.text, backgroundColor: '#fff', marginTop: 8 }}
              />
              {results.length === 0 && <T size={13} c={color.sub} style={{ marginTop: 16 }}>見つかりませんでした。</T>}
              {results.map((f) => (
                <Pressable key={f.id} accessibilityRole="button" onPress={() => setGram({ id: f.id, g: f.defaultG })} style={{ minHeight: 56, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line, paddingVertical: 8, marginTop: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T size={14} w={500} style={{ flex: 1 }}>{f.name}</T>
                    <T size={11} c={color.sub}>{f.source ?? '成分表'}</T>
                  </View>
                  <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>100gあたり P{f.P} F{f.F} C{f.C}・{f.kcal}kcal</N>
                </Pressable>
              ))}
            </>
          )}

          {mode === 1 && gram && gramFood && gramV && (
            <View style={{ paddingTop: 8 }}>
              <Pressable accessibilityRole="button" onPress={() => setGram(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={13} c={color.sub}>‹ 検索に戻る</T>
              </Pressable>
              <T size={16} w={700}>{gramFood.name}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 14 }}>
                <StepButton label="−" onPress={() => setG(gram.g - 10)} size={52} />
                <N size={44} w={600}>{gram.g}<T size={16} c={color.sub}>g</T></N>
                <StepButton label="+" onPress={() => setG(gram.g + 10)} size={52} />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                {[50, 100, 150, 200].map((g) => (
                  <Pressable key={g} accessibilityRole="button" onPress={() => setG(g)} style={{ minWidth: 60, height: 44, borderRadius: radius.button, borderWidth: 1, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
                    <N size={15} w={500}>{g}g</N>
                  </Pressable>
                ))}
              </View>
              <N size={13} w={500} c={color.sub} style={{ marginTop: 14, textAlign: 'center' }}>
                {pfcLine(gramV)}
              </N>
              <T size={12} c={color.sub} style={{ textAlign: 'center', marginTop: 2 }}>
                追加後の残り P{remaining.P - gramV.P}g・C{remaining.C - gramV.C}g（目安）
              </T>
              <PrimaryButton label="追加" style={{ marginTop: 16 }} onPress={() => finish(`${gramFood.name.replace(/（.*）/, '')} ${gram.g}g`, gramV)} />
            </View>
          )}

          {mode === 2 && (
            <View style={{ paddingTop: 8 }}>
              <TextInput
                value={aiText}
                onChangeText={setAiText}
                placeholder="例：鶏むね200g 米150g 味噌汁"
                placeholderTextColor={color.faint}
                multiline
                style={{ minHeight: 96, textAlignVertical: 'top', borderWidth: 1, borderColor: color.lineStrong, borderRadius: radius.input, padding: 12, fontFamily: font.jp, fontSize: 14, color: color.text, backgroundColor: '#fff' }}
              />
              <T size={12} c={color.sub} style={{ marginTop: 8 }}>
                今日あと{aiLeft}回（無料 {AI_LIMIT_FREE}回／日）。推定のあと、確認画面で直せます。
              </T>
              <PrimaryButton
                label="推定する"
                disabled={!aiText.trim() || aiLeft === 0}
                style={{ marginTop: 12 }}
                onPress={() => {
                  consumeAi(todayKey);
                  setAiRows(estimateMeal(aiText));
                }}
              />
            </View>
          )}
        </ScrollView>
      </Sheet>

      {/* AI推定の確認（全画面）。必ずこの画面を挟む */}
      <Modal visible={open && !!aiRows} animationType="slide" onRequestClose={() => setAiRows(null)}>
        <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 54 }}>
          <View style={{ paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T size={22} w={900}>推定の確認</T>
            <Pressable accessibilityRole="button" onPress={() => setAiRows(null)} hitSlop={10} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={13} c={color.sub}>戻る</T>
            </Pressable>
          </View>
          <T size={12} c={color.sub} style={{ paddingHorizontal: 22, marginTop: 2 }}>数字はすべて目安です。gを直せます。</T>
          <ScrollView style={{ marginTop: 10 }} contentContainerStyle={{ paddingHorizontal: 22 }}>
            {(aiRows ?? []).map((r, i) => {
              if (!r.id) {
                return (
                  <View key={i} style={{ paddingVertical: 12, borderTopWidth: hairline, borderTopColor: color.line }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <T size={14} w={500}>{r.token}</T>
                      <Badge>見つからず</Badge>
                    </View>
                    <T size={12} c={color.sub} style={{ marginTop: 4 }}>成分表にないため除外します。検索から追加できます。</T>
                  </View>
                );
              }
              const x = calcPfc([[r.id, r.grams!]]);
              const update = (d: number) => setAiRows((rows) => rows!.map((z, j) => (j === i ? { ...z, grams: Math.max(10, z.grams! + d) } : z)));
              return (
                <View key={i} style={{ paddingVertical: 10, borderTopWidth: hairline, borderTopColor: color.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <T size={14} w={500}>{FOOD_BY_ID[r.id].name}</T>
                      <Badge high>AI推定</Badge>
                    </View>
                    <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>{pfcLine(x)}</N>
                  </View>
                  <StepButton label="−" onPress={() => update(-10)} />
                  <N size={16} w={600} style={{ minWidth: 44, textAlign: 'center' }}>{r.grams}g</N>
                  <StepButton label="+" onPress={() => update(10)} />
                </View>
              );
            })}
          </ScrollView>
          <Hairline />
          <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14 }}>
              <N size={32} w={600}>{fmt(aiV.kcal)}<T size={12} c={color.sub}> kcal</T></N>
              <N size={15} w={600} c={color.P}>P{aiV.P}</N>
              <N size={15} w={600} c={color.F}>F{aiV.F}</N>
              <N size={15} w={600} c={color.C}>C{aiV.C}</N>
            </View>
            <T size={12} c={color.sub} style={{ marginTop: 4 }}>
              追加後の残り　P{remaining.P - aiV.P}g・F{remaining.F - aiV.F}g・C{remaining.C - aiV.C}g（目安）
            </T>
          </View>
          <View style={{ padding: 16, paddingBottom: 34 }}>
            <PrimaryButton label="この内容で追加" disabled={known.length === 0} onPress={() => finish(aiText.trim().slice(0, 18), aiV, true)} />
          </View>
        </View>
      </Modal>
    </>
  );
}
