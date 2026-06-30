import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { env } from "@/env";
import { appSchema } from "@/schemas";
import { createSupabaseClient } from "./query";

/**
 * リクエストの Cookie を読み書きするサーバークライアント。
 * `setAll` は必須（未実装だとトークンリフレッシュ後の Cookie を書き戻せずセッションが切れる）。
 */
function createSupabaseServerClient() {
  return createServerClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(getCookies() ?? {}).map(([name, value]) => ({
            name,
            value: value ?? "",
          }));
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options);
          }
        },
      },
    },
  );
}

/**
 * スキーマ束縛済みのサーバー向けクライアントを生成するファクトリ。
 * Cookie はリクエスト毎なのでモジュール定数にできず、serverFn 内で毎回呼ぶ。
 * `.raw` で素のクライアント（auth など）にアクセスできる。
 */
export function $supabaseServer() {
  const client = createSupabaseServerClient();
  const query = createSupabaseClient({ client, schema: appSchema });
  return Object.assign(query, { raw: client });
}
