import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

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
  return result.unwrapOr([]);
});

export const todosQueryOptions = () =>
  queryOptions({
    queryKey: ["todos"],
    queryFn: () => getTodos(),
  });

export const addTodo = createServerFn({ method: "POST" })
  .validator(AddTodoInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@insert/todos", {
      data: { title: data.title },
    });
    if (result.isErr()) throw result.error;
  });

export const toggleTodo = createServerFn({ method: "POST" })
  .validator(ToggleTodoInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@update/todos", {
      data: { completed: data.completed },
      match: { id: data.id },
    });
    if (result.isErr()) throw result.error;
  });

export const removeTodo = createServerFn({ method: "POST" })
  .validator(RemoveTodoInput)
  .handler(async ({ data }) => {
    const $supabase = await $supabaseServer();
    const result = await $supabase("@delete/todos", { match: { id: data.id } });
    if (result.isErr()) throw result.error;
  });
