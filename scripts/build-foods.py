#!/usr/bin/env python3
"""
日本食品標準成分表（八訂）の第2章 Excel（「表全体」シート）を src/data/foods.json に変換する。

  curl -LO https://www.mext.go.jp/content/20201225-mxt_kagsei-mext_01110_012.xlsx
  pip install openpyxl
  python3 scripts/build-foods.py 20201225-mxt_kagsei-mext_01110_012.xlsx

出力の各行: [食品番号, 食品群コード, 表示名, kcal, たんぱく質g, 脂質g, 炭水化物g]（可食部100gあたり）
  たんぱく質 = PROT-、脂質 = FAT-、炭水化物 = CHOCDF-（差し引き法）、エネルギー = ENERC_KCAL
値の記号: (…) は推定値なので括弧を外す。Tr（微量）・-（未測定）・空欄は 0 とする。
出典：文部科学省「日本食品標準成分表（八訂）」。公開前に利用条件と出典表記を確認すること。
"""
import json
import re
import sys

import openpyxl

COL = {'code': 1, 'name': 3, 'kcal': 6, 'p': 9, 'f': 12, 'c': 20}


def num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace('(', '').replace(')', '')
    try:
        return float(s)
    except ValueError:
        return 0.0  # Tr, -, *, 空欄


def clean_name(raw: str) -> str:
    s = raw.replace('　', ' ')
    s = re.sub(r'＜[^＞]*＞\s*', '', s)  # 分類名（＜鳥肉類＞など）は表示から外す
    return re.sub(r'\s+', ' ', s).strip()


def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    rows = list(wb['表全体'].iter_rows(values_only=True))
    out = []
    for r in rows:
        code = r[COL['code']]
        if not code or not str(code).isdigit() or len(str(code)) != 5:
            continue
        out.append([
            str(code),
            str(code)[:2],
            clean_name(str(r[COL['name']])),
            round(num(r[COL['kcal']])),
            round(num(r[COL['p']]), 1),
            round(num(r[COL['f']]), 1),
            round(num(r[COL['c']]), 1),
        ])
    with open('src/data/foods.json', 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} foods -> src/data/foods.json')


if __name__ == '__main__':
    main(sys.argv[1])
