# はじめてのガイド（初学者向け）

このテンプレートが何で、なぜ使う価値があり、どう始めればいいかを 1 枚にまとめたもの。詳細な規約はここからリンクする各ドキュメントに譲る。

## これは何？

**TanStack Start（React 19 / SSR）＋ Supabase** で Web アプリを作るためのテンプレート。ログイン・データの読み書き・画面遷移といった「どのアプリでも必要になる土台」が、型安全かつ規約付きで組み込み済み。動作サンプルとして Todo アプリが同梱されている（不要になったらワンコマンドで消せる）。

## 強み: なぜこのテンプレを使うのか

**1. タイポやカラム変更ミスがコンパイル時・定義時に捕まる**
Supabase のテーブル操作は `"@select/todos"` のようなキーで呼び、キー・filter のカラム名・値の型・戻り値がすべて TypeScript で検証される。取得カラムの文字列とスキーマがずれた場合も、アプリ起動・テスト時に即エラーで露見する。「動かして初めて気づく」類のバグが構造的に減る。

**2. エラーが握りつぶされない**
データ層は例外を投げず `Result` 型（成功 or 失敗の値）を返し、サーバー境界で必ず明示的に処理する。DB 障害が「空の一覧」として正常表示に化ける、といった事故が起きない設計になっている。エラー画面・404・ローディングの境界 UI も全ルートに配線済み。

**3. セキュリティの防衛線が 1 本でレビュー可能**
データの読み書きはすべてサーバー関数（serverFn）経由。行レベルの認可は Supabase の RLS（Row Level Security）に一本化し、そのポリシーは `supabase/migrations/` の SQL としてバージョン管理される。「誰が何を見られるか」が Git の diff でレビューできる。

**4. 迷わない・散らからない**
「どこに何を置くか」が規約化され、Claude Code の skill（`/add-supabase-resource`・`/add-route`）が規約どおりの実装を自動でやってくれる。楽観的更新（画面を先に更新してサーバーと後で同期する UX パターン）のような難しい定型も、雛形とテストがセットで用意されている。

## 使い始め方

### 1. 依存を入れて環境変数を用意する

```bash
bun install
cp .env.example .env
```

[Supabase ダッシュボード](https://supabase.com/dashboard)でプロジェクトを作成し、Project Settings → API の値を `.env` に書く:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=（publishable / anon キー）
```

### 2. DB を作る（migration の適用）

テーブル定義と RLS ポリシーの正本は `supabase/migrations/` の SQL。Supabase CLI で適用する:

```bash
supabase link --project-ref <プロジェクト ref>   # 初回のみ
supabase db push
```

CLI を使わない場合は、ダッシュボードの SQL Editor に migration ファイルの中身を貼り付けて実行してもよい。

### 3. ログイン用ユーザーを作る

このテンプレートにサインアップ画面はない（ログインのみ）。ダッシュボードの **Authentication → Users → Add user** でメールアドレスとパスワードのユーザーを作成する（Auto Confirm を有効にすると確認メール不要）。

### 4. 起動して動作確認

```bash
bun run dev
```

http://localhost:3000 を開く → ログイン画面 → 作成したユーザーでログイン → Todo の追加・完了トグル・削除が動けば、エンジン・認証・RLS まで一通り機能している。

### 5. サンプルを消して自分のアプリを始める

Todo サンプル（`@sample-todos` マーカー付きファイル一式）は削除してよい実装例。Claude Code で:

```
/strip-sample
```

と打てば、認証・データアクセス層・境界 UI などの土台だけを残した素の状態になる。

## 日常の開発フロー

| やりたいこと | 方法 |
| --- | --- |
| テーブル/リソースの CRUD を足す | `/add-supabase-resource`（migration → スキーマ → serverFn → フック） |
| 画面（ルート）を足す | `/add-route` |
| UI 部品を足す | `bunx shadcn@latest add <name>` → `src/components/ui/` |
| 変更後の仕上げ | `bun run check`（型 ＋ lint ＋ 整形チェック）と `bun run test` |

守るべき最低限のルール:

- **routes は薄く**。ロジックは `server/` `hooks/` `components/` に置く
- **スタイルは Tailwind を `className` に直書き**。`styles.css` にクラスを足さない
- **`routeTree.gen.ts` は自動生成**。手で編集しない
- **環境変数は `@/env` 経由**。`import.meta.env` を直接触らない

## 学習マップ（読む順番）

1. [docs/README.md](./README.md) — 核となる 4 つの設計思想（まずこれだけでも）
2. [docs/architecture.md](./architecture.md) — どこに何を置くか・データフロー・認証ガード
3. [docs/data-access.md](./data-access.md) — クエリエンジンの仕組みと使い方
4. [docs/adding-a-resource.md](./adding-a-resource.md) — リソース追加の実践手順（コード例つき）

コードを読むなら、`src/schemas/todos.ts` → `src/server/todos.ts` → `src/routes/_authed/index.tsx` → `src/hooks/use-toggle-todo.ts` の順に追うと 1 リソースの一生が分かる。

## よくあるハマりどころ

- **起動時に env のエラーで落ちる** → `.env` の必須 2 変数（URL / publishable key）が未設定。`src/env.ts` が起動時に検証している
- **ログインできない** → ユーザー未作成、またはメール確認待ち。ダッシュボードで Auto Confirm 付きで作り直す
- **一覧が常に空 / 追加が反映されない** → migration 未適用（テーブルが無い）か、RLS ポリシー不足。`supabase db push` 済みかを確認
- **新しいルートが 404** → `bun run generate-routes` で `routeTree.gen.ts` を再生成（dev 起動中は自動）
- **`bun run check` の整形エラー** → `bun run format` で自動修正してから再実行
