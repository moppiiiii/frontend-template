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

変更後は `bunx tsc --noEmit` と `bun run check`（oxlint ＋ oxfmt）を通す。整形は `bun run format`（oxfmt）。
