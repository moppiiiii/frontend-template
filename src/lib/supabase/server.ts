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
 * Cookie はリクエスト毎なのでモジュール定数にできず、serverFn 内で毎回 `await` する。
 * `.raw` で素のクライアント（auth など）にアクセスできる。
 *
 * ここで一度だけ `getSession()` を呼び、Cookie のトークンを読み込む（必要ならリフレッシュし
 * `setAll` で Cookie を書き戻す）。これをしないと後続クエリに認証セッションが乗らず、
 * RLS 越しに 0 件／拒否になり得る。認証判定ではなく Cookie 水和が目的なので `getUser` ではなく
 * `getSession`（各ハンドラで個別に呼ぶ必要はもう無い）。
 */
export async function $supabaseServer() {
  const client = createSupabaseServerClient();
  await client.auth.getSession();
  const query = createSupabaseClient({ client, schema: appSchema });
  return Object.assign(query, { raw: client });
}
