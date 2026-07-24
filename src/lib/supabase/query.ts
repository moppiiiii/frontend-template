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

/**
 * mutation の返却指定（PostgREST の `RETURNING` 相当）。
 * `output` は select と同じく配列スキーマ。`select` 省略時は `"*"`。
 */
export type ReturningSpec<Schema extends z.ZodType = z.ZodType> = {
  readonly output: Schema;
  readonly select?: string;
};

/** INSERT: 挿入データの検証スキーマ `input`。`returning` を渡すと挿入行を返す。 */
export type InsertEntry<I = unknown> = {
  readonly _op: "insert";
  readonly input: z.ZodType<I>;
  readonly returning?: ReturningSpec;
};

export type InsertEntryReturning<
  I = unknown,
  Ret extends z.ZodType = z.ZodType,
> = InsertEntry<I> & { readonly returning: ReturningSpec<Ret> };

/** UPDATE: 更新データの検証スキーマ `input`。`row` を渡すと `match` が `Partial<Row>` に。 */
export type UpdateEntry<I = unknown, R = unknown> = {
  readonly _op: "update";
  readonly input: z.ZodType<I>;
  readonly row?: z.ZodType<R>;
  readonly returning?: ReturningSpec;
};

export type UpdateEntryReturning<
  I = unknown,
  R = unknown,
  Ret extends z.ZodType = z.ZodType,
> = UpdateEntry<I, R> & { readonly returning: ReturningSpec<Ret> };

/** UPSERT: 挿入/更新データの検証スキーマ `input`。 */
export type UpsertEntry<I = unknown> = {
  readonly _op: "upsert";
  readonly input: z.ZodType<I>;
  readonly returning?: ReturningSpec;
};

export type UpsertEntryReturning<
  I = unknown,
  Ret extends z.ZodType = z.ZodType,
> = UpsertEntry<I> & { readonly returning: ReturningSpec<Ret> };

/** DELETE。`row` を渡すと `match` が `Partial<Row>` に型付けされる。 */
export type DeleteEntry<R = unknown> = {
  readonly _op: "delete";
  readonly row?: z.ZodType<R>;
};

/**
 * COUNT: 行数のみを取得する（`head: true`、行は転送しない）。
 * `row` を渡すと filter のカラム型が実テーブル全カラムで型付けされる（filter を使うなら実質必須）。
 */
