---
name: add-supabase-resource
description: このテンプレートに新しい Supabase 由来のデータアクセス層（zod スキーマ・serverFn・楽観フック）を追加するときに使う。テーブル/リソースの CRUD だけでなく、認証（auth）・ログイン・セッション取得など Supabase を叩く serverFn を足す場合も含む。「テーブルを足して」「リソースを追加」「<名前>の CRUD を作って」「todos と同じパターンで <名前> を作って」「supabase の auth を作って」「認証/ログインを作って」「新しい zod スキーマ/serverFn を足して」等で発火。schema は必ず src/schemas/ に置く（src/server/ に zod を定義しない）、appSchema 合流 → serverFn → 楽観フック → route の規約を守って実装する。
---

# Supabase リソースの追加

このテンプレートのデータアクセス規約に従って、新しいリソース（テーブル）の CRUD を追加する。

## まず読む（正本）

手順とコード雛形の**正本は `docs/adding-a-resource.md`**。設計思想の背景は `docs/data-access.md`。
実装前に必ずこの2つを参照し、既存の `src/schemas/todos.ts` / `src/server/todos.ts` / `src/hooks/use-toggle-todo.ts` を雛形にする。

## 守るべき規約（要点）

1. **スキーマは `src/schemas/<resource>.ts`** に 1 ファイル。
   - 全カラムの `<Name>EntitySchema` を定義 → レスポンスは `.pick()`（必要なら `.extend()` で embed、`.transform()` で camelCase）で派生。
   - `select({ output, select: GET_<NAME>_QUERY, row: <Name>EntitySchema })`。`row` を渡すと filter のカラム型が実テーブル全カラムになる。
   - 操作は `@select|insert|update|delete/<table>` キーで定義。
2. **`src/schemas/index.ts` の `appSchema`** に断片をスプレッド合流（単一の真実）。
3. **serverFn は `src/server/<resource>.ts`** に fetch も mutation も集約。`queryOptions` を併設。
   - `const $supabase = await $supabaseServer()`。セッション水和（`getSession`）はファクトリ内で一元化済みなので、ハンドラ側で `getSession()` を呼ぶ必要はない。
   - mutation はすべて `createServerFn({ method: "POST" })`（delete も POST）。`result.isErr()` で throw。
4. **楽観的更新が要るなら `src/hooks/use-<action>-<resource>.ts`**。
   - `useMutation` の `onMutate`（即時キャッシュ更新）→ `onError`（巻き戻し）→ `onSettled`（invalidate）。
   - クエリキーは `<resource>QueryOptions().queryKey` から取得（ドリフト防止）。
5. **routes は薄く**。loader で `ensureQueryData(<resource>QueryOptions())`、コンポーネントは `useSuspenseQuery` で購読。
6. **コンポーネントは `src/components/<resource>/`**、汎用 UI は `src/components/ui/`。

## 適用範囲の注意

- 単一テーブル CRUD ＋ embed 読み取り（関連表示）＋ 外部キーでの絞り込みは型付きで対応できる。
- 関連テーブルの**列**での型付き filter/order（postgrest の `referencedTable`）は未対応 → `$supabaseServer().raw` に退避する。
- mutation は `void`（`RETURNING` なし）。採番された行が必要なら楽観 temp-id ＋ `onSettled` の再取得で対応。

## 仕上げ

実装後に必ず通す:

```bash
bun run check          # tsgo（型）＋ oxlint ＋ oxfmt --check
bun run format         # oxfmt（整形を書き込む）
```

DB 側のテーブル/カラム/FK が前提条件になる場合は、想定 DDL をスキーマ冒頭のコメントに残すか、ユーザーに確認する。
