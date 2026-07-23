import { QueryClient } from "@tanstack/react-query";

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // 0 だと SSR で loader が入れたデータがハイドレーション直後に stale 扱いになり、
        // クライアントで即再フェッチが走る（二重フェッチ）。それを防ぐ既定値。
        staleTime: 30_000,
      },
    },
  });

  return {
    queryClient,
  };
}
export default function TanstackQueryProvider() {}
