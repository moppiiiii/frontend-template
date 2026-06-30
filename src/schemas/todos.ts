import * as z from "zod";

import {
  createSupabaseSchema,
  deleteFrom,
  insert,
  select,
  update,
} from "@/lib/supabase/query";

// 想定: todos.category_id → categories.id（FK）。embed で categories を一緒に取る。
const CategorySchema = z.object({ id: z.string().uuid(), name: z.string() });

// テーブルの全カラム。filter のカラム型はこれ由来になる。
export const TodoEntitySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  completed: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  category_id: z.string().uuid().nullable(),
});

// embed 込みの取得カラム。`category:categories(...)` で関連を一緒に取る。
export const GET_TODOS_QUERY =
  "id, title, completed, created_at, category:categories(id, name)";

// レスポンス: フラット列は entity から pick、関連は extend、最後に camelCase へ変換。
export const TodoResponseSchema = TodoEntitySchema.pick({
  id: true,
  title: true,
  completed: true,
  created_at: true,
})
  .extend({ category: CategorySchema.nullable() })
  .transform((row) => ({
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at,
    category: row.category,
  }));

export type Todo = z.infer<typeof TodoResponseSchema>;

// 操作の単一定義。サーバー / ブラウザ双方がこれを共有する。
export const todosSchema = createSupabaseSchema({
  "@select/todos": select({
    output: z.array(TodoResponseSchema),
    select: GET_TODOS_QUERY,
    // filter は実テーブルの全カラムで型付け（例: q.eq("category_id", id) も効く）。
    row: TodoEntitySchema,
  }),
  "@insert/todos": insert({
    input: z.object({ title: z.string().min(1) }),
  }),
  "@update/todos": update({
    input: z.object({
      title: z.string().min(1).optional(),
      completed: z.boolean().optional(),
    }),
  }),
  "@delete/todos": deleteFrom(),
});
