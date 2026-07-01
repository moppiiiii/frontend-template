import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signOut, userQueryOptions } from "@/server/auth";

// ログアウト。ユーザーキャッシュをクリアし、ユーザー依存データを再取得させる。
export function useSignOut() {
  const queryClient = useQueryClient();
  const { queryKey } = userQueryOptions();

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      queryClient.invalidateQueries();
    },
  });
}
