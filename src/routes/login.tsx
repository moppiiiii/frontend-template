import { createFileRoute, redirect } from "@tanstack/react-router";

import { LoginForm } from "@/components/auth/login-form";
import { LoginSearchSchema } from "@/schemas/auth";
import { userQueryOptions } from "@/server/auth";

export const Route = createFileRoute("/login")({
  // オープンリダイレクト対策込みの検証は schemas/auth.ts（LoginSearchSchema）を参照。
  validateSearch: LoginSearchSchema,
  beforeLoad: async ({ context, search }) => {
    // すでにログイン済みなら遷移先へ飛ばす（ログイン画面を見せない）。
    const user = await context.queryClient.ensureQueryData({
      ...userQueryOptions(),
      revalidateIfStale: true,
    });
    if (user) {
      throw redirect({ to: search.redirect ?? "/" });
    }
  },
  component: LoginPage,
});

// route は薄く保つ。search を読んでフォーム（components/auth/）へ渡すだけ。
function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch();
  return <LoginForm redirectTo={redirectTo} />;
}
