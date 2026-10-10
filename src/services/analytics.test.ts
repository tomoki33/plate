import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('analytics', () => {
  const fetchMock = vi.fn(() => Promise.resolve({}));
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockClear();
    vi.stubGlobal('__DEV__', false);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'anon');
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('同意（ID）がないあいだは何も送らない', async () => {
    const a = await import('./analytics');
    a.trackAppOpen(3);
    a.configureAnalytics(null);
    a.trackTrialStarted();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('同意後は、IDとイベント名と許可した props だけを送る', async () => {
    const a = await import('./analytics');
    a.configureAnalytics('11111111-1111-4111-8111-111111111111');
    a.trackDayLogged('2026-10-06', 'photo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }];
    expect(url).toBe('https://x.supabase.co/rest/v1/analytics_events');
    expect(JSON.parse(init.body)).toEqual({ install_id: '11111111-1111-4111-8111-111111111111', name: 'day_logged', props: { date: '2026-10-06', kind: 'photo' } });
  });

  it('同意をやめたら、そのあとは送らない', async () => {
    const a = await import('./analytics');
    a.configureAnalytics('id');
    a.configureAnalytics(null);
    a.trackPurchased('full');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('送り先の設定がなければ送らない', async () => {
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', '');
    const a = await import('./analytics');
    a.configureAnalytics('id');
    a.trackAppOpen(1);
    expect(a.analyticsConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buildProps は許可リスト以外（食事名・体重・メールなど）を落とす', async () => {
    const { buildProps } = await import('./analytics');
    expect(buildProps('day_logged', { date: '2026-10-06', kind: 'text', meal: '鶏むね肉', weight: 62.5, email: 'a@b.c' })).toEqual({ date: '2026-10-06', kind: 'text' });
    expect(buildProps('day_logged', { date: '鶏むね肉 200g', kind: 'x' })).toEqual({});
    expect(buildProps('app_open', { daysSinceInstall: 7.9, weight: 60 })).toEqual({ daysSinceInstall: 7 });
    expect(buildProps('app_open', { daysSinceInstall: NaN })).toEqual({});
    expect(buildProps('purchased', { product: 'secret' })).toEqual({});
    expect(buildProps('trial_started', { anything: 1 })).toEqual({});
  });
});
