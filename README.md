# fe-template

**TanStack Start + Supabase** のフロントエンドテンプレート。

型安全な Supabase アクセス層・楽観的更新・SSR 対応のデータフローをあらかじめ組み込み、リソース／画面／フォームの追加を**規約化**してある。設計の正本は [`docs/`](./docs/README.md)、定型作業は Claude Code の [skill](#claude-code-skill) に従う。

---

## 技術スタック

| 領域 | 採用 |
| --- | --- |
| フレームワーク | [TanStack Start](https://tanstack.com/start)（React 19・SSR） |
| ルーティング | [TanStack Router](https://tanstack.com/router)（ファイルベース） |
| データ取得・キャッシュ | [TanStack Query](https://tanstack.com/query)（+ Router SSR 統合） |
| フォーム | [TanStack Form](https://tanstack.com/form) |
| 状態・テーブル | TanStack Store / TanStack Table |
| バックエンド | [Supabase](https://supabase.com)（`@supabase/ssr` + `supabase-js`） |
| エラーハンドリング | [neverthrow](https://github.com/supermacro/neverthrow)（`Result` 型） |
| バリデーション | [Zod](https://zod.dev)（v4） |
| 環境変数 | [`@t3-oss/env-core`](https://env.t3.gg)（型安全） |
| スタイリング | [Tailwind CSS](https://tailwindcss.com)（v4）/ [Radix UI](https://www.radix-ui.com) / shadcn 流のプリミティブ |
| Lint / Format | [oxlint](https://oxc.rs) / [oxfmt](https://oxc.rs) |
| 型チェック | [tsgo](https://github.com/microsoft/typescript-go)（TypeScript Native Preview） |
| テスト | [Vitest](https://vitest.dev) + Testing Library（jsdom） |
| デプロイ | [Cloudflare Workers](https://developers.cloudflare.com/workers/)（Wrangler + Vite plugin） |

ランタイムは **Bun**（パッケージ管理・スクリプト実行とも）。

---

## はじめに

```bash
bun install
```

環境変数を用意する（`.env.example` をコピーして Supabase の値を入れる）:

```bash
cp .env.example .env
```

開発サーバーを起動（http://localhost:3000）:

```bash
bun run dev
```

---

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `bun run dev` | 開発サーバー（port 3000） |
| `bun run build` | 本番ビルド |
| `bun run preview` | ビルド結果のプレビュー |
| `bun run test` | Vitest 実行 |
| `bun run typecheck` | 型チェック（tsgo） |
| `bun run lint` | oxlint |
| `bun run format` | oxfmt（整形を書き込む） |
| `bun run check` | **仕上げ**：tsgo ＋ oxlint ＋ oxfmt --check |
| `bun run generate-routes` | `routeTree.gen.ts` を再生成（`tsr generate`） |
| `bun run deploy` | ビルドして Cloudflare へデプロイ |

> 変更後は必ず `bun run check` を通す。整形のみは `bun run format`、型のみは `bun run typecheck`。

---

## ディレクトリ構成

配置規約の正本は [`docs/architecture.md`](./docs/architecture.md)。要点だけ：

```
src/
  routes/                 # ファイルルート。薄く保つ（loader + 画面シェルのみ）
  components/
    ui/                   # shadcn 流のプリミティブ（Button / Input 等）
    <feature>/            # 機能ごとの画面パーツ（例: todos/）
  server/                 # serverFn（fetch も mutation も 1 リソース 1 ファイル）
  hooks/                  # 楽観的更新の mutation フック
  schemas/                # Zod スキーマ・appSchema（型の単一の真実）
  lib/supabase/           # Supabase クライアント（client / server）
  integrations/           # TanStack Query のプロバイダ等
  env.ts                  # 型安全な環境変数（t3-env）
  router.tsx              # ルーター生成・SSR Query 統合
  routeTree.gen.ts        # 自動生成（手で触らない）
```

**import エイリアスは `@/`**（`@/*` → `./src/*`）。環境変数は必ず `@/env` 経由で、`import.meta.env.X` を直接使わない。

### データフロー（読み取り）

```
route loader → queryClient.ensureQueryData(<resource>QueryOptions())
            → get<Resource>()  [serverFn]
              → $supabaseServer()("@select/<table>", { filter })
component   → useSuspenseQuery(<resource>QueryOptions())  で同じキャッシュを購読
```

書き込みは serverFn（`@insert|update|delete/<table>`）を楽観フック（`onMutate` / `onError` / `onSettled`）から呼ぶ。詳細は [`docs/data-access.md`](./docs/data-access.md)。

---

## 設計ドキュメント（正本）

データアクセス層の設計思想・規約は `docs/` を参照する。**実装前に必ず読む。**

- [`docs/README.md`](./docs/README.md) — 核となる設計思想
- [`docs/architecture.md`](./docs/architecture.md) — ディレクトリ構成・配置規約・データフロー
- [`docs/data-access.md`](./docs/data-access.md) — Supabase アクセス層（型安全エンジン・entity/response・embed・適用範囲）
- [`docs/adding-a-resource.md`](./docs/adding-a-resource.md) — リソース追加手順

---

## Claude Code skill

このテンプレートには定型作業を規約どおりに行うための [Claude Code](https://claude.com/claude-code) skill を同梱している。`/<skill 名>` で呼び出せる。

| skill | 用途 |
| --- | --- |
| `add-supabase-resource` | 新しい Supabase テーブル／リソースの CRUD を追加（schema → appSchema → serverFn → 楽観フック → route） |
| `add-route` | 画面ルートを追加（薄い route ＋ loader ＋ `useSuspenseQuery`、search バリデーション、認証ガード） |
| `add-form` | 入力フォームを追加（検証は serverFn の `.validator(zod)`、送信は楽観フック経由） |

---

## UI コンポーネントの追加

[shadcn/ui](https://ui.shadcn.com) のプリミティブを `src/components/ui/` に置く方針。

```bash
bunx shadcn@latest add button
```

---

## デプロイ（Cloudflare Workers）

Cloudflare Vite plugin（`vite.config.ts`）と `wrangler.jsonc` で構成済み。

```bash
bun run deploy        # build + wrangler deploy
```

- 本番のシークレットは `.env.example` の各値について `wrangler secret put <NAME>` で登録する。
- 公開してよい（非シークレットな）変数は `wrangler.jsonc` の `vars` に置く。
- KV / D1 / R2 / Durable Object のバインディングは `wrangler.jsonc` で設定する（[ドキュメント](https://developers.cloudflare.com/workers/wrangler/configuration/)）。

---

## さらに詳しく

- [TanStack Start ドキュメント](https://tanstack.com/start)
- [Supabase ドキュメント](https://supabase.com/docs)
- このテンプレート固有の規約 → [`docs/`](./docs/README.md)