export type CountEntry<RowSchema extends z.ZodType = z.ZodType> = {
  readonly _op: "count";
  readonly row?: RowSchema;
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

export function insert<I, Ret extends z.ZodType>(entry: {
  input: z.ZodType<I>;
  returning: ReturningSpec<Ret>;
}): InsertEntryReturning<I, Ret>;
export function insert<I>(entry: { input: z.ZodType<I> }): InsertEntry<I>;
export function insert<I>(entry: {
  input: z.ZodType<I>;
  returning?: ReturningSpec;
}): InsertEntry<I> {
  return { _op: "insert", ...entry };
}

export function update<
  I,
  R = unknown,
  Ret extends z.ZodType = z.ZodType,
>(entry: {
  input: z.ZodType<I>;
  row?: z.ZodType<R>;
  returning: ReturningSpec<Ret>;
}): UpdateEntryReturning<I, R, Ret>;
export function update<I, R = unknown>(entry: {
  input: z.ZodType<I>;
  row?: z.ZodType<R>;
}): UpdateEntry<I, R>;
export function update<I, R = unknown>(entry: {
  input: z.ZodType<I>;
  row?: z.ZodType<R>;
  returning?: ReturningSpec;
}): UpdateEntry<I, R> {
  return { _op: "update", ...entry };
}

export function upsert<I, Ret extends z.ZodType>(entry: {
  input: z.ZodType<I>;
  returning: ReturningSpec<Ret>;
}): UpsertEntryReturning<I, Ret>;
export function upsert<I>(entry: { input: z.ZodType<I> }): UpsertEntry<I>;
export function upsert<I>(entry: {
  input: z.ZodType<I>;
  returning?: ReturningSpec;
}): UpsertEntry<I> {
  return { _op: "upsert", ...entry };
}

export const deleteFrom = <R = unknown>(
  entry?: Omit<DeleteEntry<R>, "_op">,
): DeleteEntry<R> => ({ _op: "delete", ...entry });

export const count = <RowSchema extends z.ZodType = z.ZodType>(
  entry?: Omit<CountEntry<RowSchema>, "_op">,
): CountEntry<RowSchema> => ({ _op: "count", ...entry });

// ─── スキーママップ型 ─────────────────────────────────────────────────────────

type SupabaseOp =
  | "select"
  | "insert"
  | "update"
  | "upsert"
  | "delete"
  | "count";
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
          : Op extends "count"
            ? CountEntry
            : never;

/** 操作定義のマップ。キーは `@<操作>/<テーブル>` 形式。 */
export type SupabaseSchemaMap = {
  [K in OperationKey]?: EntryTypeFor<GetOp<K>>;
};

/** SELECT と `returning` 付き mutation は出力型（`z.output`）、COUNT は `number`、それ以外の mutation は `void`。 */
type OutputOf<E> =
  E extends SelectEntry<infer Sch, z.ZodType>
    ? z.output<Sch>
    : E extends CountEntry<z.ZodType>
      ? number
      : E extends { readonly returning: ReturningSpec<infer Sch> }
        ? z.output<Sch>
        : void;

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
            : GetOp<K> extends "count"
              ? S[K & keyof S] extends CountEntry<infer RowSch>
                ? { filter?: FilterFn<RowOf<z.input<RowSch>>> } | undefined
                : undefined
              : never;

type SupabaseQueryFn<S extends SupabaseSchemaMap> = <
  K extends keyof S & OperationKey,
>(
  key: K,
  options: OptionsFor<K, S>,
) => Promise<Result<OutputOf<S[K]>, SupabaseError>>;

// ─── select 文字列の定義時検証 ────────────────────────────────────────────────
// 取得クエリ文字列とレスポンススキーマはカラムを二重に持つ（既知の二重定義）。
// ずれをテスト・起動時に必ず露見させるため、スキーマ定義時に突き合わせる。

/** select 文字列からトップレベルのカラム/エイリアス名を取り出す（embed の中身は見ない）。 */
const topLevelColumns = (select: string): string[] => {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of select) {
    if (ch === "," && depth === 0) {
      tokens.push(current);
      current = "";
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    current += ch;
  }
  tokens.push(current);
  return tokens
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => {
      const alias = t.split(":")[0] ?? t;
      return (alias.split("(")[0] ?? alias).trim();
    });
};

/** 配列・transform（pipe）を剥がして素の object スキーマを取り出す。取れなければ null。 */
const unwrapToObject = (schema: z.ZodType): z.ZodObject | null => {
  let s: z.ZodType = schema;
  for (;;) {
    if (s instanceof z.ZodArray) {
      s = s.element as z.ZodType;
      continue;
    }
    if (s instanceof z.ZodPipe) {
      s = s.def.in as z.ZodType;
      continue;
    }
    return s instanceof z.ZodObject ? s : null;
  }
};

