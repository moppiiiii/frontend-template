import type { SupabaseClient } from "@supabase/supabase-js";
import { err, ok, type Result } from "neverthrow";
import * as z from "zod";

/** クエリ実行時の PostgREST エラー。 */
export class SupabaseQueryError extends Error {
  readonly _tag = "SupabaseQueryError" as const;
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "SupabaseQueryError";
  }
}

/** レスポンスの Zod バリデーション失敗。詳細は `issues`。 */
export class SupabaseValidationError extends Error {
  readonly _tag = "SupabaseValidationError" as const;
  constructor(public readonly issues: z.ZodError) {
    super("Response validation failed");
    this.name = "SupabaseValidationError";
  }
}

export type SupabaseError = SupabaseQueryError | SupabaseValidationError;

// ─── 操作エントリ ─────────────────────────────────────────────────────────────
// 各操作を `_op` 判別子付きのエントリで表す。ディスパッチを `_op` で分岐させると
// エントリと opts が同時に絞り込まれ、ロジック内部での型アサーションが不要になる。

/**
 * SELECT: レスポンス検証スキーマ `output` と取得カラム `select`（省略時 `"*"`）。
 * `output` が `.transform()` を含む場合、戻り値は変換後（`z.output`）になる。
 *
 * `row` を渡すと filter のカラム型をそのスキーマ（＝実テーブルの全カラム）で型付けする。
 * embed や変換でレスポンスがネスト/改名されても、filter は実 DB カラムで効く。
 * 省略時は `output` 由来（単一テーブル・変換なしの簡易ケース）。
 */
export type SelectEntry<
  Schema extends z.ZodType = z.ZodType,
  RowSchema extends z.ZodType = Schema,
> = {
  readonly _op: "select";
  readonly output: Schema;
  readonly select?: string;
  readonly row?: RowSchema;
};

/** INSERT: 挿入データの検証スキーマ `input`。 */
export type InsertEntry<I = unknown> = {
  readonly _op: "insert";
  readonly input: z.ZodType<I>;
};

/** UPDATE: 更新データの検証スキーマ `input`。`row` を渡すと `match` が `Partial<Row>` に。 */
export type UpdateEntry<I = unknown, R = unknown> = {
  readonly _op: "update";
  readonly input: z.ZodType<I>;
  readonly row?: z.ZodType<R>;
};

/** UPSERT: 挿入/更新データの検証スキーマ `input`。 */
export type UpsertEntry<I = unknown> = {
  readonly _op: "upsert";
  readonly input: z.ZodType<I>;
};

/** DELETE。`row` を渡すと `match` が `Partial<Row>` に型付けされる。 */
export type DeleteEntry<R = unknown> = {
  readonly _op: "delete";
  readonly row?: z.ZodType<R>;
};

/** 各エントリ生成ヘルパー（`_op` を付与するだけ）。 */
export const select = <
  Schema extends z.ZodType,
  RowSchema extends z.ZodType = Schema,
>(
  entry: Omit<SelectEntry<Schema, RowSchema>, "_op">,
): SelectEntry<Schema, RowSchema> => ({
  _op: "select",
  ...entry,
});

export const insert = <I>(
  entry: Omit<InsertEntry<I>, "_op">,
): InsertEntry<I> => ({
  _op: "insert",
  ...entry,
});

export const update = <I, R = unknown>(
  entry: Omit<UpdateEntry<I, R>, "_op">,
): UpdateEntry<I, R> => ({
  _op: "update",
  ...entry,
});

export const upsert = <I>(
  entry: Omit<UpsertEntry<I>, "_op">,
): UpsertEntry<I> => ({
  _op: "upsert",
  ...entry,
});

export const deleteFrom = <R = unknown>(
  entry?: Omit<DeleteEntry<R>, "_op">,
): DeleteEntry<R> => ({ _op: "delete", ...entry });

// ─── スキーママップ型 ─────────────────────────────────────────────────────────

type SupabaseOp = "select" | "insert" | "update" | "upsert" | "delete";
type OperationKey = `@${SupabaseOp}/${string}`;
type GetOp<K extends string> = K extends `@${infer Op}/${string}` ? Op : never;

type EntryTypeFor<Op extends string> = Op extends "select"
  ? SelectEntry
  : Op extends "insert"
    ? InsertEntry
    : Op extends "update"
      ? UpdateEntry
      : Op extends "upsert"
        ? UpsertEntry
        : Op extends "delete"
          ? DeleteEntry
          : never;

/** 操作定義のマップ。キーは `@<操作>/<テーブル>` 形式。 */
export type SupabaseSchemaMap = {
  [K in OperationKey]?: EntryTypeFor<GetOp<K>>;
};

/** SELECT は出力型（`z.output`）、ミューテーションは `void` を返す。 */
type OutputOf<E, MutationOutput = void> =
  E extends SelectEntry<infer Sch, z.ZodType> ? z.output<Sch> : MutationOutput;

