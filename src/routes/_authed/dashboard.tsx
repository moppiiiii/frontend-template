import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

export const Route = createFileRoute("/_authed/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  // ガード（_authed）が context にマージした user。非 null。
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const signOut = useSignOut();

  return (
    <div className="mx-auto max-w-xl space-y-6 p-8">
      <h1 className="text-3xl font-bold">ダッシュボード</h1>
      <p className="text-muted-foreground">
        ようこそ、<span className="font-medium">{user.email}</span> さん
      </p>
      <Button
        variant="outline"
        disabled={signOut.isPending}
        onClick={() =>
          signOut.mutate(undefined, {
            onSuccess: () => navigate({ to: "/login" }),
          })
        }
      >
        ログアウト
      </Button>
    </div>
  );
}
