import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

// 未一致 URL、または `notFound()` を throw したときの受け皿。
// router.tsx の defaultNotFoundComponent に配線され、全ルートが継承する。
export function NotFoundComponent() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-bold">ページが見つかりません</h1>
      <p className="text-muted-foreground text-sm">
        お探しのページは存在しないか、移動した可能性があります。
      </p>
      <Button asChild variant="outline">
        <Link to="/">ホームへ</Link>
      </Button>
    </div>
  );
}
