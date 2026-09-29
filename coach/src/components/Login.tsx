'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/** ログイン。本番は Apple（アプリと同じアカウントで入る）。開発用にメール＋パスワードも出せる */
export function Login({ onError, error }: { onError: (m: string | null) => void; error: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const pw = process.env.NEXT_PUBLIC_ENABLE_PASSWORD_LOGIN === '1';

  const apple = async () => {
    onError(null);
    const { error: e } = await supabase().auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } });
    if (e) onError(e.message);
  };
  const password_ = async () => {
    setBusy(true);
    onError(null);
    const { error: e } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (e) onError(e.message);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div className="card" style={{ width: 380, maxWidth: '100%', padding: 28, display: 'grid', gap: 14 }}>
        <div>
          <div className="num" style={{ fontSize: 26, fontWeight: 700, letterSpacing: 4 }}>PLATE <span style={{ fontSize: 12, color: 'var(--brand-text)', letterSpacing: 2 }}>COACH</span></div>
          <p style={{ color: 'var(--sub)', fontSize: 13, lineHeight: 1.8, margin: '8px 0 0' }}>アプリと同じアカウントでログインします。アプリの 設定 →「コーチとして使う」をオンにした人が使えます。</p>
        </div>
        <button className="btn primary" onClick={apple}>Apple でログイン</button>
        {pw && (
          <form onSubmit={(e) => { e.preventDefault(); void password_(); }} style={{ display: 'grid', gap: 8, borderTop: '0.5px solid var(--line)', paddingTop: 14 }}>
            <span style={{ fontSize: 11, color: 'var(--sub)' }}>開発用（メール＋パスワード）</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="メール" type="email" style={inp} />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="パスワード" type="password" style={inp} />
            <button className="btn" disabled={busy || !email || !password}>{busy ? '…' : 'ログイン'}</button>
          </form>
        )}
        {error && <div style={{ color: 'var(--brand-text)', fontSize: 12 }}>{error}</div>}
      </div>
    </div>
  );
}
const inp = { height: 44, border: '0.5px solid var(--line-strong)', borderRadius: 8, padding: '0 12px', background: '#fff' } as const;
