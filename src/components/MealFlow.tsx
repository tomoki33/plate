import { useRouter } from 'expo-router';
import { FREE_LAUNCH } from '../lib/flags';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Badge, Field, N, Notice, PrimaryButton, Segmented, Sheet, StepBox, T, color, font, hairline, radius } from '@/design-system';
import { getFoodsByIds, searchFoodsDb } from '../db/repo';
import { SLOT_LABEL, shortName } from '../domain/foodSearch';
import type { FoodItem, MealSet, Slot } from '../domain/models';
import type { Pfc } from '../domain/types';
import { estimateMeal, type EstimateRow } from '../services/ai';
import { persistPhoto, pickPhoto, type PickedPhoto } from '../services/photos';
import { accessToken } from '../services/supabase';
import { useStore, type MealItemInput } from '../store/store';
import { CameraIcon, PhotoIcon } from './AuthIcons';

/** 0 マイセット / 1 検索 / 2 AI / 3 ざっくり（表示の順は マイセット・検索・ざっくり・AI） */
type Mode = 0 | 1 | 2 | 3;

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
  /** 添付した写真（今日タブのカメラボタンで撮ったものも、ここに入る） */
  photo: PickedPhoto | null;
  onPhoto: (p: PickedPhoto | null) => void;
}

const fmt = (n: number) => Math.round(n).toLocaleString();
const r1 = (n: number) => Math.round(n * 10) / 10;
const pfcLine = (v: Pfc) => `P${Math.round(v.P)} F${Math.round(v.F)} C${Math.round(v.C)}・${Math.round(v.kcal)}kcal`;
const scale = (per: { kcal: number; p: number; f: number; c: number }, g: number): Pfc => ({ kcal: Math.round((per.kcal * g) / 100), P: r1((per.p * g) / 100), F: r1((per.f * g) / 100), C: r1((per.c * g) / 100) });
const foodInput = (f: FoodItem, g: number): MealItemInput => ({ foodId: f.id, name: shortName(f.name), grams: g, ...scale(f, g) });

/** 写真のサムネイル（サンプルは縞の代わりの色面） */
export function PhotoThumb({ photo, size, radiusPx = 4 }: { photo: PickedPhoto | { uri: string; sample?: boolean }; size: number; radiusPx?: number }) {
  if ('sample' in photo && photo.sample) {
    return (
      <View style={{ width: size, height: size, borderRadius: radiusPx, backgroundColor: color.off, alignItems: 'center', justifyContent: 'center' }}>
        {size >= 56 ? <T size={size >= 72 ? 10 : 9} c={color.badgeFg}>サンプル</T> : null}
      </View>
    );
  }
  return <Image source={{ uri: photo.uri }} style={{ width: size, height: size, borderRadius: radiusPx, backgroundColor: color.off }} />;
}

