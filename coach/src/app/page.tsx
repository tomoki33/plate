'use client';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Dashboard } from '@/components/Dashboard';
import { Login } from '@/components/Login';
import { supabase } from '@/lib/supabase';

export default function Page() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const c = supabase();
    void c.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = c.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  if (!session) return <Login error={error} onError={setError} />;
  return <Dashboard email={session.user.email ?? ''} />;
}
