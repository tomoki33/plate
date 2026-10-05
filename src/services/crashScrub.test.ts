import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react-native';
import { dropBreadcrumb, scrubEvent } from './crashScrub';

const leaky = () =>
  ({
    event_id: 'abc',
    level: 'error',
    release: 'app.plate.pfc@1.0.0+1',
    environment: 'production',
    message: '体重 62.5kg 鶏むね肉 200g',
    user: { id: 'u1', email: 'a@example.com', ip_address: '1.2.3.4', username: 'taro' },
    request: { url: 'https://x', headers: { Authorization: 'Bearer t' } },
    server_name: "Taro's iPhone",
    extra: { weight: 62.5, meals: ['鶏むね肉'] },
    tags: { goal: 'cut' },
    modules: { a: '1' },
    breadcrumbs: [{ category: 'console', message: 'weight=62.5' }],
    logentry: { message: 'weight %s', params: [62.5] },
    exception: {
      values: [
        {
          type: 'Error',
          value: 'INSERT INTO weights (kg) VALUES (62.5)',
          data: { sql: 'x' },
          stacktrace: { frames: [{ filename: 'app:///index.bundle', function: 'save', lineno: 10, vars: { kg: 62.5 }, context_line: 'const kg = 62.5', pre_context: ['a'], post_context: ['b'] }] },
        },
      ],
    },
    contexts: {
      app: { app_version: '1.0.0', device_app_hash: 'hash' },
      os: { name: 'iOS', version: '18.0' },
      device: { model: 'iPhone16,1', name: "Taro's iPhone", family: 'iPhone' },
      trace: { trace_id: 't' },
      custom: { meal: 'x' },
    },
  }) as unknown as ErrorEvent;

describe('scrubEvent', () => {
  it('removes user, request, extra, tags, breadcrumbs and identifiers', () => {
    const e = scrubEvent(leaky())! as unknown as Record<string, unknown>;
    for (const k of ['user', 'request', 'extra', 'tags', 'breadcrumbs', 'server_name', 'logentry', 'modules']) {
      expect(e[k]).toBeUndefined();
    }
  });

  it('redacts message and exception text but keeps type and stack location', () => {
    const e = scrubEvent(leaky())!;
    expect(e.message).toBe('[redacted]');
    const v = e.exception!.values![0];
    expect(v.type).toBe('Error');
    expect(v.value).toBe('[redacted]');
    expect((v as { data?: unknown }).data).toBeUndefined();
    const f = v.stacktrace!.frames![0] as Record<string, unknown>;
    expect(f.function).toBe('save');
    expect(f.lineno).toBe(10);
    for (const k of ['vars', 'context_line', 'pre_context', 'post_context']) expect(f[k]).toBeUndefined();
  });

  it('keeps only allowlisted contexts and device fields', () => {
    const e = scrubEvent(leaky())!;
    expect(Object.keys(e.contexts!).sort()).toEqual(['app', 'device', 'os']);
    expect(e.contexts!.device).toEqual({ model: 'iPhone16,1', family: 'iPhone' });
    expect((e.contexts!.app as Record<string, unknown>).device_app_hash).toBeUndefined();
    expect(e.contexts!.os).toEqual({ name: 'iOS', version: '18.0' });
  });

  it('leaves no record or identity string anywhere in the output', () => {
    const json = JSON.stringify(scrubEvent(leaky()));
    for (const s of ['62.5', '鶏むね肉', 'a@example.com', '1.2.3.4', 'taro', "Taro's", 'Bearer', 'INSERT INTO']) {
      expect(json).not.toContain(s);
    }
    expect(json).toContain('app.plate.pfc@1.0.0+1');
  });

  it('handles events without exception or contexts', () => {
    expect(scrubEvent({ level: 'error', message: 'x' } as unknown as ErrorEvent)!.message).toBe('[redacted]');
  });
});

describe('dropBreadcrumb', () => {
  it('drops every breadcrumb', () => expect(dropBreadcrumb()).toBeNull());
});
