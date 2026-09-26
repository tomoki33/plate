import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { db } from '../db/client';
import * as s from '../db/schema';
import { isNull } from 'drizzle-orm';
import { toCsv } from '../domain/csv';

/** 記録をCSVで書き出す（体重・食事・トレ）。無料でも使える。 */
export async function buildCsvFiles(): Promise<{ name: string; csv: string }[]> {
  const body = await db.select().from(s.bodyLog).where(isNull(s.bodyLog.deletedAt)).orderBy(s.bodyLog.date);
  const meals = await db.select().from(s.mealEntry).where(isNull(s.mealEntry.deletedAt)).orderBy(s.mealEntry.createdAt);
  const sessions = await db.select().from(s.workoutSession).where(isNull(s.workoutSession.deletedAt)).orderBy(s.workoutSession.startedAt);
  const sets = await db.select().from(s.workoutSet).where(isNull(s.workoutSet.deletedAt)).orderBy(s.workoutSet.order);
  const exercises = new Map((await db.select().from(s.exercise)).map((e) => [e.id, e.name]));
  const sessionById = new Map(sessions.map((x) => [x.id, x]));

  return [
    { name: 'plate_body.csv', csv: toCsv(['日付', '体重kg', '体脂肪%', '出所'], body.map((b) => [b.date, b.weightKg, b.bodyFatPct ?? '', b.source === 'healthkit' ? 'ヘルスケア' : '手入力'])) },
    {
      name: 'plate_meals.csv',
      csv: toCsv(['日付', '時間帯', 'まとまり', '食品', 'g', 'kcal', 'P', 'F', 'C', '入力方法', 'AI推定'], meals.map((m) => [m.date, m.slot, m.groupName, m.name, m.grams ?? '', m.kcal, m.p, m.f, m.c, { set: 'マイセット', search: '検索', text: '文章', photo: '写真' }[m.inputType] ?? '', m.ai ? 'はい' : ''])),
    },
    {
      name: 'plate_workouts.csv',
      csv: toCsv(
        ['日付', 'メニュー', '種目', 'kg', '回', 'RIR', '順番'],
        sets.map((st) => {
          const ses = sessionById.get(st.sessionId);
          return [ses?.date ?? '', ses?.name ?? '', exercises.get(st.exerciseId) ?? '', st.weightKg, st.reps, st.rir ?? '', st.order + 1];
        }),
      ),
    },
  ];
}

/** ファイルに書いて共有シートを開く。Web は最初の1ファイルをブラウザで保存する */
export async function shareCsv(): Promise<{ ok: boolean; error?: string }> {
  try {
    const files = await buildCsvFiles();
    if (Platform.OS === 'web') {
      for (const f of files) {
        const url = URL.createObjectURL(new Blob(['﻿' + f.csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      }
      return { ok: true };
    }
    if (!(await Sharing.isAvailableAsync())) return { ok: false, error: 'この端末では共有できません' };
    for (const f of files) {
      const file = new File(Paths.cache, f.name);
      if (file.exists) file.delete();
      file.create();
      file.write('﻿' + f.csv); // Excelで文字化けしないようBOMを付ける
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: f.name, UTI: 'public.comma-separated-values-text' });
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
