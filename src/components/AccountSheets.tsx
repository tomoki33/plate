import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { OutlineButton, PrimaryButton, Sheet, T, color, hairline } from '@/design-system';
import { signInWithApple, type AuthResult } from '../services/supabase';
import { backupLabel } from '../store/backupRunner';
import { useStore } from '../store/store';
import { AppleButton } from './AuthButtons';

/** ログインのシート：記録をバックアップして、機種変更しても引き継げる。Apple */
export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error ?? null);
  };

  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 4 }}>
        <T size={17} w={900}>ログイン</T>
        <T size={12} c={color.sub} style={{ lineHeight: 19 }}>記録をバックアップして、機種変更しても引き継げます。</T>
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 16, gap: 10 }}>
        <AppleButton onPress={() => run(signInWithApple)} />
        {error ? <T size={12} c={color.brandText}>{error}</T> : null}
      </View>
    </Sheet>
  );
}

/** ログアウトの確認：この端末の記録は消えない。「この端末の記録も消す」を入れると、消してからログイン画面へ戻る */
export function LogoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const logout = useStore((s) => s.logout);
  const showToast = useStore((s) => s.showToast);
  const [wipe, setWipe] = useState(false);
  return (
    <Sheet visible={open} onClose={() => { setWipe(false); onClose(); }}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 6 }}>
        <T size={17} w={900}>ログアウトしますか？</T>
        <T size={13} c={color.badgeFg} style={{ lineHeight: 22 }}>
          この端末の記録は消えません。ログアウト中に記録した分はバックアップされません。{lastBackupAt ? `最後のバックアップは${backupLabel(lastBackupAt)}です。` : ''}
        </T>
      </View>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: wipe }} onPress={() => setWipe(!wipe)} style={{ marginHorizontal: 18, marginTop: 14, minHeight: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: hairline, borderBottomWidth: hairline, borderColor: color.line }}>
        <T size={14}>この端末の記録も消す</T>
        <View style={{ width: 48, height: 28, borderRadius: 14, backgroundColor: wipe ? color.text : color.off }}>
          <View style={{ position: 'absolute', top: 3, left: wipe ? 23 : 3, width: 22, height: 22, borderRadius: 11, backgroundColor: color.surface }} />
        </View>
      </Pressable>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, flexDirection: 'row', gap: 10 }}>
        <OutlineButton label="やめる" onPress={() => { setWipe(false); onClose(); }} style={{ flex: 1, height: 52 }} />
        <PrimaryButton
          label="ログアウト"
          style={{ flex: 1, height: 52 }}
          onPress={async () => {
            const w = wipe;
            setWipe(false);
            onClose();
            await logout(w);
            // ログアウトしたら、ログイン画面（11c）へ。「ログインせずに始める」で、端末の記録のまま戻れる
            router.replace('/login');
            if (!w) showToast('ログアウトしました。記録はこの端末に残っています');
          }}
        />
      </View>
    </Sheet>
  );
}

/** 設定タブで使う、ログイン／ログアウトのシート */
export function AccountSheetsHost({ sheet, onClose }: { sheet: null | 'login' | 'logout'; onClose: () => void }) {
  return (
    <>
      <LoginSheet open={sheet === 'login'} onClose={onClose} />
      <LogoutSheet open={sheet === 'logout'} onClose={onClose} />
    </>
  );
}
