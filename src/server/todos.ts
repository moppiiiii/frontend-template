// @sample-todos: todo サンプルの一部。strip-sample skill で削除される。
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { toClientError, unwrapForClient } from "@/lib/errors";
import { $supabaseServer } from "@/lib/supabase/server";
import {
  AddTodoInput,
  RemoveTodoInput,
  ToggleTodoInput,
  type Todo,
} from "@/schemas/todos";

// 1 リソースの fetch / mutation（どちらも serverFn）を 1 ファイルにまとめる。

export const getTodos = createServerFn().handler(async (): Promise<Todo[]> => {
  const $supabase = await $supabaseServer();
  const result = await $supabase("@select/todos", {
    filter: (q) => q.order("created_at", { ascending: false }),
  });
  // unwrapOr で既定値に落とさない（障害が「空一覧」に化け、エラー境界に届かなくなる）。
  return unwrapForClient(result, "Todo を取得できませんでした。");
});

export const todosQueryOptions = () =>
  queryOptions({
    queryKey: ["todos"],
    queryFn: () => getTodos(),
  });

export const addTodo = createServerFn({ method: "POST" })
  .validator(AddTodoInput)
  .handler(async ({ data }): Promise<Todo> => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@insert/todos", {
      data: { title: data.title },
    });
    const [todo] = unwrapForClient(result, "Todo を追加できませんでした。");
    if (!todo) {
      throw toClientError(
        "Todo を追加できませんでした。",
        "insert returned no rows",
      );
    }
    return todo;
  });

export const toggleTodo = createServerFn({ method: "POST" })
  .validator(ToggleTodoInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@update/todos", {
      data: { completed: data.completed },
      match: { id: data.id },
    });
    unwrapForClient(result, "Todo を更新できませんでした。");
  });

export const removeTodo = createServerFn({ method: "POST" })
  .validator(RemoveTodoInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@delete/todos", { match: { id: data.id } });
    unwrapForClient(result, "Todo を削除できませんでした。");
  });
