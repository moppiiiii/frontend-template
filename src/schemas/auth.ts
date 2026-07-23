import * as z from "zod";

// 認証は型安全クエリエンジン（appSchema）を通さず `.raw.auth` で扱うため、
// ここには操作キー（@select/... 等）はなく、入力バリデーション用の zod のみを置く。
// よって schemas/index.ts の appSchema への合流も行わない。

export const CredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type Credentials = z.infer<typeof CredentialsSchema>;

// /login の search（ガードから渡ってくる遷移先）。未指定なら / へ。
// オープンリダイレクト対策: アプリ内パス（"/" 始まり）だけを許可する。
// "//evil.com"（プロトコル相対）や "/\evil.com"（ブラウザが \ を / に正規化）は
// 外部へ飛べてしまうため弾き、不正値は未指定扱いに落とす。
export const LoginSearchSchema = z.object({
  redirect: z
    .string()
    .regex(/^\/(?![/\\])/)
    .optional()
    .catch(undefined),
});
