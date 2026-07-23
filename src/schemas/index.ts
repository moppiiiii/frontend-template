import { todosSchema } from "./todos"; // @sample-todos(edit): strip-sample skill がこの合流を除去する。

// アプリ全体のスキーマ。新しいテーブルの断片をここにスプレッドで合流させる。
export const appSchema = {
  ...todosSchema, // @sample-todos(edit)
};

export type AppSchema = typeof appSchema;
