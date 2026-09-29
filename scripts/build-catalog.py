#!/usr/bin/env python3
"""
食品カタログ（scripts/catalog_spec.py）を、アプリと Edge Function 用の JSON に変換する。

  python3 scripts/build-catalog.py           # 生成
  python3 scripts/build-catalog.py --report  # どの成分表の行に当たったかを表示

出力:
  src/data/catalog.json                          [key, 名前, 別名, kcal, P, F, C, 既定g, 1個g, 成分表番号|null]（100gあたり）
  supabase/functions/estimate-meal/catalog.json  [key, 名前]（AIに選ばせる一覧）
成分表に見つからない条件があれば、エラーで止める。
"""
import json
import sys

from catalog_spec import S

foods = json.load(open('src/data/foods.json', encoding='utf-8'))  # [code, group, name, kcal, p, f, c]


MISSING = []


def find(kw):
    hits = [r for r in foods if all(k in r[2] for k in kw)]
    if not hits:
        MISSING.append(kw)
        return ['', '', '(なし)', 0, 0, 0, 0]
    return min(hits, key=lambda r: (len(r[2]), r[0]))


out, ai, report, seen = [], [], [], set()
for kind, key, name, aliases, spec, g, unit in S:
    if key in seen:
        raise SystemExit(f'key が重複: {key}')
    seen.add(key)
    if kind == 'T':
        r = find(spec)
        v, code = r[3:7], r[0]
        report.append(f'{name:<20} <- {r[2]}')
    elif kind == 'M':
        tot = [0.0] * 4
        w = 0
        parts = []
        for kw, gram in spec:
            r = find(kw)
            parts.append(f'{r[2]}×{gram}g')
            for i in range(4):
                tot[i] += r[3 + i] * gram / 100
            w += gram
        v, code = [round(x * 100 / w, 1) for x in tot], None
        v[0] = round(v[0])
        report.append(f'{name:<20} <- ' + ' + '.join(parts))
    else:
        v, code = list(spec), None
        report.append(f'{name:<20} <- 目安値')
    out.append([key, name, aliases, v[0], v[1], v[2], v[3], g, unit, code])
    ai.append([key, name])

if MISSING:
    print('成分表に見つからない条件:')
    for m in MISSING:
        print('  ', m)
    raise SystemExit(1)
if '--report' in sys.argv:
    print('\n'.join(report))
    print(len(out), 'items')
    sys.exit(0)
json.dump(out, open('src/data/catalog.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
json.dump(ai, open('supabase/functions/estimate-meal/catalog.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(len(out), 'items ->', 'src/data/catalog.json, supabase/functions/estimate-meal/catalog.json')
