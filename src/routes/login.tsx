import { createFileRoute, redirect } from "@tanstack/react-router";
import * as z from "zod";

import { LoginForm } from "@/components/auth/login-form";
import { userQueryOptions } from "@/server/auth";

// ガードから渡ってくる遷移先。未指定なら / （Todos ホーム）。
const SearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
  validateSearch: SearchSchema,
  beforeLoad: async ({ context, search }) => {
    // すでにログイン済みなら遷移先へ飛ばす（ログイン画面を見せない）。
    const user = await context.queryClient.ensureQueryData(userQueryOptions());
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
