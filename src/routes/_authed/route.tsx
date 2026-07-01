import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { userQueryOptions } from "@/server/auth";

// 認証ガード（pathless レイアウト）。配下ルートは context.user を非 null で使える。
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(userQueryOptions());
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user }; // 配下ルートの context にマージされる
  },
  component: () => <Outlet />,
});