type QueryBuilderType = ReturnType<SupabaseClient["from"]>;
type SelectBuilderType = ReturnType<QueryBuilderType["select"]>;

/** 出力型 `O`（通常 `Row[]`）から 1 行分の型 `Row` を取り出す。 */
type RowOf<O> = O extends ReadonlyArray<infer R> ? R : O;

/** update/delete の `match` の型。`row` 有りなら `Partial<Row>`、無しは `Record<string, unknown>`。 */
type MatchOf<R> = unknown extends R
  ? Record<string, unknown>
  : Partial<RowOf<R>>;

/**
 * カラム名を行型 `Row` のキーに制約した、postgrest フィルタの安全なサブセット。
 *
 * 型なしクライアント（`Database = any`）ではカラム名のタイポが素通りする。
 * このファサード経由なら引数が `keyof Row`（zod 出力スキーマ由来）に縛られ、
 * 比較系では値も `Row[K]` に揃う。使いたいメソッドはここに足して拡張する。
 */
export interface TypedFilterBuilder<Row> {
  eq<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  neq<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  gt<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  gte<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  lt<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  lte<K extends keyof Row & string>(
    column: K,
    value: Row[K],
  ): TypedFilterBuilder<Row>;
  like<K extends keyof Row & string>(
    column: K,
    pattern: string,
  ): TypedFilterBuilder<Row>;
  ilike<K extends keyof Row & string>(
    column: K,
    pattern: string,
  ): TypedFilterBuilder<Row>;
  in<K extends keyof Row & string>(
    column: K,
    values: ReadonlyArray<Row[K]>,
  ): TypedFilterBuilder<Row>;
  is<K extends keyof Row & string>(
    column: K,
    value: Row[K] | null,
  ): TypedFilterBuilder<Row>;
  order<K extends keyof Row & string>(
    column: K,
    options?: { ascending?: boolean; nullsFirst?: boolean },
  ): TypedFilterBuilder<Row>;
  limit(count: number): TypedFilterBuilder<Row>;
  range(from: number, to: number): TypedFilterBuilder<Row>;
  match(query: Partial<Row>): TypedFilterBuilder<Row>;
}

/** SELECT のフィルタ条件をチェーンする関数。カラム名は `Row` のキーに制約される。 */
export type FilterFn<Row> = (
  query: TypedFilterBuilder<Row>,
) => TypedFilterBuilder<Row>;

type OptionsFor<K extends string, S extends SupabaseSchemaMap> =
  GetOp<K> extends "select"
    ? S[K & keyof S] extends SelectEntry<z.ZodType, infer RowSch>
      ? { filter?: FilterFn<RowOf<z.input<RowSch>>> } | undefined
      : undefined
    : GetOp<K> extends "insert"
      ? S[K & keyof S] extends InsertEntry<infer I>
        ? { data: z.input<z.ZodType<I>> | Array<z.input<z.ZodType<I>>> }
        : never
      : GetOp<K> extends "update"
        ? S[K & keyof S] extends UpdateEntry<infer I, infer R>
          ? { data: z.input<z.ZodType<I>>; match: MatchOf<R> }
          : never
        : GetOp<K> extends "upsert"
          ? S[K & keyof S] extends UpsertEntry<infer I>
            ? { data: z.input<z.ZodType<I>> | Array<z.input<z.ZodType<I>>> }
            : never
          : GetOp<K> extends "delete"
            ? S[K & keyof S] extends DeleteEntry<infer R>
              ? { match: MatchOf<R> }
              : never
            : never;

type SupabaseQueryFn<S extends SupabaseSchemaMap> = <
  K extends keyof S & OperationKey,
>(
  key: K,
  options: OptionsFor<K, S>,
) => Promise<Result<OutputOf<S[K]>, SupabaseError>>;

/** スキーマをジェネリック型を保ったまま返すヘルパー（型推論用）。 */
export const createSupabaseSchema = <S extends SupabaseSchemaMap>(
  schema: S,
): S => schema;

// ─── 内部ディスパッチ ─────────────────────────────────────────────────────────
// `_op` をトップレベルに持つ判別共用体。`call._op` で分岐すると entry と opts が
// 同時に絞り込まれる。

type AnyEntry =
  | SelectEntry
  | InsertEntry
  | UpdateEntry
  | UpsertEntry
  | DeleteEntry;

type SelectCall = {
  _op: "select";
  entry: SelectEntry;
  opts: { filter?: FilterFn<unknown> } | undefined;
};
type InsertCall = {
  _op: "insert";
  entry: InsertEntry;
  opts: { data: unknown };
};
type UpdateCall = {
  _op: "update";
  entry: UpdateEntry;
  opts: { data: unknown; match: Record<string, unknown> };
};
type UpsertCall = {
  _op: "upsert";
  entry: UpsertEntry;
  opts: { data: unknown };
};
type DeleteCall = {
  _op: "delete";
  entry: DeleteEntry;
  opts: { match: Record<string, unknown> };
};
type AnyCall = SelectCall | InsertCall | UpdateCall | UpsertCall | DeleteCall;

