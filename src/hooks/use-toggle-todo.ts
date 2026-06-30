import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Todo } from "@/schemas/todos";
import { todosQueryOptions, toggleTodo } from "@/server/todos";

// 楽観的更新の基本形（update）。mutation は serverFn 経由だが、
// 即時の UI 反映は onMutate でのキャッシュ操作として行う。これが他フックの雛形。
export function useToggleTodo() {
  const queryClient = useQueryClient();
  const { queryKey } = todosQueryOptions();

  return useMutation({
    mutationFn: (vars: { id: string; completed: boolean }) =>
      toggleTodo({ data: vars }),
    onMutate: async (vars) => {
      // 進行中の refetch を止めて楽観値が上書きされないようにする。
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Todo[]>(queryKey);
      queryClient.setQueryData<Todo[]>(queryKey, (old) =>
        old?.map((t) =>
          t.id === vars.id ? { ...t, completed: vars.completed } : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      // 失敗したらスナップショットへ巻き戻す。
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      // 成否に関わらずサーバーの真実と再同期する。
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
