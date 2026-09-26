import * as repo from '../db/repo';
import { addDays, dateKey, weekdayIndex } from '../domain/dates';
import type { ExerciseLog, MealEntry, SessionRecord } from '../domain/models';
import { bestSet, volumeScore } from '../domain/training';
import { uuid } from '../lib/id';
import { useStore } from '../store/store';

/**
 * 開発用：直近5週間分のサンプル（体重・食事・トレ）を入れて、レビューやTDEE補正を確かめる。
 * __DEV__ のときだけ「データ」画面に出る。
 */
export async function insertSampleData(now = new Date()): Promise<void> {
  const { exercises } = useStore.getState();
  const ex = (name: string) => exercises.find((e) => e.name === name)!;
  // 月=胸・肩、水=脚、金=背中、土=腕・腹（初期の週間スケジュールに合わせる）
  const plan: Record<number, { name: string; lifts: [string, number][] }> = {
    0: { name: '胸・肩', lifts: [['ベンチプレス', 60], ['ショルダープレス', 20]] },
    2: { name: '脚の日', lifts: [['スクワット', 80], ['レッグカール', 35]] },
    4: { name: '背中', lifts: [['デッドリフト', 100], ['ベントオーバーロウ', 50]] },
    5: { name: '腕・腹', lifts: [['バーベルカール', 30], ['トライセプスプッシュダウン', 30]] },
  };

  const days = 35;
  for (let i = days; i >= 1; i--) {
    const d = addDays(now, -i);
    const date = dateKey(d);
    const wd = weekdayIndex(d);
    const progress = (days - i) / days;

    // 体重：ゆるやかに減る＋日ごとのゆらぎ
    const kg = Math.round((72 - 1.2 * progress + Math.sin(i * 1.7) * 0.25) * 10) / 10;
    await repo.saveBodyLog(uuid(), date, kg, 'manual', null);

    // 食事：朝・昼・夜の3まとまり（約2,050kcal ± 150）
    const jitter = Math.round(Math.sin(i * 2.3) * 150);
    const mk = (slot: MealEntry['slot'], name: string, kcal: number, P: number, F: number, C: number, t: number): MealEntry => ({
      id: uuid(), date, slot, foodId: null, groupId: uuid(), groupName: name, name, grams: null, kcal, P, F, C, ai: false, createdAt: d.getTime() + t,
    });
    await repo.insertMeals([
      mk('朝', '納豆ごはん＋卵', 520, 28, 16, 66, 1),
      mk('昼', '鶏むね200g・米250g', 750 + jitter, 60, 8, 100, 2),
      mk('夜', 'ささみ＋さつまいも', 780, 55, 14, 95, 3),
    ]);

    // トレ
    const p = plan[wd];
    if (p) {
      const logs: ExerciseLog[] = p.lifts.map(([name, base]) => {
        const e = ex(name);
        const kgw = base + Math.round(progress * 10 / 2.5) * 2.5;
        return { exerciseId: e.id, name: e.name, part: e.part, coef: e.coef, prevKg: kgw, prevReps: 6, sets: [0, 1, 2].map(() => ({ kg: kgw, reps: 6, done: true })) };
      });
      const rec: SessionRecord = {
        id: uuid(), date, templateId: null, name: p.name, startedAt: d.getTime(), endedAt: d.getTime() + 3600_000,
        volume: volumeScore(logs), dayType: p.name === '脚の日' ? 'high' : 'normal', doneSets: 6, best: bestSet(logs), exercises: logs,
      };
      await repo.saveSession(rec, logs.flatMap((l) => l.sets.map(() => uuid())));
    }
  }
  await useStore.getState().reload();
}
