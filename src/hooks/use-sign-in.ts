import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signIn, userQueryOptions } from "@/server/auth";

// ログイン。成功後はユーザーキャッシュを更新し、ユーザー依存データを再取得させる。
export function useSignIn() {
  const queryClient = useQueryClient();
  const { queryKey } = userQueryOptions();

  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      signIn({ data: vars }),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKey, user);
      // ログイン前後でデータの見え方が変わるため全体を再検証する。
      queryClient.invalidateQueries();
    },
  });
}