// アサーション: ジェネリックな条件型は `AnyCall` 共用体へ伝播できないための境界。
// `OptionsFor` が各キーに対応する opts を導出済みなので安全。
const buildCall = (entry: AnyEntry, opts: unknown): AnyCall =>
  ({ _op: entry._op, entry, opts }) as AnyCall;

async function executeSelect(
  client: SupabaseClient,
  table: string,
  entry: SelectEntry,
  opts: { filter?: FilterFn<unknown> } | undefined,
): Promise<Result<unknown, SupabaseError>> {
  // アサーション: `.select(string)` は Result 型が不変で代入不可になるため
  // ビルダー型へ戻す。カラム選択は実行時に効き、レスポンスは下で Zod 検証する。
  const q = client.from(table).select(entry.select ?? "*") as SelectBuilderType;
  // アサーション: 素のビルダーを型付きファサードへ。構造的に満たすため安全
  // （カラム名の制約は呼び出し側、ここでは unknown 行として通すだけ）。
  const filtered = opts?.filter
    ? (opts.filter(
        q as unknown as TypedFilterBuilder<unknown>,
      ) as unknown as SelectBuilderType)
    : q;
  const { data, error } = await filtered;
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  const parsed = entry.output.safeParse(data);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  return ok(parsed.data);
}

async function executeInsert(
  client: SupabaseClient,
  table: string,
  entry: InsertEntry,
  opts: { data: unknown },
): Promise<Result<void, SupabaseError>> {
  const payload = Array.isArray(opts.data) ? opts.data : [opts.data];
  const parsed = z.array(entry.input).safeParse(payload);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  const { error } = await client.from(table).insert(parsed.data);
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  return ok(undefined);
}

async function executeUpdate(
  client: SupabaseClient,
  table: string,
  entry: UpdateEntry,
  opts: { data: unknown; match: Record<string, unknown> },
): Promise<Result<void, SupabaseError>> {
  const parsed = entry.input.safeParse(opts.data);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  const { error } = await client
    .from(table)
    .update(parsed.data as Record<string, unknown>)
    .match(opts.match);
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  return ok(undefined);
}

async function executeUpsert(
  client: SupabaseClient,
  table: string,
  entry: UpsertEntry,
  opts: { data: unknown },
): Promise<Result<void, SupabaseError>> {
  const payload = Array.isArray(opts.data) ? opts.data : [opts.data];
  const parsed = z.array(entry.input).safeParse(payload);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  const { error } = await client.from(table).upsert(parsed.data);
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  return ok(undefined);
}

async function executeDelete(
  client: SupabaseClient,
  table: string,
  opts: { match: Record<string, unknown> },
): Promise<Result<void, SupabaseError>> {
  const { error } = await client.from(table).delete().match(opts.match);
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  return ok(undefined);
}

// `void` は `unknown` に代入可能なので、全エグゼキュータを共通の戻り型でまとめられる。
async function dispatch(
  client: SupabaseClient,
  table: string,
  call: AnyCall,
): Promise<Result<unknown, SupabaseError>> {
  if (call._op === "select") {
    return executeSelect(client, table, call.entry, call.opts);
  }
  if (call._op === "insert") {
    return executeInsert(client, table, call.entry, call.opts);
  }
  if (call._op === "update") {
    return executeUpdate(client, table, call.entry, call.opts);
  }
  if (call._op === "upsert") {
    return executeUpsert(client, table, call.entry, call.opts);
  }
  return executeDelete(client, table, call.opts);
}

/**
 * スキーマから型安全なクエリ関数を生成する。
 * `client(key, options)` の形で呼び、結果は `Result<出力, SupabaseError>`。
 *
 * 型アサーションは構造的な境界 2 箇所のみ（どちらも `OptionsFor` /
 * `entry.output` の制約で安全）:
 * - 入口: ジェネリックなスキーマを内部用の具体型へ。
 * - 出口: `Result<unknown>` を呼び出し側スキーマ由来の出力型へ。
 * （SELECT 内のビルダー関連キャストは executeSelect 参照）
 */
export const createSupabaseClient = <S extends SupabaseSchemaMap>({
  client,
  schema,
}: {
  client: SupabaseClient;
  schema: S;
}): SupabaseQueryFn<S> => {
  const concreteSchema: Record<string, AnyEntry | undefined> = schema;

  return async (key, options) => {
    const entry = concreteSchema[key as string];
    if (!entry) {
      return err(new SupabaseQueryError(`No schema entry found for "${key}"`));
    }

    const table = (key as string).split("/").slice(1).join("/");
    const result = await dispatch(client, table, buildCall(entry, options));

    return result as Result<OutputOf<S[typeof key]>, SupabaseError>;
  };
};
