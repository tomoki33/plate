import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { uuid } from '../lib/id';

/** 撮った（選んだ）写真。base64 は、AIに送るために縮めたもの */
export interface PickedPhoto {
  uri: string;
  base64?: string;
  /** 開発用のサンプル写真（実際の画像はない） */
  sample?: boolean;
}

export interface PickResult {
  photo: PickedPhoto | null;
  /** 許可がない・開けないときに、画面に出す文 */
  error?: string;
}

const OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.5, base64: true, allowsEditing: false, exif: false };

/** カメラで撮る／ライブラリから選ぶ。キャンセルは photo: null（エラーではない） */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickResult> {
  try {
    if (source === 'camera') {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return { photo: null, error: 'カメラの許可がありません。端末の設定から許可してください。' };
      }
      const r = await ImagePicker.launchCameraAsync(OPTIONS);
      return toResult(r);
    }
    const r = await ImagePicker.launchImageLibraryAsync(OPTIONS);
    return toResult(r);
  } catch (e) {
    return { photo: null, error: e instanceof Error ? e.message : '写真を開けませんでした。' };
  }
}

function toResult(r: ImagePicker.ImagePickerResult): PickResult {
  if (r.canceled || !r.assets?.length) return { photo: null };
  const a = r.assets[0];
  return { photo: { uri: a.uri, base64: a.base64 ?? undefined } };
}

export const PHOTO_DIR = 'photos';

/** meal_entry.photo_uri（相対パス／古い形式の絶対パス／Web の data URL）を、表示できる URI にする */
export function resolvePhotoUri(stored: string): string {
  if (Platform.OS === 'web' || !stored.startsWith(`${PHOTO_DIR}/`)) return stored;
  return new File(Paths.document, stored).uri;
}

/** 端末にある写真のファイル名（バックアップの対象）。相対パス以外は対象外 */
export const photoFileName = (stored: string | null): string | null => (stored && stored.startsWith(`${PHOTO_DIR}/`) ? stored.slice(PHOTO_DIR.length + 1) : null);

/**
 * 写真をアプリの保存領域に移す（一時ファイルは消えるので）。戻り値を meal_entry.photo_uri に入れる。
 * Web（確認用）は、ファイルを持てないので data URL のまま保存する。
 */
export async function persistPhoto(photo: PickedPhoto): Promise<string | null> {
  if (photo.sample) return null;
  try {
    if (Platform.OS === 'web') return photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
    const dir = new Directory(Paths.document, PHOTO_DIR);
    if (!dir.exists) dir.create();
    const name = `${uuid()}.jpg`;
    new File(photo.uri).copy(new File(dir, name));
    // 相対パスで持つ（iOS はアプリの保存先のパスが、更新や復元で変わることがあるため）
    return `${PHOTO_DIR}/${name}`;
  } catch {
    return photo.uri;
  }
}

/** 端末の写真ファイルをすべて消す（「すべての記録を削除」用） */
export function removeAllPhotos(): void {
  if (Platform.OS === 'web') return;
  try {
    const dir = new Directory(Paths.document, PHOTO_DIR);
    if (dir.exists) dir.delete();
  } catch {
    /* 消せなくても、記録の削除は続ける */
  }
}
