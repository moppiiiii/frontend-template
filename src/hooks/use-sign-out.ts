import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signOut, userQueryOptions } from "@/server/auth";

// ログアウト。キャッシュを全消去する（invalidate だと非アクティブな
// 前ユーザーのデータが GC まで残り、共有端末で持ち越されるため）。
export function useSignOut() {
  const queryClient = useQueryClient();
  const { queryKey } = userQueryOptions();

  return useMutation({
    mutationFn: () => signOut(),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(queryKey, null);
    },
  });
}
