---
name: add-route
description: このテンプレートに新しい画面ルート（TanStack Start のファイルルート）を追加するときに使う。「ページを足して」「<パス>のルートを作って」「<名前>画面を追加」「認証必須のページを作って」等で発火。薄い route ＋ loader で fetch 起動 ＋ useSuspenseQuery 購読、search バリデーション、認証ガードの規約を守って実装する。
---

# ルート（画面）の追加

TanStack Start のファイルベースルーティング規約と、このテンプレートの「routes は薄く」原則に従って画面を追加する。

## まず読む（正本）

- 配置規約とデータフローの正本は **`docs/architecture.md`**（「どこに何を置くか」「routes は薄く」「データフロー」）。
- 既存の `src/routes/index.tsx`（loader + `useSuspenseQuery` 購読）と `src/routes/__root.tsx` を雛形にする。
- データ層が絡むなら先に `add-supabase-resource` を回し、route はその `queryOptions` を呼ぶだけにする。

## 守るべき規約（要点）

1. **ファイルは `src/routes/` に平置き**。深い階層は掘らない。
   - URL `/about` → `src/routes/about.tsx`、`/settings/profile` → `src/routes/settings.profile.tsx`（ドット区切り）。
   - 動的セグメントは `$` 接頭辞: `/todos/$id` → `src/routes/todos.$id.tsx`。
   - レイアウト共有が要る場合のみフォルダ＋`route.tsx`。まずは平置きで足りる。
   - `routeTree.gen.ts` は **自動生成**。手で触らない（`bun run generate-routes` / dev / build が再生成する）。

2. **route は薄く**。`createFileRoute` に載せるのは loader（fetch 起動）と画面シェルのみ。
   ロジック・データ取得は `server/` `hooks/` `components/` から import する。

3. **データ取得は loader で起動 → コンポーネントで `useSuspenseQuery` 購読**（`index.tsx` と同型）。

   ```tsx
   import { useSuspenseQuery } from "@tanstack/react-query";
   import { createFileRoute } from "@tanstack/react-router";

   import { FooView } from "@/components/foo/foo-view";
   import { fooQueryOptions } from "@/server/foo";

   export const Route = createFileRoute("/foo")({
     // SSR: loader でサーバー fetch 済みのデータをキャッシュに載せる。
     loader: ({ context }) =>
       context.queryClient.ensureQueryData(fooQueryOptions()),
     component: FooPage,
   });

   function FooPage() {
     const { data: foo } = useSuspenseQuery(fooQueryOptions());
     return <FooView foo={foo} />;
   }
   ```

   - `context.queryClient` は `__root.tsx` の `createRootRouteWithContext<MyRouterContext>` で配線済み。
   - データの無い静的ページは loader 省略で `component` だけでよい。

4. **画面の中身は `src/components/<feature>/`** に置く。汎用 UI は `src/components/ui/`。route 本体に JSX を肥大させない。

5. **import は `@/` エイリアス**（`@/server/...` `@/components/...`）。環境変数は必ず `@/env` 経由（`import.meta.env.X` を直接使わない）。

## search params（クエリ文字列）

型安全に扱う場合は zod でバリデーションし、loader / コンポーネントから型付きで読む。

```tsx
import { z } from "zod";

const SearchSchema = z.object({
  page: z.number().int().min(1).catch(1),
  q: z.string().optional(),
});

export const Route = createFileRoute("/foo")({
  validateSearch: SearchSchema,
  // search を fetch のキーに含めるなら loaderDeps で依存を宣言する。
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(fooQueryOptions(deps)),
  component: FooPage,
});

// コンポーネント側
const { page, q } = Route.useSearch();
```

- 既定値が要る項目は `.catch(...)` で不正値をフォールバックさせる（画面を壊さない）。
- 遷移は `<Link to="/foo" search={{ page: 2 }} />` または `navigate({ search })` で型付きに。

## 認証ガード（ログイン必須ページ）

`beforeLoad` でセッションを確認し、無ければリダイレクトする。判定はサーバー側のセッションを正とする（`src/server/todos.ts` の `getSession()` パターンと同じ情報源を使う）。

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ location }) => {
    const session = await getSession(); // server fn 経由でセッション取得
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(dashboardQueryOptions()),
  component: Dashboard,
});
```

- セッション取得用の serverFn がまだ無ければ、`src/server/auth.ts` 等に切り出してから使う（route 内に Supabase クライアントを直書きしない）。
- 複数ページで共有するガードは、親レイアウトルートの `beforeLoad` に上げて子で継承させる。

## エラー / ローディング表示

route 単位で出し分ける場合に指定する（未指定なら親 → `__root` のものが使われる）。

```tsx
export const Route = createFileRoute("/foo")({
  loader: ...,
  pendingComponent: () => <FooSkeleton />,
  errorComponent: ({ error }) => <FooError error={error} />,
  component: FooPage,
});
```

## 仕上げ

実装後に必ず通す:

```bash
bun run check          # tsgo（型）＋ oxlint ＋ oxfmt --check
bun run format         # oxfmt（整形を書き込む）
```

- 追加直後に `bun run generate-routes`（`tsr generate`）を走らせて `routeTree.gen.ts` を更新し、型が通ることを確認する。dev / build でも再生成される。
- zod・`@/` エイリアスは導入済み（`zod` ^4 / tsconfig `paths`）。それ以外の新規依存は入れる前にユーザーへ確認する。
