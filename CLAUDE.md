# CLAUDE.md

TanStack Start + Supabase のフロントエンドテンプレート。

## 設計ドキュメント（正本）

データアクセス層の設計思想・規約は `docs/` を参照する。実装前に必ず読む。

- `docs/README.md` — 核となる設計思想
- `docs/architecture.md` — ディレクトリ構成・配置規約・データフロー
- `docs/data-access.md` — Supabase アクセス層（型安全エンジン・entity/response・embed・適用範囲）
- `docs/adding-a-resource.md` — リソース追加手順

## リソース追加

新しい Supabase テーブル/リソースの CRUD を足すときは `add-supabase-resource` skill に従う。テーブル定義・RLS ポリシーの正本は `supabase/migrations/` の SQL（リソース追加時は migration も書く）。

## サンプル削除

同梱の todo サンプル（`@sample-todos` マーカー付きファイル）は削除してよい実装例。新規プロジェクト開始時に取り除くときは `strip-sample` skill に従う。

## スタイリング規約

- スタイルは Tailwind ユーティリティを各コンポーネントの `className` に直接書く（結合は `cn()`、バリアントは cva）。
- `src/styles.css` はデザイントークン・要素セレクタのグローバル・`@layer base` のみ。**コンポーネント固有のクラス（`.foo-card` 等）を styles.css に追加しない**。
- 見た目の繰り返しは CSS クラス抽出ではなく `components/ui/` へのコンポーネント抽出で解決する。詳細は `docs/architecture.md` の「スタイリング」。

## コメント規約

- コメントは最小限。書くなら 1〜2 行で端的に。長い解説・箇条書きコメントは書かない。
- 見てわかることは書かない（処理をなぞるだけの説明、次の行が何をするかの言い換えは禁止）。
- 「アサーション: 〜のため安全」のような正当化・弁明コメント、変更の経緯やレビュー向けの説明も書かない。
- 書いてよいのは、コードから読み取れない制約・意図・落とし穴だけ。

## 仕上げ

変更後は `bun run check`（tsgo ＋ oxlint ＋ oxfmt）を通す。整形は `bun run format`（oxfmt）。型のみは `bun run typecheck`（tsgo）。

## 対応後のサマリー

作業が完了したら、最後にわかりやすいサマリーを出す。以下を簡潔にまとめる。

- **やったこと** — 対応内容の要約（1〜3行）。
- **変更ファイル** — 追加・変更・削除したファイルと、それぞれの役割を1行で。
- **確認結果** — `bun run check` などの実行結果（通ったか／失敗したか）。
- **次のアクション** — 残タスク・確認が必要な点・フォローアップがあれば。なければ「なし」。
