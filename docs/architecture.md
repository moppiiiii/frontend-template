# アーキテクチャ

## ディレクトリ構成

```
src/
  routes/                 # TanStack Router のファイルルート。薄く保つ（loader + 画面シェルのみ）
  components/
    ui/                   # shadcn/ui プリミティブ（考えずに置く）
    <feature>/            # 機能ごとの画面パーツ（例: todos/）
  hooks/                  # use-<action>-<resource>.ts（楽観的更新の useMutation など）
  server/                 # serverFn（fetch / mutation 両方）＋ queryOptions。1 リソース 1 ファイル
    <resource>.ts
  schemas/                # zod スキーマ＋取得クエリ定数。1 リソース 1 ファイル
    <resource>.ts
    index.ts              # 全断片を appSchema に合流（単一の真実）
  lib/
    supabase/
      query.ts            # スキーマ駆動の型安全クエリエンジン
      client.ts           # $supabaseClient（ブラウザ・Realtime 等の直叩き用 opt-in）
      server.ts           # $supabaseServer（cookie 対応のファクトリ）
      index.ts            # エンジン公開 API の barrel
    utils.ts              # cn など純粋ヘルパー
  integrations/           # tanstack-query provider など、フレームワーク配線
  env.ts                  # t3-env による環境変数（型＋実行時バリデーション）
  router.tsx
```

## 「どこに何を置くか」の規約

| 判断 | 置き場 |
|---|---|
| 汎用の見た目部品（button, input...） | `components/ui/` |
| 特定機能の画面パーツ | `components/<feature>/` |
| サーバーで動かす処理（fetch / mutation） | `server/<resource>.ts` |
| zod スキーマ・取得クエリ | `schemas/<resource>.ts` |
| 楽観的更新などのクライアントロジック | `hooks/use-*.ts` |
| 横断的な純粋ヘルパー | `lib/` |

原則:

- **routes は薄く**。loader で fetch を起動し、ロジックは `server/` `hooks/` `components/` から import するだけ。
- **フォルダは横に並べる**。深い階層は掘らない（`server/todos.ts` であって `server/todos/queries/...` ではない）。
- **環境変数は `env.ts` 経由**。`import.meta.env.X` を直接使わない。

## データフロー

### 読み取り（SSR ファースト）

```
route loader
  → queryClient.ensureQueryData(todosQueryOptions())
    → getTodos()  [serverFn]
      → $supabaseServer()("@select/todos", { filter })
        → postgrest → zod 検証 → Result<Todo[]>
  → コンポーネントは useSuspenseQuery(todosQueryOptions()) で同じキャッシュを購読
```

初回表示はサーバーで fetch 済みのデータがキャッシュに載った状態でレンダリングされる。

### 書き込み（serverFn ＋ 楽観的更新）

```
コンポーネント
  → useToggleTodo().mutate(vars)        [hooks/]
    → onMutate: TanStack Query キャッシュを即時更新（楽観）
    → mutationFn: toggleTodo({ data })  [serverFn]
       → $supabaseServer()("@update/todos", { data, match })
    → onError: スナップショットへ巻き戻し
    → onSettled: invalidateQueries で再同期
```

**mutation の実体はサーバー（serverFn）**だが、即時の UI 反映は「キャッシュ操作」の責務として `onMutate` で行う。これにより検証・認可をサーバーに集約しつつ楽観更新も両立する。

## 認証ガード（保護ルート）

保護したいルートは pathless レイアウトルート `_authed`（先頭 `_` = URL に出ない）の下にまとめる。ガードは `beforeLoad` に 1 度だけ書き、配下ルートが継承する。保護ページを増やすときは `routes/_authed/` にファイルを置くだけでよい。

```
routes/_authed/route.tsx      # beforeLoad で user を確定 → 未ログインは /login へ redirect
routes/_authed/dashboard.tsx  # 配下（URL: /dashboard）。context.user は非 null が保証される
routes/login.tsx              # 未ログイン用。ログイン済みなら遷移先へ redirect
```

`_authed` という名前は任意（`_protected` 等でも可）。意味を持つのは先頭の `_`（pathless）だけ。保護ページが 1 枚だけなら、そのルートに直接 `beforeLoad` を書いてもよい（レイアウト不要）。

```ts
// routes/_authed/route.tsx
beforeLoad: async ({ context, location }) => {
  const user = await context.queryClient.ensureQueryData(userQueryOptions());
  if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
  return { user }; // 配下ルートの context にマージされる
},
```

- **user の取得は `userQueryOptions()`（= `getUser` serverFn）経由**。`ensureQueryData` なので SSR・遷移で二重に叩かず、`use-sign-*` フックのキャッシュ更新と一貫する。
- **行レベルの認可は Supabase RLS が正**。serverFn 側で所有者チェックを書かないのは、RLS（＋ Cookie セッション）を単一の防衛線に寄せているため。ガードは「未ログインを弾く」までを担う。

詳しいクエリ層の仕組みは [data-access.md](./data-access.md) を参照。
