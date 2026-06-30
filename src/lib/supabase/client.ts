import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/env";
import { appSchema } from "@/schemas";

import { createSupabaseClient } from "./query";

/** ブラウザ用の生クライアント。直叩き（Realtime 等）が要るときだけ使う。 */
export const supabaseBrowser = createBrowserClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * スキーマ束縛済みのブラウザ向けクライアント。
 * データ取得/更新の既定経路は serverFn（`src/server/`）。これはその例外用。
 */
export const $supabaseClient = createSupabaseClient({
  client: supabaseBrowser,
  schema: appSchema,
});
