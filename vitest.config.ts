import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// アプリ本体の vite.config.ts（cloudflare / tanstackStart プラグイン）を読み込まず、
// 純粋なユニットテスト向けの最小構成。パスエイリアスだけ解決する。
const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": src,
      "#": src,
    },
  },
});
