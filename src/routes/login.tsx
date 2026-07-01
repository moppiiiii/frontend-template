import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn } from "@/hooks/use-sign-in";
import { useSignUp } from "@/hooks/use-sign-up";
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
      throw redirect({ href: search.redirect ?? "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const dest = redirectTo ?? "/";
  const pending = signIn.isPending || signUp.isPending;
  const error = signIn.error ?? signUp.error;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    signIn.mutate(
      { email, password },
      { onSuccess: () => navigate({ href: dest }) },
    );
  };

  const handleSignUp = () => {
    signUp.mutate(
      { email, password },
      { onSuccess: () => navigate({ href: dest }) },
    );
  };

  return (
    <div className="mx-auto max-w-sm space-y-6 p-8">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error.message}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            ログイン
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={handleSignUp}
          >
            新規登録
          </Button>
        </div>
      </form>
    </div>
  );
}
