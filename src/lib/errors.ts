import type { Result } from "neverthrow";

// serverFn 境界のエラー処理。データ層のエラー（PostgREST の message / details）には
// テーブル名・カラム名・制約名が含まれ、そのまま throw するとクライアントの
// エラー境界（root-error.tsx が error.message を表示）へ内部情報が漏れる。
// 詳細はサーバーログにだけ残し、クライアントへはユーザー向け文言だけを届ける。

/** 失敗の詳細をサーバーログへ残し、ユーザー向け文言だけを持つ Error を返す。 */
export function toClientError(userMessage: string, cause: unknown): Error {
  console.error(userMessage, cause);
  return new Error(userMessage);
}

/**
 * serverFn 境界で `Result` を unwrap する。
 * 失敗時は `toClientError` で変換して throw（成功時は値をそのまま返す）。
 */
export function unwrapForClient<T>(
  result: Result<T, Error>,
  userMessage: string,
): T {
  if (result.isErr()) throw toClientError(userMessage, result.error);
  return result.value;
}
