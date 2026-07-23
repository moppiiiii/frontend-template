import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, expectTypeOf, it } from "vitest";
import * as z from "zod";

import {
  createSupabaseClient,
  createSupabaseSchema,
  deleteFrom,
  insert,
  select,
  SupabaseQueryError,
  SupabaseValidationError,
  update,
} from "./query";

const UUID = "00000000-0000-0000-0000-000000000000";

// エンジン単体のテスト用スキーマ。アプリのリソース（appSchema）には依存させず、
// 検証したい機能（embed・transform・row 由来の filter/match 型付け）をここで再現する。
const CategorySchema = z.object({ id: z.uuid(), name: z.string() });

const ItemEntitySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  completed: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  category_id: z.uuid().nullable(),
});

const GET_ITEMS_QUERY =
  "id, title, completed, created_at, category:categories(id, name)";

const ItemResponseSchema = ItemEntitySchema.pick({
  id: true,
  title: true,
  completed: true,
  created_at: true,
})
  .extend({ category: CategorySchema.nullable() })
  .transform((row) => ({
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.created_at,
    category: row.category,
  }));

type Item = z.infer<typeof ItemResponseSchema>;

const itemsSchema = createSupabaseSchema({
  "@select/items": select({
    output: z.array(ItemResponseSchema),
    select: GET_ITEMS_QUERY,
    row: ItemEntitySchema,
  }),
  "@insert/items": insert({ input: z.object({ title: z.string().min(1) }) }),
  "@update/items": update({
    input: z.object({
      title: z.string().min(1).optional(),
      completed: z.boolean().optional(),
    }),
    row: ItemEntitySchema,
  }),
  "@delete/items": deleteFrom({ row: ItemEntitySchema }),
});

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
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@select/items", {
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
      expect(find(calls, "from")?.args[0]).toBe("items");
      expect(find(calls, "select")?.args[0]).toBe(GET_ITEMS_QUERY);
      expect(has(calls, "order")).toBe(true);
    });

    it("レスポンスがスキーマ不一致なら SupabaseValidationError", async () => {
      const { client } = createMockClient({
        // title 欠落
        data: [{ id: UUID, completed: false, created_at: "x", category: null }],
        error: null,
      });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@select/items", {});

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
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@select/items", {});

      const error = result._unsafeUnwrapErr();
      expect(error).toBeInstanceOf(SupabaseQueryError);
      expect((error as SupabaseQueryError).code).toBe("42P01");
      expect((error as SupabaseQueryError).details).toBe("d");
    });
  });

  describe("insert", () => {
    it("入力が不正なら検証で弾き、client.insert を呼ばない", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@insert/items", { data: { title: "" } });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SupabaseValidationError);
      expect(has(calls, "insert")).toBe(false);
    });

    it("単一データを配列に包んで挿入する", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@insert/items", { data: { title: "hi" } });

      expect(result.isOk()).toBe(true);
      expect(find(calls, "insert")?.args[0]).toEqual([{ title: "hi" }]);
    });
  });

  describe("update", () => {
    it("検証済みデータと match を渡す", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@update/items", {
        data: { completed: true },
        match: { id: UUID },
      });

      expect(result.isOk()).toBe(true);
      expect(find(calls, "update")?.args[0]).toEqual({ completed: true });
      expect(find(calls, "match")?.args[0]).toEqual({ id: UUID });
    });

    it("空の match は全行更新になるため拒否し、client.update を呼ばない", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@update/items", {
        data: { completed: true },
        match: {},
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SupabaseQueryError);
      expect(has(calls, "update")).toBe(false);
    });
  });

  describe("delete", () => {
    it("match で対象を絞って削除する", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@delete/items", { match: { id: UUID } });

      expect(result.isOk()).toBe(true);
      expect(has(calls, "delete")).toBe(true);
      expect(find(calls, "match")?.args[0]).toEqual({ id: UUID });
    });

    it("空の match は全行削除になるため拒否し、client.delete を呼ばない", async () => {
      const { client, calls } = createMockClient({ data: null, error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@delete/items", { match: {} });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(SupabaseQueryError);
      expect(has(calls, "delete")).toBe(false);
    });
  });

  // 型契約のリグレッションテスト。expectTypeOf / @ts-expect-error は
  // `bun run check`（tsgo）で検証される（実行時は何も検査しない）。
  describe("型契約（コンパイル時）", () => {
    it("select の戻り値は変換後スキーマ（Item[]）で型付けされる", async () => {
      const { client } = createMockClient({ data: [], error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      const result = await $q("@select/items", {});

      expectTypeOf(result._unsafeUnwrap()).toEqualTypeOf<Item[]>();
    });

    it("filter のカラム名・値、match のキーが実テーブルの Row に制約される", async () => {
      const { client } = createMockClient({ data: [], error: null });
      const $q = createSupabaseClient({ client, schema: itemsSchema });

      // レスポンスに含まれない外部キー（category_id）でも row 由来で filter できる。
      await $q("@select/items", {
        filter: (q) => q.eq("category_id", UUID),
      });

      await $q("@select/items", {
        // @ts-expect-error 存在しないカラム名はコンパイルエラー
        filter: (q) => q.eq("nope", 1),
      });

      await $q("@select/items", {
        // @ts-expect-error 値の型違い（completed は boolean）はコンパイルエラー
        filter: (q) => q.eq("completed", "yes"),
      });

      await $q("@update/items", {
        data: { completed: true },
        // @ts-expect-error match のキーも実テーブルのカラムに制約される
        match: { idd: UUID },
      });
    });
  });

  it("未登録のキーは SupabaseQueryError を返す", async () => {
    const { client } = createMockClient({ data: null, error: null });
    const $q = createSupabaseClient({ client, schema: itemsSchema });

    // 型上は存在しないキー。実行時フォールバックを見るため cast して呼ぶ。
    const result = await (
      $q as unknown as (key: string, options: unknown) => ReturnType<typeof $q>
    )("@select/unknown", {});

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().message).toContain("No schema entry");
  });
});
