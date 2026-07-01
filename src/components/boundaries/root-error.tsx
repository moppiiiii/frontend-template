import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

// ルート配下で throw された例外（serverFn の Result → throw を含む）の受け皿。
// router.tsx の defaultErrorComponent に配線され、全ルートが継承する。
// 注意: `redirect()`（未ログイン→/login 等）は例外ではなく制御フローなので
// ここには落ちてこない（TanStack Router が別扱いする）。
export function RootErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-bold">問題が発生しました</h1>
      <p className="text-muted-foreground text-sm break-words">
        {error.message || "予期しないエラーが発生しました。"}
      </p>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            // 例外境界をリセットし、ローダーを再実行して再取得する。
            reset();
            router.invalidate();
          }}
        >
          再試行
        </Button>
        <Button asChild variant="outline">
          <Link to="/">ホームへ</Link>
        </Button>
      </div>
    </div>
  );
}
