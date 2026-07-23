---
name: strip-sample
description: このテンプレートから todo サンプル一式を取り除き、新規プロジェクトを始められる素の状態にする。「サンプルを消して」「todo サンプルを削除」「テンプレートを初期化して」「新規プロジェクト用にクリーンアップして」等で発火。auth・データアクセス層・境界 UI などテンプレート本体は残し、`@sample-todos` マーカーの付いたファイルだけを削除・置換する。
---

# todo サンプルの削除

テンプレート同梱の todo サンプル（schemas / server / hooks / components / route）を取り除く。auth（login・`_authed` ガード・dashboard・`use-sign-*`）、データアクセスエンジン（`lib/supabase/`）、境界 UI はテンプレート本体なので**消さない**。

## 対象の特定

サンプルは全ファイルに `@sample-todos` マーカーが付いている。まず列挙して現状を確認する:

```bash
grep -rn "@sample-todos" src supabase
```

マーカーは 3 種類:

- `@sample-todos` — ファイルごと削除する。
- `@sample-todos(replace)` — ファイルは残し、中身をプレースホルダーへ置き換える（下記）。
- `@sample-todos(edit)` — その行（import とスプレッド）だけ除去する。

grep の結果がこの手順書の想定と食い違う場合（マーカーが増えている等）は、マーカーの指示に従うことを優先する。

## 手順

1. **`@sample-todos` マーカーのファイルを削除する**（現時点の一覧）:
   - `src/schemas/todos.ts`
   - `src/server/todos.ts`
   - `src/hooks/use-add-todo.ts`
   - `src/hooks/use-remove-todo.ts`
   - `src/hooks/use-toggle-todo.ts`
   - `src/hooks/use-toggle-todo.test.tsx`
   - `src/components/todos/`（ディレクトリごと）
   - `supabase/migrations/20260724000000_create_todos.sql`（`supabase/migrations/` ディレクトリ自体は `.gitkeep` ごと残す）

2. **`src/schemas/index.ts` を空の appSchema に戻す**（`@sample-todos(edit)` の行を除去）:

   ```ts
   // アプリ全体のスキーマ。新しいテーブルの断片をここにスプレッドで合流させる。
   export const appSchema = {};

   export type AppSchema = typeof appSchema;
   ```

3. **`src/routes/_authed/index.tsx` をプレースホルダーへ置き換える**（`@sample-todos(replace)`）:

   ```tsx
   import { createFileRoute } from "@tanstack/react-router";

   export const Route = createFileRoute("/_authed/")({
     component: Home,
   });

   function Home() {
     return (
       <div className="mx-auto max-w-xl space-y-6 p-8">
         <h1 className="text-3xl font-bold">Home</h1>
         <p className="text-muted-foreground">
           最初の画面をここから作る（add-route / add-supabase-resource skill
           を参照）。
         </p>
       </div>
     );
   }
   ```

4. **検証する**:

   ```bash
   bun run generate-routes   # routeTree.gen.ts を再生成
   bun run format            # oxfmt（置き換えたファイルの整形ずれを吸収）
   bun run check             # tsgo ＋ oxlint ＋ oxfmt --check
   bun run test              # 残るテスト（engine / auth）が通ること
   grep -rn "@sample-todos" src supabase   # 出力ゼロであること
   ```

   `grep -rn "todos" src` に残ってよいのは docs 類の説明文中の例示のみ。src 配下にコード参照が残っていたら消し漏れ。

5. **この skill 自身を片付ける**（サンプルが無くなれば不要）:
   - `.claude/skills/strip-sample/` を削除。
   - `CLAUDE.md` の「サンプル削除」節と、`README.md` の skill 一覧から `strip-sample` の行を削除。

## 注意

- `docs/` と `README.md` の本文には todos を**例として**言及する箇所が残るが、実ファイルに依存しない書き方になっているため修正不要。
- サンプル migration を適用済みの Supabase 環境がある場合、DB 側の todos / categories テーブルは自動では消えない。必要なら drop する migration の作成をユーザーに提案する。
- 削除はワーキングツリー上で行い、コミットはユーザーに確認してから。
