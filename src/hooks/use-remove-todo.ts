import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Todo } from "@/schemas/todos";
import { removeTodo, todosQueryOptions } from "@/server/todos";

/** 楽観的更新（delete）。該当行をキャッシュから即時に取り除く。 */
export function useRemoveTodo() {
  const queryClient = useQueryClient();
  const { queryKey } = todosQueryOptions();

  return useMutation({
    mutationFn: (vars: { id: string }) => removeTodo({ data: vars }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Todo[]>(queryKey);
      queryClient.setQueryData<Todo[]>(queryKey, (old) =>
        old?.filter((t) => t.id !== vars.id),
      );
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
