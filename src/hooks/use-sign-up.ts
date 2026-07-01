import { useMutation, useQueryClient } from "@tanstack/react-query";

import { signUp, userQueryOptions } from "@/server/auth";

// サインアップ。メール確認が有効な場合、確認完了までは session が張られない点に注意。
export function useSignUp() {
  const queryClient = useQueryClient();
  const { queryKey } = userQueryOptions();

  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      signUp({ data: vars }),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKey, user);
      queryClient.invalidateQueries();
    },
  });
}
