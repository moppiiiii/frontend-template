# リソースの追加手順

新しいテーブル（例: `posts`）を足すときの流れ。以下のコード例がそのまま雛形になる（todo サンプルが残っていれば動く実例としても参照できる）。

## 1. スキーマを定義する — `src/schemas/posts.ts`

```ts
import * as z from "zod";
import {
  createSupabaseSchema,
  deleteFrom,
  insert,
  select,
  update,
} from "@/lib/supabase/query";

export const GET_POSTS_QUERY = "id, title, body, created_at";

// 全カラム（filter のカラム型はこれ由来）
export const PostEntitySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// レスポンス（pick → 必要なら transform で camelCase）
export const PostResponseSchema = PostEntitySchema.pick({
  id: true,
  title: true,
  body: true,
  created_at: true,
}).transform((row) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
}));

export type Post = z.infer<typeof PostResponseSchema>;

// API リクエスト（serverFn の入力契約）は名前付きで置き、操作 input と
// serverFn の `.validator()` の両方から共有する（src/server/ に zod を書かない）。
export const AddPostInput = z.object({ title: z.string().min(1), body: z.string() });
export const UpdatePostInput = z.object({ title: z.string().min(1).optional() });
export const RemovePostInput = z.object({ id: z.string().uuid() });

export const postsSchema = createSupabaseSchema({
  "@select/posts": select({
    output: z.array(PostResponseSchema),
    select: GET_POSTS_QUERY,
    row: PostEntitySchema,
  }),
  "@insert/posts": insert({ input: AddPostInput }),
  "@update/posts": update({
    input: UpdatePostInput,
    row: PostEntitySchema, // match を Partial<Row> で型付け（カラム名・値のタイポを弾く）
  }),
  "@delete/posts": deleteFrom({ row: PostEntitySchema }),
});
```

## 2. appSchema に合流させる — `src/schemas/index.ts`

```ts
import { postsSchema } from "./posts";
import { todosSchema } from "./todos";

export const appSchema = {
  ...todosSchema,
  ...postsSchema, // ← 追加
};
```

## 3. serverFn を書く — `src/server/posts.ts`

```ts
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { unwrapForClient } from "@/lib/errors";
import { $supabaseServer } from "@/lib/supabase/server";
import { AddPostInput, type Post } from "@/schemas/posts";

export const getPosts = createServerFn().handler(async (): Promise<Post[]> => {
  const $supabase = await $supabaseServer();
  const result = await $supabase("@select/posts", {
    filter: (q) => q.order("created_at", { ascending: false }),
  });
  return result.unwrapOr([]);
});

export const postsQueryOptions = () =>
  queryOptions({ queryKey: ["posts"], queryFn: () => getPosts() });

// .validator は schemas/ の名前付きスキーマを参照するだけ（zod をここで定義しない）。
export const addPost = createServerFn({ method: "POST" })
  .validator(AddPostInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@insert/posts", { data });
    unwrapForClient(result, "Post を追加できませんでした。");
  });
```

> mutation はすべて `method: "POST"`（serverFn は GET/POST のみ。delete も POST）。
> serverFn の `.validator()` に渡す zod は `schemas/` に名前付きで置き、ここでは import して参照するだけにする（`src/server/` に zod を定義しない）。
> 失敗した `Result` は `throw result.error` せず `unwrapForClient`（`@/lib/errors`）で処理する。データ層のエラーにはテーブル名等の内部情報が含まれるため、詳細はサーバーログへ、クライアントへはユーザー向け文言だけを投げる。

## 4.（必要なら）楽観的更新フック — `src/hooks/use-add-post.ts`

`onMutate` でキャッシュを即時更新 → `onError` で巻き戻し → `onSettled` で `invalidateQueries` の三段構え。クエリキーは `postsQueryOptions().queryKey` から取得してドリフトを防ぐ（todo サンプルが残っていれば `use-toggle-todo.ts` が実例）。

楽観フローには「serverFn をモックして即時反映 → 失敗で巻き戻し」を検証する回帰テストを添えると安全（`src/hooks/use-sign-in.test.tsx` がモックの切り離し方の実例）。

**作成/編集フォームを足すとき**は `@tanstack/react-form`（`useForm` ＋ `form.Field`）で書き、検証は `schemas/` の zod（例: `AddPostInput`）を `validators` に渡して共有する。素の `useState` で値を持たない。フォーム本体は `components/<resource>/` に置き、route は薄く保つ。詳細と雛形は [architecture.md](./architecture.md#フォーム)（`src/components/auth/login-form.tsx`）を参照。

## 5. ルートで使う — `src/routes/posts.tsx`

```ts
export const Route = createFileRoute("/posts")({
  loader: ({ context }) => context.queryClient.ensureQueryData(postsQueryOptions()),
  component: PostsPage,
});

function PostsPage() {
  const { data: posts } = useSuspenseQuery(postsQueryOptions());
  // ...
}
```

> ログイン必須のリソースなら route は `src/routes/_authed/posts.tsx`（URL: `/posts`）に置く。
> `_authed/route.tsx` のガードを継承するので、route 側にガードは書かない（[architecture.md](./architecture.md#認証ガード保護ルート) 参照）。

## チェックリスト

- [ ] `schemas/<resource>.ts`（Entity → Response、操作断片）
- [ ] `schemas/index.ts` の `appSchema` に合流
- [ ] `server/<resource>.ts`（serverFn ＋ queryOptions）
- [ ] 必要なら `hooks/use-*.ts`（楽観的更新）
- [ ] `components/<resource>/` と `routes/`
- [ ] `bun run check`（tsgo ＋ oxlint ＋ oxfmt）が通る
