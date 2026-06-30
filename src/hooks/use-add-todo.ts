import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Todo } from "@/schemas/todos";
import { addTodo, todosQueryOptions } from "@/server/todos";

// 楽観的更新（insert）。id はサーバー採番なので一時 id を振り、onSettled の再取得で置換する。
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
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
