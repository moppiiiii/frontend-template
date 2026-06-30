// エンジンとスキーマヘルパーの公開 API。
// クライアント実体は環境跨ぎの誤 import を防ぐため re-export しない
// （`$supabaseServer` は ./server、`$supabaseClient` は ./client から直接 import）。

export type { SupabaseError, SupabaseSchemaMap } from "./query";
export {
  createSupabaseClient,
  createSupabaseSchema,
  deleteFrom,
  insert,
  SupabaseQueryError,
  SupabaseValidationError,
  select,
  update,
  upsert,
} from "./query";
