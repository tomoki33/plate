import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { OutlineButton, PrimaryButton, Sheet, T, color } from '@/design-system';
import { signInWithApple, signInWithGoogle, signOut, type AuthResult } from '../services/supabase';
import { backupLabel } from '../store/backupRunner';
import { useStore } from '../store/store';
import { AppleButton, OutlineAuthButton } from './AuthButtons';

/** ログインのシート：記録をバックアップして、機種変更しても引き継げる。Apple／Google／メール */
export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <OutlineAuthButton label="Google" icon="google" onPress={() => run(signInWithGoogle)} />
          <OutlineAuthButton
            label="メール"
            icon="mail"
            onPress={() => {
              onClose();
              router.push({ pathname: '/login', params: { email: '1' } });
            }}
          />
        </View>
        {error ? <T size={12} c={color.brandText}>{error}</T> : null}
      </View>
    </Sheet>
  );
}

/** ログアウトの確認：この端末の記録は消えない。ログアウト中に記録した分はバックアップされない */
export function LogoutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lastBackupAt = useStore((s) => s.lastBackupAt);
  const showToast = useStore((s) => s.showToast);
  const setAccount = useStore((s) => s.setAccount);
  return (
    <Sheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, gap: 6 }}>
        <T size={17} w={900}>ログアウトしますか？</T>
        <T size={13} c={color.badgeFg} style={{ lineHeight: 22 }}>
          この端末の記録は消えません。ログアウト中に記録した分はバックアップされません。{lastBackupAt ? `最後のバックアップは${backupLabel(lastBackupAt)}です。` : ''}
        </T>
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 18, flexDirection: 'row', gap: 10 }}>
        <OutlineButton label="やめる" onPress={onClose} style={{ flex: 1 }} />
        <PrimaryButton
          label="ログアウト"
          style={{ flex: 1 }}
          onPress={async () => {
            await signOut();
            setAccount(null);
            onClose();
            showToast('ログアウトしました。記録はこの端末に残っています');
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
