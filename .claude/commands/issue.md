---
description: issue 番号から main 起点の Orca worktree を作り、エージェントを起動して PR まで進める。`/issue 3 9` で複数、`/issue done 3` で完了処理
argument-hint: <番号...> | done <番号...>
---

引数: $ARGUMENTS

ロードマップは #41。worktree は常に primary（main）から作り、PR で main にマージする。

## 引数が `done <番号...>` のとき（完了処理）

番号ごとに次を行う。

1. `gh pr list --repo tomoki33/plate --search "<番号> in:body" --state merged` で、対応する PR がマージ済みか確認する。未マージなら何もせず報告する。
2. マージ済みなら、その worktree の status を `completed` にする。
   `orca worktree set --worktree path:/Users/tomoki33/orca/workspaces/plate/<name> --workspace-status completed`
3. #41 の本文で `- [ ] #<番号> ` を `- [x] #<番号> ` に直す。
   `gh issue view 41 --repo tomoki33/plate --json body -q .body` で取得し、該当行だけ置換して `gh issue edit 41 --repo tomoki33/plate --body-file <scratchpad のファイル>` で反映する。
4. 他の行が変わっていないことを diff で確認する。
5. primary で `git pull --ff-only` して最新の main にする。worktree の削除は、ユーザーに確認してから `orca worktree rm` で行う。

## 引数が番号のとき（着手）

番号ごとに次を行う。複数あるときは、触るファイルが重なりそうな組み合わせがないか先に確認し、重なるなら報告して止める。

1. `gh issue view <番号> --repo tomoki33/plate` で本文を読み、worktree 名を `issue-<2桁番号>-<英語の短い要約>` にする。
2. primary で `git status` が clean であることと、`git pull --ff-only` で main が最新であることを確認する。clean でなければ止めて報告する。
3. primary のフォルダ（`/Users/tomoki33/Desktop/plate`）から、親子関係と起点を明示して作る。

   ```bash
   orca worktree create --name <name> --issue <番号> \
     --base-branch origin/main --no-parent \
     --agent claude --prompt "<下記のプロンプト>" --json
   ```

4. `orca worktree set --worktree path:/Users/tomoki33/orca/workspaces/plate/<name> --workspace-status in-progress`

### エージェントに渡すプロンプト

- AGENTS.md に従う（Expo は変更が多いので versioned docs を確認する）。
- 担当は GitHub issue #<番号> のみ。他の issue の範囲には手を出さない（別 worktree で並行作業中）。
- 本文は `gh issue view <番号> --repo tomoki33/plate` で読み、チェックリストと完了条件を満たす。
- ダッシュボード操作・外部アカウントが必要な部分は自分でやらず、手順をまとめて最後に報告する。
- コードを変えたら `npx expo lint` と `npx tsc --noEmit` を通す。
- 作業が終わったらコミットし、ブランチを push して、main 向けの PR を作る。PR の本文に `Closes #<番号>` と、やったこと・残った人間の作業・確認方法を書く。
- 本文の末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` を付ける。コミットメッセージの末尾には `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` を付ける。
- PR を作ったら、`orca worktree set --worktree active --workspace-status in-review` を実行する。
- main へのマージはしない。マージはユーザーが行う。

## 最後に

作った worktree の一覧（issue 番号・名前・ブランチ）を短く報告する。`done` は PR のマージ後にユーザーが `/issue done <番号>` で実行する。