const assertSelectMatchesSchema = (
  key: string,
  select: string | undefined,
  output: z.ZodType,
): void => {
  if (!select || select.trim() === "*") return;
  const obj = unwrapToObject(output);
  if (!obj) return;
  const schemaKeys = Object.keys(obj.shape);
  const columns = topLevelColumns(select);
  const missing = schemaKeys.filter((k) => !columns.includes(k));
  const extra = columns.filter((c) => !schemaKeys.includes(c));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Select string for "${key}" does not match its output schema ` +
        `(missing: [${missing.join(", ")}], extra: [${extra.join(", ")}])`,
    );
  }
};

/**
 * スキーマをジェネリック型を保ったまま返すヘルパー（型推論用）。
 * あわせて select / returning の取得カラムと出力スキーマの一致を定義時に検証する。
 */
export const createSupabaseSchema = <S extends SupabaseSchemaMap>(
  schema: S,
): S => {
  for (const [key, entry] of Object.entries(
    schema as Record<string, AnyEntry | undefined>,
  )) {
    if (!entry) continue;
    if (entry._op === "select") {
      assertSelectMatchesSchema(key, entry.select, entry.output);
    } else if (
      (entry._op === "insert" ||
        entry._op === "update" ||
        entry._op === "upsert") &&
      entry.returning
    ) {
      assertSelectMatchesSchema(
        key,
        entry.returning.select,
        entry.returning.output,
      );
    }
  }
  return schema;
};

// ─── 内部ディスパッチ ─────────────────────────────────────────────────────────
// `_op` をトップレベルに持つ判別共用体。`call._op` で分岐すると entry と opts が
// 同時に絞り込まれる。

type AnyEntry =
  | SelectEntry
  | InsertEntry
  | UpdateEntry
  | UpsertEntry
  | DeleteEntry
  | CountEntry;

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
type CountCall = {
  _op: "count";
  entry: CountEntry;
  opts: { filter?: FilterFn<unknown> } | undefined;
};
type AnyCall =
  | SelectCall
  | InsertCall
  | UpdateCall
  | UpsertCall
  | DeleteCall
  | CountCall;

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

async function executeCount(
  client: SupabaseClient,
  table: string,
  opts: { filter?: FilterFn<unknown> } | undefined,
): Promise<Result<unknown, SupabaseError>> {
  // アサーション: executeSelect と同じビルダー境界（キャストの理由もそちらを参照）。
  const q = client
    .from(table)
    .select("*", { count: "exact", head: true }) as SelectBuilderType;
  const filtered = opts?.filter
    ? (opts.filter(
        q as unknown as TypedFilterBuilder<unknown>,
      ) as unknown as SelectBuilderType)
    : q;
  const { count: total, error } = await filtered;
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  if (total === null || total === undefined) {
    return err(new SupabaseQueryError(`Count for "${table}" was not returned`));
  }
  return ok(total);
}

type MutationResponse = {
  data: unknown;
  error: { message: string; code?: string; details?: unknown } | null;
};

/** mutation ビルダーの必要最小限の形（await 可能＋ `.select()` で返却行を要求できる）。 */
type MutationBuilder = PromiseLike<MutationResponse> & {
  select(columns: string): PromiseLike<MutationResponse>;
};

/** mutation を確定させる。`returning` があれば `.select()` で結果行を取得し検証する。 */
async function finishMutation(
  builder: MutationBuilder,
  returning: ReturningSpec | undefined,
): Promise<Result<unknown, SupabaseError>> {
  if (!returning) {
    const { error } = await builder;
    if (error) {
      return err(
        new SupabaseQueryError(error.message, error.code, error.details),
      );
    }
    return ok(undefined);
  }
  const { data, error } = await builder.select(returning.select ?? "*");
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  const parsed = returning.output.safeParse(data);
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
): Promise<Result<unknown, SupabaseError>> {
  const payload = Array.isArray(opts.data) ? opts.data : [opts.data];
  const parsed = z.array(entry.input).safeParse(payload);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  return finishMutation(
    client.from(table).insert(parsed.data),
    entry.returning,
  );
}

/** 空の `match` は WHERE 句なしで全行に作用してしまうため、実行前に拒否する。 */
const emptyMatchError = (op: "update" | "delete", table: string) =>
  new SupabaseQueryError(
    `Refusing to ${op} "${table}" with an empty match (would affect all rows)`,
  );

async function executeUpdate(
  client: SupabaseClient,
  table: string,
  entry: UpdateEntry,
  opts: { data: unknown; match: Record<string, unknown> },
): Promise<Result<unknown, SupabaseError>> {
  if (Object.keys(opts.match).length === 0) {
    return err(emptyMatchError("update", table));
  }
  const parsed = entry.input.safeParse(opts.data);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  return finishMutation(
    client
      .from(table)
      .update(parsed.data as Record<string, unknown>)
      .match(opts.match),
    entry.returning,
  );
}

async function executeUpsert(
  client: SupabaseClient,
  table: string,
  entry: UpsertEntry,
  opts: { data: unknown },
): Promise<Result<unknown, SupabaseError>> {
  const payload = Array.isArray(opts.data) ? opts.data : [opts.data];
  const parsed = z.array(entry.input).safeParse(payload);
  if (!parsed.success) {
    return err(new SupabaseValidationError(parsed.error));
  }
  return finishMutation(
    client.from(table).upsert(parsed.data),
    entry.returning,
  );
}

async function executeDelete(
  client: SupabaseClient,
  table: string,
  opts: { match: Record<string, unknown> },
): Promise<Result<void, SupabaseError>> {
  if (Object.keys(opts.match).length === 0) {
    return err(emptyMatchError("delete", table));
  }
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
  if (call._op === "count") {
    return executeCount(client, table, call.opts);
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
