#!/usr/bin/env bash
# Supabase のマイグレーション履歴を baseline 化する（人間が手元で実行する）。詳細: docs/supabase-migrations.md
#
#   scripts/supabase-baseline.sh            # 確認だけ（既定）。何も変更しない
#   scripts/supabase-baseline.sh --apply    # 履歴に applied を登録する（確認プロンプトあり）
#
# 前提: supabase CLI、`supabase link --project-ref <ref>` 済み。
# このスクリプトは SQL を実行しない。履歴テーブル（supabase_migrations.schema_migrations）に
# 「適用済み」の印を付けるだけで、スキーマやデータは変えない。
set -euo pipefail
cd "$(dirname "$0")/.."

mode="check"
[ "${1:-}" = "--apply" ] && mode="apply"

if [ ! -f supabase/.temp/project-ref ]; then
  echo "supabase link が未実施です: supabase link --project-ref <ref>" >&2
  exit 1
fi
echo "対象プロジェクト: $(cat supabase/.temp/project-ref)"

# baseline の対象は、verify SQL で検査する 5 版に固定する（それ以降に足した migration は、通常の db push で適用する）
versions=(20260928190100 20260928190200 20260929120000 20260929130000 20261002000000)
for v in "${versions[@]}"; do
  ls supabase/migrations/"${v}"_*.sql >/dev/null 2>&1 || { echo "ローカルに ${v} の migration がありません" >&2; exit 1; }
done
echo "baseline 対象: ${versions[*]}"
echo
echo "--- リモートの履歴（Local / Remote の差） ---"
supabase migration list --linked
echo

if [ "$mode" = "check" ]; then
  echo "確認のみ。次の手順:"
  echo "  1. scripts/supabase-verify-baseline.sql を SQL Editor で実行し、全行 true と、末尾の手動確認を完了"
  echo "  2. 履歴にリモート専用の行（Remote だけにある版）がないか確認（あれば docs の「相乗りの場合」へ）"
  echo "  3. scripts/supabase-baseline.sh --apply"
  exit 0
fi

echo "verify SQL が全行 true、かつ docs の手動確認（ポリシー条件・関数本文）も済んでいる場合だけ進む。"
read -r -p "上の ${#versions[@]} 件を applied として登録します。よいですか？ (yes/no) " ans
[ "$ans" = "yes" ] || { echo "中止"; exit 1; }

supabase migration repair --linked --status applied "${versions[@]}"
echo
echo "--- 登録後 ---"
supabase migration list --linked
echo
echo "--- db push の予行（変更なし。'Remote database is up to date.' なら成功） ---"
supabase db push --linked --dry-run
