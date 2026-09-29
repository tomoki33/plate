#!/usr/bin/env node
/**
 * coach-hub（LINE の体重・食事記録）→ PLATE への移行。
 *
 *   # 読み取りだけ（書き込まない）。件数と変換結果を表示し、変換後の JSON を --out に書く
 *   node scripts/migrate-coach-hub.mjs --client 大樹 --out /path/to/payload.json
 *
 *   # 書き込む：PLATE 側の利用者（Apple でサインイン済み）の user_id を指定する
 *   node scripts/migrate-coach-hub.mjs --client 大樹 --out ... --apply --uid <PLATE の user_id>
 *
 * 環境変数（値はコマンドに直接書かず、環境から渡す）:
 *   SRC_URL, SRC_KEY   coach-hub の Supabase の URL と service_role キー（読み取りだけに使う）
 *   DST_URL, DST_KEY   PLATE の Supabase の URL と service_role キー（--apply のときだけ使う）
 *
 * 変換:
 *   weight_logs → body_log（1日1件。同じ日は最後の記録＝訂正を採用）
 *   meal_logs   → meal_entry（1食＝1行。AI の概算 kcal・P・F・C をそのまま入れる。写真は photos/<ファイル名>）
 *   PLATE には「復元（merge）」で入る：端末の記録は消さず、足すだけ。id は固定なので、何度実行しても重複しない。
 * 運動記録（workout_logs）は自由文で種目・セットに分解できないため、対象外。
 */
/* global Buffer */
/* eslint-disable expo/no-dynamic-env-var -- Node の移行スクリプト（アプリには入らない） */
import { writeFileSync } from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (k) => process.argv.includes(`--${k}`);
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`環境変数 ${k} がありません`); process.exit(1); } return v; };

const SRC_URL = need('SRC_URL'), SRC_KEY = need('SRC_KEY');
const clientArg = arg('client');
if (!clientArg) { console.error('--client <表示名 または id> を指定してください'); process.exit(1); }

