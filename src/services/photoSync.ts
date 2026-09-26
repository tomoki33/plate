import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { db } from '../db/client';
import * as s from '../db/schema';
import { PHOTO_DIR, photoFileName } from './photos';
import { supabase } from './supabase';

/**
 * 食事の写真のバックアップ（Supabase Storage の非公開バケット meal-photos、パスは <user_id>/<ファイル名>）。
 * 写真は端末に置いたまま、無いものだけ足す（すでに上げたものは、もう一度上げない）。
 * Web（確認用）は data URL で持つので対象外。
 */
const BUCKET = 'meal-photos';

async function remoteNames(uid: string): Promise<Set<string>> {
  const c = supabase()!;
  const names = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await c.storage.from(BUCKET).list(uid, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    for (const o of data ?? []) names.add(o.name);
    if (!data || data.length < 1000) break;
  }
  return names;
}

async function localPhotoNames(): Promise<string[]> {
  const rows = await db.select({ u: s.mealEntry.photoUri }).from(s.mealEntry);
  return [...new Set(rows.map((r) => photoFileName(r.u)).filter((n): n is string => !!n))];
}

/** 端末にあって、クラウドにない写真を上げる。戻り値は上げた枚数 */
export async function uploadPhotos(uid: string): Promise<number> {
  const c = supabase();
  if (!c || Platform.OS === 'web') return 0;
  const [local, remote] = await Promise.all([localPhotoNames(), remoteNames(uid)]);
  let n = 0;
  for (const name of local) {
    if (remote.has(name)) continue;
    const f = new File(Paths.document, PHOTO_DIR, name);
    if (!f.exists) continue;
    const { error } = await c.storage.from(BUCKET).upload(`${uid}/${name}`, await f.arrayBuffer(), { contentType: 'image/jpeg', upsert: false });
    if (error && !/exists|Duplicate/i.test(error.message)) throw new Error(error.message);
    n++;
  }
  return n;
}

/** 復元のあと、端末にない写真をクラウドから戻す。戻り値は戻した枚数 */
export async function downloadPhotos(uid: string): Promise<number> {
  const c = supabase();
  if (!c || Platform.OS === 'web') return 0;
  const dir = new Directory(Paths.document, PHOTO_DIR);
  if (!dir.exists) dir.create();
  let n = 0;
  for (const name of await localPhotoNames()) {
    const dest = new File(dir, name);
    if (dest.exists) continue;
    const { data, error } = await c.storage.from(BUCKET).download(`${uid}/${name}`);
    if (error || !data) continue;
    dest.create();
    dest.write(new Uint8Array(await new Response(data).arrayBuffer()));
    n++;
  }
  return n;
}
