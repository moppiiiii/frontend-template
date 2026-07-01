# CLAUDE.md

TanStack Start + Supabase のフロントエンドテンプレート。

## 設計ドキュメント（正本）

データアクセス層の設計思想・規約は `docs/` を参照する。実装前に必ず読む。

- `docs/README.md` — 核となる設計思想
- `docs/architecture.md` — ディレクトリ構成・配置規約・データフロー
- `docs/data-access.md` — Supabase アクセス層（型安全エンジン・entity/response・embed・適用範囲）
- `docs/adding-a-resource.md` — リソース追加手順

## リソース追加

新しい Supabase テーブル/リソースの CRUD を足すときは `add-supabase-resource` skill に従う。

## 仕上げ

変更後は `bun run check`（tsgo ＋ oxlint ＋ oxfmt）を通す。整形は `bun run format`（oxfmt）。型のみは `bun run typecheck`（tsgo）。

## 対応後のサマリー

作業が完了したら、最後にわかりやすいサマリーを出す。以下を簡潔にまとめる。

- **やったこと** — 対応内容の要約（1〜3行）。
- **変更ファイル** — 追加・変更・削除したファイルと、それぞれの役割を1行で。
- **確認結果** — `bun run check` などの実行結果（通ったか／失敗したか）。
- **次のアクション** — 残タスク・確認が必要な点・フォローアップがあれば。なければ「なし」。
