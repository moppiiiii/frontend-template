import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { GET_TODOS_QUERY, todosSchema } from "@/schemas/todos";

import {
  createSupabaseClient,
  SupabaseQueryError,
  SupabaseValidationError,
} from "./query";

const UUID = "00000000-0000-0000-0000-000000000000";

type QueryResult = { data: unknown; error: unknown };
type Call = { method: string; args: unknown[] };

// PostgREST のチェーンビルダーのモック。各メソッドは自身を返して呼び出しを記録し、
// await されると result を解決する（thenable）。
function createMockClient(result: QueryResult) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {
    // oxlint-disable-next-line no-thenable
    then(onFulfilled: (v: QueryResult) => unknown) {
      return Promise.resolve(result).then(onFulfilled);
    },
  };
  const methods = [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "like",
    "ilike",
    "in",
    "is",
    "order",
    "limit",
    "range",
    "match",
  ];
  for (const method of methods) {
    builder[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  }
  const client = {
    from(table: string) {
      calls.push({ method: "from", args: [table] });
      return builder;
    },
  } as unknown as SupabaseClient;

  return { client, calls };
}

const find = (calls: Call[], method: string) =>
  calls.find((c) => c.method === method);
const has = (calls: Call[], method: string) =>
  calls.some((c) => c.method === method);

describe("createSupabaseClient", () => {
  describe("select", () => {
    it("検証を通し、transform 後（camelCase）の行を返す", async () => {
      const { client, calls } = createMockClient({
        data: [
          {
            id: UUID,
            title: "牛乳を買う",
            completed: false,
            created_at: "2020-01-01T00:00:00Z",
            category: null,
          },
        ],
        error: null,
      });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@select/todos", {
        filter: (q) => q.order("created_at", { ascending: false }),
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual([
        {
          id: UUID,
          title: "牛乳を買う",
          completed: false,
          createdAt: "2020-01-01T00:00:00Z",
          category: null,
        },
      ]);
      expect(find(calls, "from")?.args[0]).toBe("todos");
      expect(find(calls, "select")?.args[0]).toBe(GET_TODOS_QUERY);
      expect(has(calls, "order")).toBe(true);
    });

    it("レスポンスがスキーマ不一致なら SupabaseValidationError", async () => {
      const { client } = createMockClient({
        // title 欠落
        data: [{ id: UUID, completed: false, created_at: "x", category: null }],
        error: null,
      });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@select/todos", {});

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SupabaseValidationError);
    });

    it("PostgREST エラーは code/details 付きの SupabaseQueryError", async () => {
      const { client } = createMockClient({
        data: null,
        error: {
          message: "relation does not exist",
          code: "42P01",
          details: "d",
        },
      });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@select/todos", {});

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(SupabaseQueryError);
      expect((error as SupabaseQueryError).code).toBe("42P01");
      expect((error as SupabaseQueryError).details).toBe("d");
    });
  });

  describe("insert", () => {
    it("入力が不正なら検証で弾き、client.insert を呼ばない", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@insert/todos", { data: { title: "" } });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SupabaseValidationError);
      expect(has(calls, "insert")).toBe(false);
    });

    it("単一データを配列に包んで挿入する", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@insert/todos", { data: { title: "hi" } });

      expect(result.isOk()).toBe(true);
      expect(find(calls, "insert")?.args[0]).toEqual([{ title: "hi" }]);
    });
  });

  describe("update", () => {
    it("検証済みデータと match を渡す", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@update/todos", {
        data: { completed: true },
        match: { id: UUID },
      });

      expect(result.isOk()).toBe(true);
      expect(find(calls, "update")?.args[0]).toEqual({ completed: true });
      expect(find(calls, "match")?.args[0]).toEqual({ id: UUID });
    });
  });

  describe("delete", () => {
    it("match で対象を絞って削除する", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: todosSchema });

      const result = await $q("@delete/todos", { match: { id: UUID } });

      expect(result.isOk()).toBe(true);
      expect(has(calls, "delete")).toBe(true);
      expect(find(calls, "match")?.args[0]).toEqual({ id: UUID });
    });
  });

  it("未登録のキーは SupabaseQueryError を返す", async () => {
    const { client } = createMockClient({ data: null, error: null });
    const $q = createSupabaseClient({ client, schema: todosSchema });

    // 型上は存在しないキー。実行時フォールバックを見るため cast して呼ぶ。
    const result = await (
      $q as unknown as (key: string, options: unknown) => ReturnType<typeof $q>
    )("@select/unknown", {});

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("No schema entry");
  });
});
