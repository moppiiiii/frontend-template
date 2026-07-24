---
name: commit
description: 変更をコミットするときに使う。「コミットして」「commit して」「変更を保存して」等で発火。bun run check を通してから、既存ログに合わせた conventional 形式（feat:/fix:/refactor:/docs:/chore:）の英語メッセージでコミットする。PR を作る予定なら main に直接コミットせずブランチを切る。
---

# コミット

このリポジトリの流儀で変更をコミットする。

## 手順

1. **状態確認**: `git status` と `git diff`（staged 含む）で変更内容を把握する。直近の `git log --oneline -10` でメッセージの温度感も確認する。

2. **チェック**: コミット前に `bun run check` を実行する。落ちたら先に直す（自明な lint/format は `bun run format` で解消してよい）。ドキュメント・設定ファイルのみの変更ならスキップ可。

3. **ブランチ**: PR を作る予定（または後で `push-pr` skill を使う予定）なら、main 上では作業せずブランチを切る。
   - ブランチ名: `feat/<topic>` `fix/<topic>` などタイプ + 短い英語トピック。
   - すでに main にコミットしてしまった未 push 分を PR にしたい場合は、`git branch <name>` でブランチを作ってから `git switch <name>` し、main は `git reset --hard origin/main`（**ユーザーに確認してから**）。

4. **ステージ**: 依頼に関係する変更だけをステージする。無関係な変更が混ざっていたら分割コミットにするか、ユーザーに確認する。

5. **コミット**: メッセージは以下の形式。

## コミットメッセージ規約

- 形式: `<type>: <summary>`（英語・小文字・命令形・50 文字目安・末尾ピリオドなし）
- type: `feat` / `fix` / `refactor` / `docs` / `chore` / `test` / `style`
- 例: `feat: add push-pr skill`、`fix: redirect bug`、`docs: update getting-started`
- 1 コミット = 1 つの論理変更。複数の関心事が混ざるなら分割する。
- 本文（body）は「なぜ」が自明でないときだけ書く。
- **`Co-Authored-By: Claude` や `Generated with Claude Code` などのトレーラー・フッターは付けない**（デフォルト動作より本規約を優先する）。

## 落とし穴

- `routeTree.gen.ts` は自動生成物。差分に出ていたらそのまま含めてよいが、手で編集した形跡があれば疑う。
- `git add -A` は無関係ファイルを巻き込みやすい。`git status` を見てからパス指定でステージする。
