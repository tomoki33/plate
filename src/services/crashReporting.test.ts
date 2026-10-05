import { beforeEach, describe, expect, it, vi } from 'vitest';

const init = vi.fn();
const wrap = vi.fn((c: unknown) => ({ wrapped: c }));
vi.mock('@sentry/react-native', () => ({ init, wrap }));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
  wrap.mockClear();
  vi.unstubAllEnvs();
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
});

describe('crashReporting', () => {
  it('does nothing when the DSN is not set', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', '');
    const m = await import('./crashReporting');
    m.initCrashReporting();
    const C = () => null;
    expect(m.withCrashReporting(C)).toBe(C);
    expect(m.crashReportingConfigured()).toBe(false);
    expect(init).not.toHaveBeenCalled();
    expect(wrap).not.toHaveBeenCalled();
  });

  it('initializes with PII off and scrubbing hooks when the DSN is set', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'https://k@o1.ingest.sentry.io/2');
    const m = await import('./crashReporting');
    const { scrubEvent, dropBreadcrumb } = await import('./crashScrub');
    m.initCrashReporting();
    expect(init).toHaveBeenCalledTimes(1);
    const o = init.mock.calls[0][0];
    expect(o).toMatchObject({ dsn: 'https://k@o1.ingest.sentry.io/2', sendDefaultPii: false, maxBreadcrumbs: 0, tracesSampleRate: 0, attachScreenshot: false, attachViewHierarchy: false, enableLogs: false, enabled: true });
    expect(o.beforeSend).toBe(scrubEvent);
    expect(o.beforeBreadcrumb).toBe(dropBreadcrumb);
    expect(o.integrations).toBeUndefined();
    const C = () => null;
    expect(m.withCrashReporting(C)).toEqual({ wrapped: C });
  });

  it('does not send from dev builds', async () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'https://k@o1.ingest.sentry.io/2');
    const m = await import('./crashReporting');
    m.initCrashReporting();
    expect(init.mock.calls[0][0].enabled).toBe(false);
  });
});
