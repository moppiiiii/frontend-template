# リソースの追加手順

新しいテーブル（例: `posts`）を足すときの流れ。`todos` がそのまま雛形になる。

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

export const postsSchema = createSupabaseSchema({
  "@select/posts": select({
    output: z.array(PostResponseSchema),
    select: GET_POSTS_QUERY,
    row: PostEntitySchema,
  }),
  "@insert/posts": insert({ input: z.object({ title: z.string().min(1), body: z.string() }) }),
  "@update/posts": update({ input: z.object({ title: z.string().min(1).optional() }) }),
  "@delete/posts": deleteFrom(),
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
import * as z from "zod";
import { $supabaseServer } from "@/lib/supabase/server";
import type { Post } from "@/schemas/posts";

export const getPosts = createServerFn().handler(async (): Promise<Post[]> => {
  const $supabase = $supabaseServer();
  await $supabase.raw.auth.getSession();
  const result = await $supabase("@select/posts", {
    filter: (q) => q.order("created_at", { ascending: false }),
  });
  return result.unwrapOr([]);
});

export const postsQueryOptions = () =>
  queryOptions({ queryKey: ["posts"], queryFn: () => getPosts() });

export const addPost = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().min(1), body: z.string() }))
  .handler(async ({ data }) => {
    const $supabase = $supabaseServer();
    await $supabase.raw.auth.getSession();
    const result = await $supabase("@insert/posts", { data });
    if (result.isErr()) throw result.error;
  });
```

> mutation はすべて `method: "POST"`（serverFn は GET/POST のみ。delete も POST）。

## 4.（必要なら）楽観的更新フック — `src/hooks/use-add-post.ts`

`use-toggle-todo.ts` を雛形に、`onMutate` でキャッシュを即時更新 → `onError` で巻き戻し → `onSettled` で `invalidateQueries`。クエリキーは `postsQueryOptions().queryKey` から取得してドリフトを防ぐ。

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

## チェックリスト

- [ ] `schemas/<resource>.ts`（Entity → Response、操作断片）
- [ ] `schemas/index.ts` の `appSchema` に合流
- [ ] `server/<resource>.ts`（serverFn ＋ queryOptions）
- [ ] 必要なら `hooks/use-*.ts`（楽観的更新）
- [ ] `components/<resource>/` と `routes/`
- [ ] `bunx tsc --noEmit` と `bun run check`（oxlint ＋ oxfmt）が通る
