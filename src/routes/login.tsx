import { createFileRoute, redirect } from "@tanstack/react-router";
import * as z from "zod";

import { LoginForm } from "@/components/auth/login-form";
import { userQueryOptions } from "@/server/auth";

// ガードから渡ってくる遷移先。未指定なら / （Todos ホーム）。
// オープンリダイレクト対策: アプリ内パス（"/" 始まり）だけを許可する。
// "//evil.com"（プロトコル相対）や "/\evil.com"（ブラウザが \ を / に正規化）は
// 外部へ飛べてしまうため弾き、不正値は未指定扱いに落とす。
const SearchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])/)
    .optional()
    .catch(undefined),
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
