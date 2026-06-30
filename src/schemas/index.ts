import { todosSchema } from "./todos";

// アプリ全体のスキーマ。新しいテーブルの断片をここにスプレッドで合流させる。
export const appSchema = {
  ...todosSchema,
};

export type AppSchema = typeof appSchema;
