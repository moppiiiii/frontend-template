import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AddTodoForm } from "@/components/todos/add-todo-form";
import { TodoList } from "@/components/todos/todo-list";
import { todosQueryOptions } from "@/server/todos";

export const Route = createFileRoute("/")({
  // SSR: loader でサーバー fetch 済みのデータをキャッシュに載せる。
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(todosQueryOptions()),
  component: Home,
});

function Home() {
  // loader と同じキャッシュを購読。mutation の onMutate 更新で即再描画される。
  const { data: todos } = useSuspenseQuery(todosQueryOptions());

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-3xl font-bold">Todos</h1>
      <AddTodoForm />
      <TodoList todos={todos} />
    </div>
  );
}
