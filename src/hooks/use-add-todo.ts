// @sample-todos: todo サンプルの一部。strip-sample skill で削除される。
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Todo } from "@/schemas/todos";
import { addTodo, todosQueryOptions } from "@/server/todos";

// 楽観的更新（insert）。id はサーバー採番なので一時 id を振り、
// onSuccess で returning の行（実 id）と置換する。
export function useAddTodo() {
  const queryClient = useQueryClient();
  const { queryKey } = todosQueryOptions();

  return useMutation({
    mutationFn: (vars: { title: string }) => addTodo({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Todo[]>(queryKey);
      const optimistic: Todo = {
        id: `optimistic-${crypto.randomUUID()}`,
        title: vars.title,
        completed: false,
        createdAt: new Date().toISOString(),
        category: null,
      };
      queryClient.setQueryData<Todo[]>(queryKey, (old) => [
        optimistic,
        ...(old ?? []),
      ]);
      return { previous, optimisticId: optimistic.id };
    },
    onSuccess: (created, _vars, context) => {
      queryClient.setQueryData<Todo[]>(queryKey, (old) =>
        old?.map((t) => (t.id === context.optimisticId ? created : t)),
      );
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      // 並行 mutation 中の invalidate は楽観値を上書きするため、最後の 1 件だけ再同期する。
      if (queryClient.isMutating() === 1) {
        queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}