const sget = async (path) => {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(`${SRC_URL}/rest/v1/${path}`, { headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}`, Range: `${off}-${off + 999}` } });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    const d = await r.json();
    out.push(...d);
    if (d.length < 1000) return out;
  }
};

const JST = 9 * 3600_000;
const jst = (iso) => new Date(new Date(iso).getTime() + JST);
const ymd = (iso) => jst(iso).toISOString().slice(0, 10);
const hourJst = (iso) => jst(iso).getUTCHours();

/** 食事の枠：本文に「朝／昼／夜／おやつ」があればそれ、なければ時刻（JST）で決める */
function slotOf(iso, text) {
  const t = text ?? '';
  if (/間食|おやつ/.test(t)) return '間食';
  if (/朝/.test(t)) return '朝';
  if (/昼/.test(t)) return '昼';
  if (/夜|夕|晩/.test(t)) return '夜';
  const h = hourJst(iso);
  return h >= 5 && h <= 10 ? '朝' : h >= 11 && h <= 14 ? '昼' : h >= 15 && h <= 17 ? '間食' : '夜';
}

const KCAL_RE = /(\d+(?:\.\d+)?)\s*kcal/i;
const PFC_RE = /P:\s*(\d+(?:\.\d+)?)g\s*\/\s*C:\s*(\d+(?:\.\d+)?)g\s*\/\s*F:\s*(\d+(?:\.\d+)?)g/i;
const round1 = (n) => Math.round(n * 10) / 10;

/** AI の概算文（「530kcal（P:33g / C:85g / F:10g）説明」）から説明部分を取り出す */
function describe(aiText) {
  const m = (aiText ?? '').match(/[）)]\s*(.*)$/s);
  return (m ? m[1] : (aiText ?? '')).replace(/\s+/g, ' ').trim().replace(/[。.]$/, '').replace(/(です|でした|ですね)$/, '');
}
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function toEntry(m) {
  const t = m.ai_estimate_text ?? '';
  const km = t.match(KCAL_RE), pm = t.match(PFC_RE);
  const kcal = m.calories_kcal ?? (km ? Number(km[1]) : null);
  const p = m.protein_g ?? (pm ? Number(pm[1]) : null);
  const c = m.carbs_g ?? (pm ? Number(pm[2]) : null);
  const f = m.fat_g ?? (pm ? Number(pm[3]) : null);
  if (kcal == null || p == null || c == null || f == null) return { skip: m.image_storage_path ? '写真のみ（AIの概算なし）' : '概算なし' };
  const raw = (m.raw_text ?? '').replace(/\s+/g, ' ').trim();
  const name = clip(raw || describe(t) || '食事', 40);
  const at = new Date(m.created_at).getTime();
  const photoFile = m.image_storage_path ? m.image_storage_path.split('/').pop() : null;
  return {
    entry: {
      id: `mig_meal_${m.id}`,
      updatedAt: at,
      deletedAt: null,
      date: ymd(m.created_at),
      slot: slotOf(m.created_at, raw),
      foodId: null,
      groupId: `mig_grp_${m.id}`,
      groupName: name,
      name,
      grams: null,
      kcal: Math.round(kcal),
      p: round1(p),
      f: round1(f),
      c: round1(c),
      ai: true,
      photoUri: photoFile ? `photos/${photoFile}` : null,
      inputType: photoFile ? 'photo' : 'text',
      createdAt: at,
    },
    photo: m.image_storage_path ?? null,
    photoFile,
  };
}

// ---- 読み取り ----
const clients = await sget('clients?select=id,display_name');
const client = clients.find((c) => c.id === clientArg || c.id.startsWith(clientArg) || c.display_name === clientArg);
if (!client) { console.error('該当する利用者がいません:', clients.map((c) => `${c.display_name ?? '(名前なし)'}(${c.id.slice(0, 8)})`).join(', ')); process.exit(1); }
const [weights, meals] = await Promise.all([
  sget(`weight_logs?client_id=eq.${client.id}&select=*&order=recorded_at`),
  sget(`meal_logs?client_id=eq.${client.id}&select=*&order=created_at`),
]);

// 体重：1日1件（最後の記録）
const byDay = new Map();
for (const w of weights) byDay.set(ymd(w.recorded_at), w);
const bodyLog = [...byDay.entries()].map(([date, w]) => ({
  id: `mig_body_${w.id}`, updatedAt: new Date(w.recorded_at).getTime(), deletedAt: null, date, weightKg: Number(w.weight_kg), bodyFatPct: null, source: 'manual',
}));

// 食事
const entries = [], photos = [], skipped = [];
for (const m of meals) {
  const r = toEntry(m);
  if (r.skip) { skipped.push({ id: m.id, at: m.created_at, why: r.skip, photo: !!m.image_storage_path }); continue; }
  entries.push(r.entry);
  if (r.photo) photos.push({ path: r.photo, file: r.photoFile });
}

const payload = { version: 1, createdAt: Date.now(), mode: 'merge', tables: { body_log: bodyLog, meal_entry: entries } };

// ---- レポート ----
const days = (xs) => new Set(xs.map((x) => x.date)).size;
console.log(`利用者: ${client.display_name ?? '(名前なし)'} (${client.id})`);
console.log(`体重: 記録 ${weights.length}件 → ${bodyLog.length}件（1日1件）  期間 ${bodyLog[0]?.date} 〜 ${bodyLog.at(-1)?.date}`);
console.log(`食事: ${meals.length}件 → 取り込む ${entries.length}件 / 取り込まない ${skipped.length}件  （${days(entries)}日分）`);
console.log(`写真: ${photos.length}枚`);
const cnt = (k) => entries.reduce((a, e) => ((a[e[k]] = (a[e[k]] ?? 0) + 1), a), {});
console.log('枠の内訳:', JSON.stringify(cnt('slot')), ' 入力方法:', JSON.stringify(cnt('inputType')));
for (const s of skipped) console.log(`  取り込まない: ${s.at.slice(0, 16)} ${s.why}`);
console.log('--- 食事の変換サンプル（先頭・中ほど・末尾） ---');
for (const e of [entries[0], entries[Math.floor(entries.length / 2)], entries.at(-1)].filter(Boolean)) console.log(`${e.date} ${e.slot} ${e.name} | ${e.kcal}kcal P${e.p} F${e.f} C${e.c} ${e.photoUri ?? '(写真なし)'}`);
const out = arg('out');
if (out) { writeFileSync(out, JSON.stringify(payload)); console.log(`変換後のデータを書きました: ${out}`); }

// ---- 書き込み ----
if (!has('apply')) { console.log('\n(読み取りのみ。書き込むには --apply --uid <PLATE の user_id>)'); process.exit(0); }
const uid = arg('uid');
if (!uid || !/^[0-9a-f-]{36}$/.test(uid)) { console.error('--uid に PLATE の user_id を指定してください'); process.exit(1); }
const DST_URL = need('DST_URL'), DST_KEY = need('DST_KEY');
const dh = { apikey: DST_KEY, Authorization: `Bearer ${DST_KEY}` };

// 写真：<uid>/<ファイル名> に上げる（アプリの復元が、この場所から取り出す）
let up = 0, dup = 0;
for (const ph of photos) {
  const src = await fetch(`${SRC_URL}/storage/v1/object/meal-photos/${ph.path}`, { headers: { apikey: SRC_KEY, Authorization: `Bearer ${SRC_KEY}` } });
  if (!src.ok) { console.error(`写真を取得できません: ${ph.path} (${src.status})`); process.exit(1); }
  const body = Buffer.from(await src.arrayBuffer());
  const put = await fetch(`${DST_URL}/storage/v1/object/plate-meal-photos/${uid}/${ph.file}`, { method: 'POST', headers: { ...dh, 'Content-Type': 'image/jpeg' }, body });
  if (put.ok) up++;
  else if (put.status === 400 || put.status === 409) dup++; // 既に上がっている
  else { console.error(`写真のアップロードに失敗: ${ph.file} ${put.status} ${await put.text()}`); process.exit(1); }
}
console.log(`写真: アップロード ${up}枚 / 既にあった ${dup}枚`);

// 記録：backups に置く（PLATE の「バックアップから復元する」で、端末に足される）
const res = await fetch(`${DST_URL}/rest/v1/backups?on_conflict=user_id`, {
  method: 'POST',
  headers: { ...dh, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
  body: JSON.stringify({ user_id: uid, payload, updated_at: new Date().toISOString() }),
});
if (!res.ok) { console.error('backups への書き込みに失敗:', res.status, await res.text()); process.exit(1); }
console.log('backups に書きました。PLATE で「バックアップから復元する」を押すと入ります。');
