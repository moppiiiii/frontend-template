import * as z from "zod";

// 認証は型安全クエリエンジン（appSchema）を通さず `.raw.auth` で扱うため、
// ここには操作キー（@select/... 等）はなく、入力バリデーション用の zod のみを置く。
// よって schemas/index.ts の appSchema への合流も行わない。

export const CredentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export type Credentials = z.infer<typeof CredentialsSchema>;
