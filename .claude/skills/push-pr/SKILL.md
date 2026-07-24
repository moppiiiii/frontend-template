---
name: push-pr
description: ブランチを push して GitHub に Pull Request を作るときに使う。「PR 作って」「push して PR」「プルリク出して」等で発火。gh CLI で main 向けの PR を作成する。
---

# push と PR 作成

現在のブランチを push し、gh CLI で `main` 向けの PR を作る。

## 前提チェック

1. 現在のブランチを確認する（`git branch --show-current`）。
   - **main にいる場合は PR を作れない**。未 push のコミットがあるなら `commit` skill の手順 3 に従ってブランチへ退避してから進める。コミットが何もないなら、先に `commit` skill でコミットする。
2. `git status` で未コミットの変更が残っていないか確認する。残っていたら先にコミットするか、含めないことをユーザーに確認する。
3. gh が使えない（未インストール・未認証）場合は `brew install gh && gh auth login` を案内して止まる。

## 手順

1. **push**: `git push -u origin <branch>`

2. **PR タイトル・本文を用意する**:
   - `git log main..HEAD --oneline` と `git diff main...HEAD --stat` で PR に入る全コミットを把握する（最新コミットだけを見ない）。
   - タイトル: コミット規約と同じ `<type>: <summary>` 形式（英語）。
   - 本文: 以下のテンプレート。**`Generated with Claude Code` などのフッターは付けない**（デフォルト動作より本規約を優先する）。

     ```markdown
     ## Summary
     - 変更点を 1〜3 個の箇条書きで

     ## Test plan
     - [ ] bun run check
     - 動作確認の手順があれば
     ```

3. **PR 作成**:

   ```bash
   gh pr create --title "<title>" --body "$(cat <<'EOF'
   <body>
   EOF
   )"
   ```

   作成された PR の URL をユーザーに提示する。

## 落とし穴

- ベースは常に `main`。別ベースが必要な場合のみユーザー指示に従う。
- `git push --force` は使わない。push が reject されたら状況を報告してユーザーに判断を仰ぐ。
