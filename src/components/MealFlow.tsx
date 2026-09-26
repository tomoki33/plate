import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Badge, Field, Hairline, N, Notice, NumberStepper, PrimaryButton, Segmented, Sheet, T, color, font, hairline, radius } from '@/design-system';
import { getFoodsByIds, searchFoodsDb } from '../db/repo';
import { SLOT_LABEL, shortName } from '../domain/foodSearch';
import type { FoodItem, MealSet, Slot } from '../domain/models';
import type { Pfc } from '../domain/types';
import { estimateMeal, type EstimateRow } from '../services/ai';
import { accessToken } from '../services/supabase';
import { useStore, type MealItemInput } from '../store/store';

type Mode = 0 | 1 | 2;

interface Props {
  open: boolean;
  initialMode: Mode;
  onClose: () => void;
  remaining: Pfc;
  /** AI入力の回数は「今日」の分として数える */
  todayKey: string;
  /** 記録する日（過去の日も選べる） */
  date: string;
  /** 「9/24（木）」のように、今日以外を記録するときの表示 */
  dateLabel: string | null;
  slot: Slot;
  /** トレ後（完了済み）ならマイセットを「トレ後によく使う順」にする */
  postWorkout: boolean;
  aiLimit: number;
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const r1 = (n: number) => Math.round(n * 10) / 10;
const pfcLine = (v: Pfc) => `P${Math.round(v.P)} F${Math.round(v.F)} C${Math.round(v.C)}・${Math.round(v.kcal)}kcal`;
const scale = (per: { kcal: number; p: number; f: number; c: number }, g: number): Pfc => ({ kcal: Math.round((per.kcal * g) / 100), P: r1((per.p * g) / 100), F: r1((per.f * g) / 100), C: r1((per.c * g) / 100) });
const foodInput = (f: FoodItem, g: number): MealItemInput => ({ foodId: f.id, name: shortName(f.name), grams: g, ...scale(f, g) });

export function MealFlow({ open, initialMode, onClose, remaining, todayKey, date, dateLabel, slot: slotProp, postWorkout, aiLimit }: Props) {
  const router = useRouter();
  const addMealItems = useStore((s) => s.addMealItems);
  const addFromMealSet = useStore((s) => s.addFromMealSet);
  const saveMealSet = useStore((s) => s.saveMealSet);
  const saveMyFood = useStore((s) => s.saveMyFood);
  const consumeAi = useStore((s) => s.consumeAi);
  const mealSets = useStore((s) => s.mealSets);
  const aiUsed = useStore((s) => s.aiUsed[todayKey] ?? 0);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [slot, setSlot] = useState<Slot>(slotProp);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [gram, setGram] = useState<{ food: FoodItem; g: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [setFoods, setSetFoods] = useState<Record<string, FoodItem>>({});
  const [aiText, setAiText] = useState('');
  const [aiRows, setAiRows] = useState<EstimateRow[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiLeft = Math.max(0, aiLimit - aiUsed);
  const reqId = useRef(0);

  useEffect(() => {
    if (open) {
      setSlot(slotProp);
      setMode(initialMode);
      setGram(null);
      setManual(false);
      setQuery('');
    }
  }, [open, initialMode, slotProp]);

  // 検索（入力が止まってから）
  useEffect(() => {
    if (!open || mode !== 1) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      searchFoodsDb(query).then((r) => {
        if (id === reqId.current) setResults(r);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [open, mode, query]);

  // マイセットの中身（食品）を読む
  useEffect(() => {
    if (!open) return;
    const ids = [...new Set(mealSets.flatMap((m) => m.items.map((i) => i.foodId)))];
    getFoodsByIds(ids).then((fs) => setSetFoods(Object.fromEntries(fs.map((f) => [f.id, f]))));
  }, [open, mealSets]);

  const finish = (name: string, items: MealItemInput[], ai?: boolean) => {
    addMealItems(name, items, { ai, date, slot });
    setGram(null);
    setAiRows(null);
    setManual(false);
    onClose();
  };

  // マイセット：時間帯に合う候補を上に、そのあと最近使った順
  const hint = postWorkout ? 'トレ後' : slot;
  const sets = useMemo(() => {
    const score = (m: MealSet) => (m.slotHint === hint ? 1 : 0);
    return mealSets.slice().sort((a, b) => score(b) - score(a) || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.useCount - a.useCount);
  }, [mealSets, hint]);
  const setPfc = (m: MealSet): Pfc =>
    m.items.reduce<Pfc>(
      (a, it) => {
        const f = setFoods[it.foodId];
        if (!f) return a;
        const v = scale(f, it.g);
        return { kcal: a.kcal + v.kcal, P: a.P + v.P, F: a.F + v.F, C: a.C + v.C };
      },
      { kcal: 0, P: 0, F: 0, C: 0 },
    );

  const gramV = gram ? scale(gram.food, gram.g) : null;
  const setG = (g: number) => setGram((x) => (x ? { ...x, g: Math.max(1, g) } : x));

  const known = (aiRows ?? []).filter((r) => r.per100);
  const aiItems: MealItemInput[] = known.map((r) => ({ foodId: r.foodId ?? null, name: shortName(r.name!), grams: r.grams!, ...scale(r.per100!, r.grams!) }));
  const aiV = aiItems.reduce<Pfc>((a, i) => ({ kcal: a.kcal + i.kcal, P: a.P + i.P, F: a.F + i.F, C: a.C + i.C }), { kcal: 0, P: 0, F: 0, C: 0 });

  const runAi = async () => {
    setAiBusy(true);
    try {
      consumeAi(todayKey);
      setAiRows(await estimateMeal(aiText, accessToken));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <>
      <Sheet visible={open && !aiRows} onClose={onClose}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <T size={17} w={900}>{dateLabel ? `${dateLabel} ` : ''}{SLOT_LABEL[slot]}に追加</T>
          <T size={12} c={color.sub} style={{ marginTop: 2 }}>あと P{Math.round(remaining.P)} F{Math.round(remaining.F)} C{Math.round(remaining.C)}（目安）</T>
          <View style={{ marginTop: 10 }}>
            <Segmented value={slot} onChange={setSlot} options={(['朝', '昼', '間食', '夜'] as Slot[]).map((v) => ({ value: v, label: v }))} />
          </View>
          <View style={{ marginTop: 12 }}>
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setGram(null);
                setManual(false);
              }}
              options={[{ value: 0 as Mode, label: 'マイセット' }, { value: 1 as Mode, label: '検索' }, { value: 2 as Mode, label: '文章で入力' }]}
            />
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" style={{ marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          {mode === 0 && (
            <>
              <T size={11} c={color.sub} style={{ marginVertical: 8 }}>{postWorkout ? 'トレ後によく使う順' : '最近使った順'}</T>
              {sets.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 12 }}>マイセットはまだありません。検索や文章入力のあと、登録できます。</T>}
              {sets.map((m) => (
                <Pressable key={m.id} accessibilityRole="button" onPress={() => { addFromMealSet(m, Object.values(setFoods), { date, slot }); onClose(); }} style={{ minHeight: 56, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <T size={14} w={500}>{m.name}</T>
                    {m.slotHint === hint && <Badge>{m.slotHint}</Badge>}
                  </View>
                  <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>{pfcLine(setPfc(m))}</N>
                </Pressable>
              ))}
            </>
          )}

          {mode === 1 && !gram && !manual && (
            <>
              <Field value={query} onChangeText={setQuery} placeholder="食品名で検索（日本食品標準成分表 八訂）" style={{ marginTop: 8 }} />
              {!query.trim() && <T size={11} c={color.sub} style={{ marginTop: 10 }}>マイ食品とよく使う食品</T>}
              {results.length === 0 && query.trim() !== '' && <T size={13} c={color.sub} style={{ marginTop: 16 }}>見つかりませんでした。</T>}
              {results.map((f) => (
                <Pressable key={f.id} accessibilityRole="button" onPress={() => setGram({ food: f, g: f.defaultG ?? 100 })} style={{ minHeight: 56, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <T size={14} w={500} style={{ flex: 1 }}>{shortName(f.name)}</T>
                    <T size={11} c={color.sub}>{f.source === '自作' ? 'マイ食品' : '成分表'}</T>
                  </View>
                  <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>100gあたり P{f.p} F{f.f} C{f.c}・{f.kcal}kcal</N>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={{ minHeight: 48, justifyContent: 'center', borderTopWidth: hairline, borderTopColor: color.line }}>
                <T size={13} w={700}>見つからない？ 成分表示から手入力</T>
              </Pressable>
              <T size={10.5} c={color.sub} style={{ marginTop: 6 }}>出典：文部科学省「日本食品標準成分表（八訂）」</T>
            </>
          )}

          {mode === 1 && gram && gramV && (
            <View style={{ paddingTop: 8 }}>
              <Pressable accessibilityRole="button" onPress={() => setGram(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <T size={13} c={color.sub}>‹ 検索に戻る</T>
              </Pressable>
              <T size={16} w={700}>{shortName(gram.food.name)}</T>
              <View style={{ alignItems: 'center', marginTop: 14 }}>
                <NumberStepper value={gram.g} onChange={setG} step={10} min={1} max={5000} unit="g" size={44} width={120} buttonSize={52} accessibilityLabel="グラム" />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                {[50, 100, 150, 200].map((g) => (
                  <Pressable key={g} accessibilityRole="button" onPress={() => setG(g)} style={{ minWidth: 60, height: 44, borderRadius: radius.button, borderWidth: 1, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                    <N size={15} w={500}>{g}g</N>
                  </Pressable>
                ))}
                {gram.food.unitG ? (
                  <Pressable accessibilityRole="button" onPress={() => setG(gram.g + gram.food.unitG!)} style={{ minWidth: 60, height: 44, paddingHorizontal: 10, borderRadius: radius.button, borderWidth: 1, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                    <T size={13}>＋1個（{gram.food.unitG}g）</T>
                  </Pressable>
                ) : null}
              </View>
              <N size={13} w={500} c={color.sub} style={{ marginTop: 14, textAlign: 'center' }}>{pfcLine(gramV)}</N>
              <T size={12} c={color.sub} style={{ textAlign: 'center', marginTop: 2 }}>追加後の残り P{Math.round(remaining.P - gramV.P)}g・C{Math.round(remaining.C - gramV.C)}g（目安）</T>
              <PrimaryButton label="追加" style={{ marginTop: 16 }} onPress={() => finish(`${shortName(gram.food.name)} ${gram.g}g`, [foodInput(gram.food, gram.g)])} />
            </View>
          )}

          {mode === 1 && manual && (
            <ManualEntry
              onBack={() => setManual(false)}
              onAdd={(f, g, save) => {
                const id = save ? saveMyFood({ name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, defaultG: g }) : null;
                finish(`${f.name} ${g}g`, [{ foodId: id, name: f.name, grams: g, ...scale(f, g) }]);
              }}
            />
          )}

          {mode === 2 && (
            <View style={{ paddingTop: 8 }}>
              <TextInput
                value={aiText}
                onChangeText={setAiText}
                placeholder="例：鶏むね200g 米150g 味噌汁"
                placeholderTextColor={color.faint}
                multiline
                style={{ minHeight: 96, textAlignVertical: 'top', borderWidth: 1, borderColor: color.lineStrong, borderRadius: radius.input, padding: 12, fontFamily: font.jp, fontSize: 14, color: color.text, backgroundColor: color.surface }}
              />
              <T size={12} c={color.sub} style={{ marginTop: 8 }}>今日あと{aiLeft}回（1日{aiLimit}回まで）。推定のあと、確認画面で直せます。</T>
              {aiLeft === 0 && (
                <View style={{ marginTop: 8 }}>
                  <Notice>
                    今日の回数を使い切りました。有料プランなら1日30回まで使えます。
                  </Notice>
                  <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push('/paywall'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T size={13} w={700}>プランを見る ›</T>
                  </Pressable>
                </View>
              )}
              <PrimaryButton label={aiBusy ? '推定中…' : '推定する'} disabled={!aiText.trim() || aiLeft === 0 || aiBusy} style={{ marginTop: 12 }} onPress={runAi} />
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
              if (!r.per100) {
                return (
                  <View key={i} style={{ paddingVertical: 12, borderTopWidth: hairline, borderTopColor: color.line }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <T size={14} w={500}>{r.token}</T>
                      <Badge>見つからず</Badge>
                    </View>
                    <T size={12} c={color.sub} style={{ marginTop: 4 }}>成分表にないため除外します。検索や手入力から追加できます。</T>
                  </View>
                );
              }
              const x = scale(r.per100, r.grams!);
              const setGrams = (g: number) => setAiRows((rows) => rows!.map((z, j) => (j === i ? { ...z, grams: Math.max(1, g) } : z)));
              return (
                <View key={i} style={{ paddingVertical: 10, borderTopWidth: hairline, borderTopColor: color.line, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <T size={14} w={500}>{shortName(r.name!)}</T>
                      {r.origin === 'ai' ? <Badge high>AI推定</Badge> : <Badge>成分表と照合</Badge>}
                    </View>
                    <N size={12} w={500} c={color.sub} style={{ marginTop: 2 }}>{pfcLine(x)}</N>
                  </View>
                  <NumberStepper value={r.grams!} onChange={setGrams} step={10} min={1} max={5000} size={16} width={52} unit="g" accessibilityLabel={`${r.token}のグラム`} />
                </View>
              );
            })}
          </ScrollView>
          <Hairline />
          <View style={{ paddingHorizontal: 22, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 14 }}>
              <N size={32} w={600}>{fmt(aiV.kcal)}<T size={12} c={color.sub}> kcal</T></N>
              <N size={15} w={600} c={color.P}>P{Math.round(aiV.P)}</N>
              <N size={15} w={600} c={color.F}>F{Math.round(aiV.F)}</N>
              <N size={15} w={600} c={color.C}>C{Math.round(aiV.C)}</N>
            </View>
            <T size={12} c={color.sub} style={{ marginTop: 4 }}>追加後の残り　P{Math.round(remaining.P - aiV.P)}g・F{Math.round(remaining.F - aiV.F)}g・C{Math.round(remaining.C - aiV.C)}g（目安）</T>
          </View>
          <View style={{ padding: 16, paddingBottom: 34, gap: 8 }}>
            <PrimaryButton label="この内容で追加" disabled={known.length === 0} onPress={() => finish(aiText.trim().slice(0, 18).trim(), aiItems, true)} />
            {known.some((r) => r.foodId) && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const items = known.filter((r) => r.foodId).map((r) => ({ foodId: r.foodId!, g: r.grams! }));
                  saveMealSet(aiText.trim().slice(0, 18).trim(), items, slot);
                }}
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <T size={13} w={700}>この組み合わせをマイセットに登録</T>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

/** 成分表示から手入力（パッケージの表示をそのまま入れる） */
function ManualEntry({ onBack, onAdd }: { onBack: () => void; onAdd: (f: { name: string; kcal: number; p: number; f: number; c: number }, grams: number, save: boolean) => void }) {
  const [name, setName] = useState('');
  const [base, setBase] = useState('100');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [f, setF] = useState('');
  const [c, setC] = useState('');
  const [eat, setEat] = useState('');
  const [save, setSave] = useState(true);
  const n = (s: string) => {
    const v = parseFloat(s.replace(/,/g, '.'));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const baseG = Math.max(1, n(base));
  const eatG = eat.trim() ? n(eat) : baseG;
  const per100 = { kcal: (n(kcal) / baseG) * 100, p: (n(p) / baseG) * 100, f: (n(f) / baseG) * 100, c: (n(c) / baseG) * 100 };
  const valid = name.trim().length > 0 && n(kcal) > 0 && eatG > 0;

  return (
    <View style={{ paddingTop: 8, gap: 10 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: 'center' }}>
        <T size={13} c={color.sub}>‹ 検索に戻る</T>
      </Pressable>
      <Field label="名前" value={name} onChangeText={setName} placeholder="例：コンビニのサラダチキン" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="表示の基準（g）" value={base} onChangeText={setBase} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="エネルギー kcal" value={kcal} onChangeText={setKcal} keyboardType="decimal-pad" /></View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Field label="P たんぱく質 g" value={p} onChangeText={setP} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="F 脂質 g" value={f} onChangeText={setF} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label="C 炭水化物 g" value={c} onChangeText={setC} keyboardType="decimal-pad" /></View>
      </View>
      <Field label={`食べた量（g）※空欄なら ${baseG}g`} value={eat} onChangeText={setEat} keyboardType="decimal-pad" />
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: save }} onPress={() => setSave(!save)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 1, borderColor: color.lineStrong, backgroundColor: save ? color.text : color.surface, alignItems: 'center', justifyContent: 'center' }}>
          {save && <T size={13} w={700} c={color.onText}>✓</T>}
        </View>
        <T size={13}>マイ食品に登録する</T>
      </Pressable>
      <PrimaryButton label="追加" disabled={!valid} onPress={() => onAdd({ name: name.trim(), ...per100 }, Math.round(eatG), save)} />
    </View>
  );
}
