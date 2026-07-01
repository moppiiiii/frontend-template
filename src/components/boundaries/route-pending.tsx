import { Loader2 } from "lucide-react";

// ローダー待ち（defaultPendingMs 超過）の間に出す骨組み。
// router.tsx の defaultPendingComponent に配線され、全ルートが継承する。
// エラーではなく読み込み状態だが、router の境界フォールバックという役割で
// root-error / not-found と同じ components/boundaries/ に同居させている。
// SSR ファースト（loader で ensureQueryData 済み）の初回表示では通常出ず、
// 遷移時やキャッシュ未ヒット時のフォールバックとして働く。
export function RoutePending() {
  return (
    <div
      className="text-muted-foreground flex items-center justify-center gap-2 p-16"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-5 animate-spin" />
      <span className="text-sm">読み込み中…</span>
    </div>
  );
}