export function MealFlow({ open, initialMode, onClose, remaining, todayKey, date, dateLabel, slot: slotProp, postWorkout, aiLimit, photo, onPhoto }: Props) {
  const router = useRouter();
  const addMealItems = useStore((s) => s.addMealItems);
  const addFromMealSet = useStore((s) => s.addFromMealSet);
  const saveMealSet = useStore((s) => s.saveMealSet);
  const saveMyFood = useStore((s) => s.saveMyFood);
  const consumeAi = useStore((s) => s.consumeAi);
  const mealSets = useStore((s) => s.mealSets);
  const allMeals = useStore((s) => s.meals);
  const aiUsed = useStore((s) => s.aiUsed[todayKey] ?? 0);

  const [mode, setMode] = useState<Mode>(initialMode);
  // ざっくり：時間帯（初期値は次の時間帯）・kcal・Pの量（少なめ15%／普通25%／多め35%）
  const [rough, setRough] = useState<{ slot: Slot | null; kcal: number; p: 0 | 1 | 2 }>({ slot: null, kcal: 600, p: 1 });
  const [slot, setSlot] = useState<Slot>(slotProp);
  const [slotOpen, setSlotOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodItem[]>([]);
  const [gram, setGram] = useState<{ food: FoodItem; g: number } | null>(null);
  const [manual, setManual] = useState(false);
  const [setFoods, setSetFoods] = useState<Record<string, FoodItem>>({});
  const [aiText, setAiText] = useState('');
  const [aiRows, setAiRows] = useState<EstimateRow[] | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNeedsLogin, setAiNeedsLogin] = useState(false);
  const [quote, setQuote] = useState('');
  // 確認画面で、食品を追加（add）・差し替え（replace）するときの選択画面
  const [picker, setPicker] = useState<null | { mode: 'add' } | { mode: 'replace'; index: number }>(null);
  const [pickQuery, setPickQuery] = useState('');
  const [pickResults, setPickResults] = useState<FoodItem[]>([]);
  const aiLeft = Math.max(0, aiLimit - aiUsed);
  const reqId = useRef(0);

  useEffect(() => {
    if (open) {
      setSlot(slotProp);
      setSlotOpen(false);
      setMode(initialMode);
      setRough((r) => ({ ...r, slot: null }));
      setGram(null);
      setManual(false);
      setQuery('');
      setAiError(null);
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

  // 確認画面の食品選び（入力が止まってから検索）
  useEffect(() => {
    if (!picker) return;
    const id = ++reqId.current;
    const t = setTimeout(() => {
      searchFoodsDb(pickQuery).then((r) => {
        if (id === reqId.current) setPickResults(r);
      });
    }, 120);
    return () => clearTimeout(t);
  }, [picker, pickQuery]);

  const pickFood = (f: FoodItem) => {
    const per100 = { kcal: f.kcal, p: f.p, f: f.f, c: f.c };
    if (picker?.mode === 'replace') {
      const i = picker.index;
      // 量はそのまま引き継ぐ（見つからなかった行は、その食品のいつもの量）
      setAiRows((rows) => rows!.map((r, j) => (j === i ? { token: r.token, name: f.name, grams: r.grams ?? f.defaultG ?? 100, per100, foodId: f.id, origin: 'manual' } : r)));
    } else {
      setAiRows((rows) => [...(rows ?? []), { token: f.name, name: f.name, grams: f.defaultG ?? 100, per100, foodId: f.id, origin: 'manual' }]);
    }
    setPicker(null);
    setPickQuery('');
  };

  // マイセットの中身（食品）を読む
  useEffect(() => {
    if (!open) return;
    const ids = [...new Set(mealSets.flatMap((m) => m.items.map((i) => i.foodId)))];
    getFoodsByIds(ids).then((fs) => setSetFoods(Object.fromEntries(fs.map((f) => [f.id, f]))));
  }, [open, mealSets]);

  const finish = (name: string, items: MealItemInput[], opts: { ai?: boolean; inputType?: 'search' | 'text' | 'photo' | 'rough'; photoUri?: string | null; slot?: Slot } = {}) => {
    addMealItems(name, items, { date, slot, ...opts });
    setGram(null);
    setAiRows(null);
    setManual(false);
    onPhoto(null);
    setAiText('');
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
  const setG = (g: number) => setGram((x) => (x ? { ...x, g: Math.max(10, g) } : x));

  const known = (aiRows ?? []).filter((r) => r.per100);
  const aiItems: MealItemInput[] = known.map((r) => ({ foodId: r.foodId ?? null, name: shortName(r.name!), grams: r.grams!, ...scale(r.per100!, r.grams!) }));
  const aiV = aiItems.reduce<Pfc>((a, i) => ({ kcal: a.kcal + i.kcal, P: a.P + i.P, F: a.F + i.F, C: a.C + i.C }), { kcal: 0, P: 0, F: 0, C: 0 });

  const take = async (source: 'camera' | 'library') => {
    const r = await pickPhoto(source);
    if (r.error) setAiError(r.error);
    else if (r.photo) {
      setAiError(null);
      onPhoto(r.photo);
    }
  };

  const runAi = async () => {
    if (!photo && !aiText.trim()) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await estimateMeal({ text: aiText, photo }, accessToken);
      setAiNeedsLogin(!!res.needsLogin);
      if (res.error) setAiError(res.error);
      else {
        // 推定できたときだけ、今日の回数を使う（失敗や、ログイン待ちでは減らさない）
        consumeAi(todayKey);
        setQuote(aiText.trim() ? `「${aiText.trim()}」` : '写真のみ');
        setAiRows(res.rows);
      }
    } finally {
      setAiBusy(false);
    }
  };

  const addAi = async () => {
    const savedUri = photo ? await persistPhoto(photo) : null;
    const name = photo || !aiText.trim() ? known.map((r) => shortName(r.name!).split(' ')[0]).join('・').slice(0, 18) : aiText.trim().slice(0, 18).trim();
    finish(name, aiItems, { ai: true, inputType: photo ? 'photo' : 'text', photoUri: savedUri });
  };

  const modeOptions: { value: Mode; label: string }[] = [
    { value: 0, label: 'マイセット' },
    { value: 1, label: '検索' },
    { value: 3, label: 'ざっくり' },
    { value: 2, label: 'AI' },
  ];

  // ざっくり：次の時間帯＝まだ記録していない、朝 → 昼 → 夜
  const has = (sl: Slot) => allMeals.some((m) => m.date === date && m.slot === sl);
  const nextSlot: Slot = !has('朝') ? '朝' : !has('昼') ? '昼' : '夜';
  const rSlot: Slot = rough.slot ?? nextSlot;
  const rP = Math.round((rough.kcal * [0.15, 0.25, 0.35][rough.p]) / 4);
  const rF = Math.round((rough.kcal * 0.25) / 9);
  const rC = Math.max(0, Math.round((rough.kcal - rP * 4 - rF * 9) / 4));

  return (
    <>
      <Sheet visible={open && !aiRows} onClose={onClose}>
        <View style={{ paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T size={17} w={900} numberOfLines={1} style={{ flexShrink: 1 }}>{dateLabel ? `${dateLabel} ` : ''}食事を追加</T>
          <T size={12} c={color.sub} style={{ marginLeft: 8 }}>あと P{Math.round(remaining.P)} F{Math.round(remaining.F)} C{Math.round(remaining.C)}</T>
        </View>
        {mode !== 3 && (
          <Pressable accessibilityRole="button" accessibilityLabel="時間帯を変える" onPress={() => setSlotOpen(!slotOpen)} style={{ marginHorizontal: 18, minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' }}>
            <T size={12} c={color.sub}>{SLOT_LABEL[slot]}に入れる <T size={12} c={color.sub}>{slotOpen ? '˄' : '˅'}</T></T>
          </Pressable>
        )}
        {slotOpen && mode !== 3 && (
          <View style={{ marginHorizontal: 18, marginTop: 8 }}>
            <Segmented value={slot} onChange={(s: Slot) => { setSlot(s); setSlotOpen(false); }} options={(['朝', '昼', '間食', '夜'] as Slot[]).map((v) => ({ value: v, label: v }))} />
          </View>
        )}
        <View style={{ marginHorizontal: 18, marginTop: 14 }}>
          <Segmented
            value={mode}
            onChange={(m) => {
              setMode(m);
              setGram(null);
              setManual(false);
            }}
            options={modeOptions}
          />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
          {mode === 0 && (
            <View>
              <T size={11} c={color.sub} style={{ paddingHorizontal: 18, paddingTop: 14 }}>{postWorkout ? 'トレーニング後によく使う順' : '最近使った順'}</T>
              <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
                {sets.length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 12 }}>マイセットはまだありません。文章入力の確認画面から登録できます。</T>}
                {sets.map((m) => (
                  <Pressable key={m.id} accessibilityRole="button" onPress={() => { addFromMealSet(m, Object.values(setFoods), { date, slot }); onClose(); }} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 58, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T size={14} w={500}>{m.name}</T>
                        {m.slotHint === hint && <Badge>{m.slotHint === 'トレ後' ? 'トレーニング後' : m.slotHint}</Badge>}
                      </View>
                      <N size={11} w={500} c={color.sub} style={{ marginTop: 2 }}>{pfcLine(setPfc(m))}</N>
                    </View>
                    <View style={{ width: 44, height: 44, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                      <T size={18}>＋</T>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {mode === 1 && !gram && !manual && (
            <View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="食品名で検索（例：さば、卵）"
                placeholderTextColor={color.faint}
                style={{ marginHorizontal: 18, marginTop: 14, height: 46, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, backgroundColor: color.surface, paddingHorizontal: 12, fontFamily: font.jp, fontSize: 15, color: color.text }}
              />
              <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
                {!query.trim() && <T size={11} c={color.sub} style={{ paddingVertical: 6 }}>マイ食品とよく使う食品</T>}
                {results.length === 0 && query.trim() !== '' && <T size={13} c={color.sub} style={{ paddingVertical: 12 }}>見つかりませんでした。</T>}
                {results.map((f) => (
                  <Pressable key={f.id} accessibilityRole="button" onPress={() => setGram({ food: f, g: f.defaultG ?? 100 })} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 54, borderBottomWidth: hairline, borderBottomColor: color.line, gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <T size={14}>{shortName(f.name)}</T>
                      <N size={11} w={500} c={color.sub}>100gあたり P{f.p} F{f.f} C{f.c}・{f.kcal}kcal</N>
                    </View>
                    <T size={11} c={color.sub}>{f.source === '自作' ? 'マイ食品' : '成分表'}</T>
                  </Pressable>
                ))}
                <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={{ minHeight: 48, justifyContent: 'center' }}>
                  <T size={13} w={700}>見つからない？ 成分表示から手入力</T>
                </Pressable>
                <T size={11} c={color.sub} style={{ paddingTop: 2 }}>出典：日本食品標準成分表（八訂）</T>
              </View>
            </View>
          )}

          {mode === 1 && gram && gramV && (
            <View>
              <View style={{ paddingHorizontal: 18, paddingTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T size={16} w={700} style={{ flex: 1 }}>{shortName(gram.food.name)}</T>
                <Pressable accessibilityRole="button" onPress={() => setGram(null)} style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 12 }}>
                  <T size={12} c={color.sub}>戻る</T>
                </Pressable>
              </View>
              <View style={{ marginHorizontal: 18, marginTop: 4 }}>
                <StepBox value={String(gram.g)} unit="g" onDown={() => setG(gram.g - 10)} onUp={() => setG(gram.g + 10)} height={64} buttonWidth={56} size={34} label="グラム" />
              </View>
              <View style={{ paddingHorizontal: 18, paddingTop: 10, flexDirection: 'row', gap: 8 }}>
                {[50, 100, 150, 200].map((g) => (
                  <Pressable key={g} accessibilityRole="button" onPress={() => setG(g)} style={{ flex: 1, height: 40, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                    <N size={15} w={600}>{g}g</N>
                  </Pressable>
                ))}
              </View>
              <N size={13} w={500} c={color.badgeFg} style={{ paddingHorizontal: 18, paddingTop: 12 }}>
                {pfcLine(gramV)}　→ 追加後の残り P{Math.round(remaining.P - gramV.P)}g・C{Math.round(remaining.C - gramV.C)}g
              </N>
              <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
                <PrimaryButton label="追加" onPress={() => finish(`${shortName(gram.food.name)} ${gram.g}g`, [foodInput(gram.food, gram.g)])} />
              </View>
            </View>
          )}

          {mode === 1 && manual && (
            <View style={{ paddingHorizontal: 18 }}>
              <ManualEntry
                onBack={() => setManual(false)}
                onAdd={(f, g, save) => {
                  const id = save ? saveMyFood({ name: f.name, kcal: f.kcal, p: f.p, f: f.f, c: f.c, defaultG: g }) : null;
                  finish(`${f.name} ${g}g`, [{ foodId: id, name: f.name, grams: g, ...scale(f, g) }]);
                }}
              />
            </View>
          )}

          {mode === 3 && (
            <View>
              <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 6 }}>
                {(['朝', '昼', '夜', '間食'] as Slot[]).map((sl) => (
                  <Pressable key={sl} accessibilityRole="button" onPress={() => setRough((r) => ({ ...r, slot: sl }))} style={{ flex: 1, height: 44, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center', backgroundColor: rSlot === sl ? color.text : color.surface }}>
                    <T size={14} c={rSlot === sl ? color.onText : color.text}>{sl}</T>
                  </Pressable>
                ))}
              </View>
              <View style={{ marginHorizontal: 18, marginTop: 12 }}>
                <StepBox value={fmt(rough.kcal)} unit="kcal" onDown={() => setRough((r) => ({ ...r, kcal: Math.max(100, r.kcal - 100) }))} onUp={() => setRough((r) => ({ ...r, kcal: r.kcal + 100 }))} height={76} buttonWidth={64} size={40} radiusPx={10} label="kcal" />
              </View>
              <View style={{ marginHorizontal: 18, marginTop: 8, flexDirection: 'row', gap: 6 }}>
                {[300, 500, 700, 1000].map((k) => (
                  <Pressable key={k} accessibilityRole="button" onPress={() => setRough((r) => ({ ...r, kcal: k }))} style={{ flex: 1, height: 40, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
                    <N size={15} w={600}>{fmt(k)}</N>
                  </Pressable>
                ))}
              </View>
              <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <T size={13} c={color.sub}>P</T>
                <View style={{ flex: 1 }}>
                  <Segmented value={rough.p} onChange={(v) => setRough((r) => ({ ...r, p: v }))} options={[{ value: 0 as const, label: '少なめ' }, { value: 1 as const, label: '普通' }, { value: 2 as const, label: '多め' }]} />
                </View>
              </View>
              <T size={12} c={color.sub} style={{ paddingHorizontal: 18, paddingTop: 10 }}>{rSlot}に P{rP} F{rF} C{rC} として記録</T>
              <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
                <PrimaryButton label="追加" style={{ borderRadius: 10 }} onPress={() => finish('ざっくり', [{ foodId: null, name: 'ざっくり', grams: null, kcal: rough.kcal, P: rP, F: rF, C: rC }], { inputType: 'rough', slot: rSlot })} />
              </View>
            </View>
          )}

          {mode === 2 && (
            <View>
              {!photo ? (
                <View>
                  <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 8 }}>
                    <Pressable accessibilityRole="button" onPress={() => take('camera')} style={{ flex: 1, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <CameraIcon size={20} />
                      <T size={14} w={500}>撮影</T>
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => take('library')} style={{ flex: 1, height: 52, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, backgroundColor: color.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <PhotoIcon size={20} />
                      <T size={14} w={500}>写真を選ぶ</T>
                    </Pressable>
                  </View>
                  {__DEV__ && (
                    <Pressable accessibilityRole="button" onPress={() => onPhoto({ uri: '', sample: true })} style={{ marginHorizontal: 18, height: 36, justifyContent: 'center', alignSelf: 'flex-start' }}>
                      <T size={12} c={color.badgeFg} style={{ textDecorationLine: 'underline' }}>サンプル写真で試す</T>
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={{ marginHorizontal: 18, marginTop: 14, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <PhotoThumb photo={photo} size={72} radiusPx={6} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <T size={14} w={700}>写真を添付しました</T>
                    <T size={12} c={color.sub}>ひとこと添えると精度が上がります</T>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="写真を外す" onPress={() => onPhoto(null)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <T size={16} c={color.sub}>×</T>
                  </Pressable>
                </View>
              )}
              <TextInput
                value={aiText}
                onChangeText={(v) => { setAiText(v); setAiError(null); }}
                placeholder={photo ? 'ひとこと（任意）例：米は半分残した' : '例：鶏むね200g 米150g 味噌汁'}
                placeholderTextColor={color.faint}
                multiline
                style={{ marginHorizontal: 18, marginTop: 12, height: 80, textAlignVertical: 'top', borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, backgroundColor: color.surface, padding: 12, fontFamily: font.jp, fontSize: 15, lineHeight: 24, color: color.text }}
              />
              <T size={12} c={color.sub} style={{ paddingHorizontal: 18, paddingTop: 10, lineHeight: 19 }}>
                {photo ? '写真とひとことから' : '写真を撮るか、食べたものを書くと'}PFCを推定します。追加する前に必ず確認画面が出ます。今日はあと{aiLeft}回（写真と文章の合計）。
              </T>
              {aiError && <T size={12} c={color.brandText} style={{ paddingHorizontal: 18, paddingTop: 8, lineHeight: 19 }}>{aiError}</T>}
              {aiNeedsLogin && (
                <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push('/login'); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 }}>
                  <T size={13} w={700}>ログインする ›</T>
                </Pressable>
              )}
              {aiLeft === 0 && (
                <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
                  <Notice>{FREE_LAUNCH ? '今日の回数を使い切りました。明日また使えます。食べたものは、検索でも記録できます。' : '今日の回数を使い切りました。AIプラスなら1日30回まで使えます。'}</Notice>
                  {!FREE_LAUNCH && <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push('/paywall'); }} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T size={13} w={700}>AIプラスを見る ›</T>
                  </Pressable>}
                </View>
              )}
              <View style={{ paddingHorizontal: 18, paddingTop: 16 }}>
                <PrimaryButton label={aiBusy ? '推定中…' : '推定する'} disabled={(!photo && !aiText.trim()) || aiLeft === 0 || aiBusy} onPress={runAi} />
              </View>
            </View>
          )}
        </ScrollView>
      </Sheet>

      {/* AI推定の確認（全画面）。必ずこの画面を挟む */}
      <Modal visible={open && !!aiRows} animationType="slide" onRequestClose={() => setAiRows(null)}>
        <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: 54 }}>
          <View style={{ paddingHorizontal: 20, height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Pressable accessibilityRole="button" onPress={() => setAiRows(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <T size={14} c={color.sub}>戻る</T>
            </Pressable>
            <T size={15} w={700}>推定を確認</T>
            <View style={{ width: 28 }} />
          </View>
          {/* 入力した内容（写真があれば56pxのサムネイル＋ひとこと） */}
          <View style={{ marginHorizontal: 20, marginTop: 10, padding: 10, paddingHorizontal: 12, backgroundColor: color.badgeBg, borderRadius: radius.input, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {photo && <PhotoThumb photo={photo} size={56} />}
            <T size={13} c={color.badgeFg} style={{ flex: 1, lineHeight: 20 }}>{quote}</T>
          </View>
          {photo && <T size={12} w={700} c={color.brandText} style={{ paddingHorizontal: 20, paddingTop: 8 }}>写真からの量は目安です。違っていたらgを直してください。</T>}
          <ScrollView style={{ flex: 1, marginTop: 8 }} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {(aiRows ?? []).map((r, i) => {
              const remove = () => setAiRows((rows) => rows!.filter((_, j) => j !== i));
              const actions = (canSwap: boolean) => (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable accessibilityRole="button" onPress={() => { setPickQuery(''); setPicker({ mode: 'replace', index: i }); }} style={{ minHeight: 44, justifyContent: 'center', paddingRight: 14 }}>
                    <T size={12} w={700} style={{ textDecorationLine: 'underline' }}>{canSwap ? '食品を変える' : '食品を選ぶ'}</T>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${r.name ?? r.token}を削除`} onPress={remove} style={{ minHeight: 44, justifyContent: 'center' }}>
                    <T size={12} c={color.brandText}>削除</T>
                  </Pressable>
                </View>
              );
              if (!r.per100) {
                return (
                  <View key={i} style={{ paddingTop: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <T size={14} w={500}>{r.token}</T>
                      <Tag>見つからず</Tag>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T size={11.5} c={color.sub} style={{ flex: 1 }}>カタログ・成分表にないため、いまは除外します。</T>
                      {actions(false)}
                    </View>
                  </View>
                );
              }
              const x = scale(r.per100, r.grams!);
              const setGrams = (g: number) => setAiRows((rows) => rows!.map((z, j) => (j === i ? { ...z, grams: Math.max(1, g) } : z)));
              return (
                <View key={i} style={{ paddingTop: 12, borderBottomWidth: hairline, borderBottomColor: color.line }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <T size={14} w={500}>{shortName(r.name!)}</T>
                      <Tag>{r.origin === 'manual' ? '手動で選択' : r.origin === 'estimate' ? 'AIの目安' : r.origin === 'photo' ? '写真から推定' : r.origin === 'ai' ? 'AI推定' : '成分表と照合'}</Tag>
                    </View>
                    <View style={{ width: 132 }}>
                      <StepBox value={String(r.grams)} onDown={() => setGrams(r.grams! - 10)} onUp={() => setGrams(r.grams! + 10)} height={40} buttonWidth={40} size={17} radiusPx={radius.input} label={`${r.token}の`} />
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <N size={11.5} w={500} c={color.sub}>{pfcLine(x)}</N>
                    {actions(true)}
                  </View>
                </View>
              );
            })}
            {(aiRows ?? []).length === 0 && <T size={13} c={color.sub} style={{ paddingVertical: 16 }}>読み取れた食品がありません。下から追加してください。</T>}
            <Pressable accessibilityRole="button" onPress={() => { setPickQuery(''); setPicker({ mode: 'add' }); }} style={{ marginTop: 12, marginBottom: 8, height: 48, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.button, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T size={14} w={500}>＋ 食品を追加</T>
            </Pressable>
          </ScrollView>
          {/* 合計：kcal と P/F/C */}
          <View style={{ marginHorizontal: 20, marginTop: 12, flexDirection: 'row', borderWidth: hairline, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.surface, overflow: 'hidden' }}>
            <View style={{ flex: 1.2, padding: 12, paddingVertical: 10, borderRightWidth: hairline, borderRightColor: color.line }}>
              <T size={10.5} c={color.sub}>合計 kcal</T>
              <N size={24} w={600}>{fmt(aiV.kcal)}</N>
            </View>
            {([['P', aiV.P, color.P], ['F', aiV.F, color.F], ['C', aiV.C, color.C]] as const).map(([k, v, c]) => (
              <View key={k} style={{ flex: 1, padding: 10, borderTopWidth: 3, borderTopColor: c }}>
                <T size={10.5} c={color.sub}>{k}</T>
                <N size={20} w={600}>{Math.round(v)}</N>
              </View>
            ))}
          </View>
          <T size={12} c={color.sub} style={{ paddingHorizontal: 20, paddingTop: 10 }}>
            追加後の残り　P{Math.round(remaining.P - aiV.P)}g・F{Math.round(remaining.F - aiV.F)}g・C{Math.round(remaining.C - aiV.C)}g
          </T>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 34, gap: 4 }}>
            <PrimaryButton label="この内容で追加" disabled={known.length === 0} onPress={addAi} />
            {known.some((r) => r.foodId) && !photo && (
              <Pressable accessibilityRole="button" onPress={() => saveMealSet(aiText.trim().slice(0, 18).trim() || known[0].name!, known.filter((r) => r.foodId).map((r) => ({ foodId: r.foodId!, g: r.grams! })), slot)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <T size={13} w={700}>この組み合わせをマイセットに登録</T>
              </Pressable>
            )}
          </View>
          {/* 食品を選ぶ（追加・差し替え）。確認画面の上に重ねる */}
          {picker && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.bg, paddingTop: 54 }}>
              <View style={{ paddingHorizontal: 20, height: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Pressable accessibilityRole="button" onPress={() => setPicker(null)} style={{ minHeight: 44, justifyContent: 'center' }}>
                  <T size={14} c={color.sub}>戻る</T>
                </Pressable>
                <T size={15} w={700}>{picker.mode === 'add' ? '食品を追加' : '食品を選ぶ'}</T>
                <View style={{ width: 28 }} />
              </View>
              <TextInput
                value={pickQuery}
                onChangeText={setPickQuery}
                placeholder="食品名で検索（例：さば、卵）"
                placeholderTextColor={color.faint}
                autoFocus
                style={{ marginHorizontal: 20, marginTop: 8, height: 46, borderWidth: hairline, borderColor: color.lineStrong, borderRadius: radius.input, backgroundColor: color.surface, paddingHorizontal: 12, fontFamily: font.jp, fontSize: 15, color: color.text }}
              />
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 }}>
                {!pickQuery.trim() && <T size={11} c={color.sub} style={{ paddingVertical: 8 }}>マイ食品とよく使う食品</T>}
                {pickResults.length === 0 && pickQuery.trim() !== '' && <T size={13} c={color.sub} style={{ paddingVertical: 12 }}>見つかりませんでした。</T>}
                {pickResults.map((f) => (
                  <Pressable key={f.id} accessibilityRole="button" onPress={() => pickFood(f)} style={{ minHeight: 54, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: hairline, borderBottomColor: color.line, gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <T size={14}>{shortName(f.name)}</T>
                      <N size={11} w={500} c={color.sub}>100gあたり P{f.p} F{f.f} C{f.c}・{f.kcal}kcal</N>
                    </View>
                    <T size={11} c={color.sub}>{f.source === '自作' ? 'マイ食品' : '成分表'}</T>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

/** 行のタグ（「AI推定」「写真から推定」「見つからず」）：枠だけの小さな印 */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ borderWidth: hairline, borderColor: color.lineStrong, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
      <T size={10} w={700} c={color.sub}>{children}</T>
    </View>
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
