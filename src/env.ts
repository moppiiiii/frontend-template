import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  /**
   * サーバー専用変数の注意（Cloudflare Workers）:
   * `runtimeEnv` が `import.meta.env` のため、実行時に参照できるのはビルド時に
   * インライン化される `VITE_` 接頭辞のクライアント変数だけ。ここに足した
   * サーバー専用変数は Workers ランタイムでは黙って undefined になる。
   * シークレット（例: Supabase の secret key）を扱うときは wrangler の
   * binding / secret から取得する構成に変えること（.dev.vars ＋ `wrangler secret`）。
   */
  server: {
    SERVER_URL: z.url().optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_SUPABASE_URL: z.url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: import.meta.env,

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
});
