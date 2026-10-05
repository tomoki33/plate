import { describe, expect, it } from 'vitest';
import { checkBundle, coachFlagOff, decodeEscapes, problems } from './bundleCheck';

const esc = (s: string) => [...s].map((c) => (c.charCodeAt(0) > 127 ? '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0') : c)).join('');
const flagModule = (v: string) => `__d(function(g){Object.defineProperty(e,"COACH_MODE",{enumerable:!0,get:function(){return t}});var t=${v}},1,[]);`;
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

  it('別のモジュールが同じ変数名を使っていても、旗のモジュールの値で判定する', () => {
    const other = (v: string) => `__d(function(g){var t=${v};e.y=t},0,[]);`;
    const after = (v: string) => `__d(function(g){var t=${v}},2,[]);`;
    expect(coachFlagOff(other('!1') + flagModule('!0') + after('!1'))).toBe(false);
    expect(coachFlagOff(other('!0') + flagModule('!1') + after('!0'))).toBe(true);
  });

  it('旗のモジュール内で宣言が特定できなければ null', () => {
    const twice = '__d(function(g){Object.defineProperty(e,"COACH_MODE",{enumerable:!0,get:function(){return t}});var t=!1;var t=!0},1,[]);';
    expect(coachFlagOff(twice)).toBeNull();
  });
});
