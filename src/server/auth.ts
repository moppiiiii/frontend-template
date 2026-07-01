import type { User } from "@supabase/supabase-js";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import { $supabaseServer } from "@/lib/supabase/server";
import { CredentialsSchema } from "@/schemas/auth";

// 認証は型安全クエリエンジン（appSchema）を通さず、素のクライアント（.raw.auth）で扱う。
// 1 リソースと同じく fetch / mutation（どちらも serverFn）を 1 ファイルにまとめる。

/**
 * 現在のユーザーを取得する。
 * `getUser()` は Cookie のトークンを認証サーバーで検証するため、`getSession()` より安全。
 * 未ログインなら null。
 */
export const getUser = createServerFn().handler(
  async (): Promise<User | null> => {
    const $supabase = $supabaseServer();
    const {
      data: { user },
    } = await $supabase.raw.auth.getUser();
    return user ?? null;
  },
);

export const userQueryOptions = () =>
  queryOptions({
    queryKey: ["auth", "user"],
    queryFn: () => getUser(),
  });

export const signIn = createServerFn({ method: "POST" })
  .validator(CredentialsSchema)
  .handler(async ({ data }): Promise<User> => {
    const $supabase = $supabaseServer();
    const { data: result, error } = await $supabase.raw.auth.signInWithPassword(
      {
        email: data.email,
        password: data.password,
      },
    );
    if (error) throw error;
    return result.user;
  });

export const signUp = createServerFn({ method: "POST" })
  .validator(CredentialsSchema)
  .handler(async ({ data }): Promise<User | null> => {
    const $supabase = $supabaseServer();
    const { data: result, error } = await $supabase.raw.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (error) throw error;
    // メール確認が有効な場合、確認までは user が返っても session は null。
    return result.user;
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const $supabase = $supabaseServer();
  const { error } = await $supabase.raw.auth.signOut();
  if (error) throw error;
});
