import { describe, expect, it } from 'vitest';
import { checkBundle, coachFlagOff, decodeEscapes, problems } from './bundleCheck';

const esc = (s: string) => [...s].map((c) => (c.charCodeAt(0) > 127 ? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0') : c)).join('');
const flagModule = (v: string) => `var ${'t'}=${v};Object.defineProperty(e,"COACH_MODE",{enumerable:!0,get:function(){return t}}),`;
const base = (flag = '!1') => `${esc("'設定''週間スケジュール'")}${flagModule(flag)}`;

describe('bundleCheck', () => {
  it('\\uXXXX を日本語に戻す', () => {
    expect(decodeEscapes('\\u8a2d\\u5b9a')).toBe('設定');
  });

  it('きれいなバンドルは問題なし', () => {
    expect(problems(checkBundle(base()))).toEqual([]);
  });

  it('禁止の文字を、エスケープされていても検出する', () => {
    const r = checkBundle(base() + esc("'（開発用）有料として扱う'"));
    expect(r.forbiddenFound).toEqual(['（開発用）', '有料として扱う']);
    expect(problems(r).length).toBe(2);
  });

  it('対照の文言がないと失敗（空振り防止）', () => {
    expect(problems(checkBundle(flagModule('!1'))).some((p) => p.includes('対照'))).toBe(true);
  });

  it('コーチの旗が true なら失敗、読めなくても失敗', () => {
    expect(coachFlagOff(decodeEscapes(base('!0')))).toBe(false);
    expect(problems(checkBundle(base('!0'))).some((p) => p.includes('true'))).toBe(true);
    expect(coachFlagOff('nothing')).toBeNull();
    expect(problems(checkBundle(esc("'設定''週間スケジュール'COACH_MODE"))).some((p) => p.includes('読み取れない'))).toBe(true);
  });
});
