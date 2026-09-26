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

/**
 * 写真をアプリの保存領域に移す（一時ファイルは消えるので）。戻り値を meal_entry.photo_uri に入れる。
 * Web（確認用）は、ファイルを持てないので data URL のまま保存する。
 */
export async function persistPhoto(photo: PickedPhoto): Promise<string | null> {
  if (photo.sample) return null;
  try {
    if (Platform.OS === 'web') return photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.uri;
    const dir = new Directory(Paths.document, 'photos');
    if (!dir.exists) dir.create();
    const dest = new File(dir, `${uuid()}.jpg`);
    new File(photo.uri).copy(dest);
    return dest.uri;
  } catch {
    return photo.uri;
  }
}
