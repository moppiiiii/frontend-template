import type { SupabaseClient } from "@supabase/supabase-js";
import { err, ok, type Result } from "neverthrow";
import * as z from "zod";

/**
 * Supabaseのクエリ実行時に発生するエラーを表すクラス。
 * PostgreSTエラーのメッセージ・コード・詳細情報を保持する。
 */
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

/**
 * Supabaseのレスポンスに対するZodバリデーションが失敗したときに発生するエラー。
 * 検証エラーの詳細は `issues` プロパティから参照できる。
 */
export class SupabaseValidationError extends Error {
  readonly _tag = "SupabaseValidationError" as const;
  constructor(public readonly issues: z.ZodError) {
    super("Response validation failed");
    this.name = "SupabaseValidationError";
  }
}

/** Supabase操作で発生しうるすべてのエラー型の共用体。 */
export type SupabaseError = SupabaseQueryError | SupabaseValidationError;

// 各エントリ型は `_op` リテラルを判別子として持つ。
// エントリ型と AnyCall の両方で `_op` をトップレベルに持たせることで、
// TypeScript はディスパッチの各ブランチでエントリと対応する opts を同時に絞り込める。
// ロジック内部での型アサーションは不要になる。

/**
 * SELECT操作のエントリ定義。
 * レスポンスを検証するZodスキーマ (`output`) と、取得するカラム一覧 (`select`) を保持する。
 */
export type SelectEntry<O = unknown> = {
  readonly _op: "select";
  readonly output: z.ZodType<O>;
  /** `.select()` に渡すカンマ区切りのカラム一覧。省略時は `"*"` が使用される。 */
  readonly select?: string;
};

/**
 * INSERT操作のエントリ定義。
 * 挿入データを検証するZodスキーマ (`input`) を保持する。
 */
export type InsertEntry<I = unknown> = {
  readonly _op: "insert";
  readonly input: z.ZodType<I>;
};

/**
 * UPDATE操作のエントリ定義。
 * 更新データを検証するZodスキーマ (`input`) を保持する。
 */
export type UpdateEntry<I = unknown> = {
  readonly _op: "update";
  readonly input: z.ZodType<I>;
};

/**
 * UPSERT操作のエントリ定義。
 * 挿入または更新するデータを検証するZodスキーマ (`input`) を保持する。
 */
export type UpsertEntry<I = unknown> = {
  readonly _op: "upsert";
  readonly input: z.ZodType<I>;
};

/** DELETE操作のエントリ定義。 */
export type DeleteEntry = {
  readonly _op: "delete";
};

/** `_op: "select"` を付与した `SelectEntry` を生成するヘルパー関数。 */
export const select = <O>(
  entry: Omit<SelectEntry<O>, "_op">,
): SelectEntry<O> => ({
  _op: "select",
  ...entry,
});

/** `_op: "insert"` を付与した `InsertEntry` を生成するヘルパー関数。 */
export const insert = <I>(
  entry: Omit<InsertEntry<I>, "_op">,
): InsertEntry<I> => ({
  _op: "insert",
  ...entry,
});

/** `_op: "update"` を付与した `UpdateEntry` を生成するヘルパー関数。 */
export const update = <I>(
  entry: Omit<UpdateEntry<I>, "_op">,
): UpdateEntry<I> => ({
  _op: "update",
  ...entry,
});

/** `_op: "upsert"` を付与した `UpsertEntry` を生成するヘルパー関数。 */
export const upsert = <I>(
  entry: Omit<UpsertEntry<I>, "_op">,
): UpsertEntry<I> => ({
  _op: "upsert",
  ...entry,
});

/** `_op: "delete"` を付与した `DeleteEntry` を生成するヘルパー関数。 */
export const deleteFrom = (): DeleteEntry => ({ _op: "delete" });

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

/**
 * テーブルごとの操作定義をまとめたスキーママップ型。
 * キーは `@<操作名>/<テーブル名>` 形式（例: `"@select/articles"`）で、
 * 値は操作に対応するエントリ型になる。
 */
export type SupabaseSchemaMap = {
  [K in OperationKey]?: EntryTypeFor<GetOp<K>>;
};

/** `SelectEntry<O>` の場合は `O`、それ以外のミューテーション操作は `void` を返す出力型ユーティリティ。 */
type OutputOf<E, MutationOutput = void> =
  E extends SelectEntry<infer O> ? O : MutationOutput;

// `ReturnType<QueryBuilderType["select"]>` を使うと、PostgrestFilterBuilder の
// Result 型パラメータは `"*"` デフォルト時の `unknown[]` になる。
// しかし実行時に `.select(columns: string)` を呼ぶと TypeScript は
// `Query = string` と推論し、パーサーが `GenericStringError[]` という
// 別の Result 型を生成してしまう。
//
// PostgrestFilterBuilder は Result パラメータに対して不変（`then()` を介して
// 共変・反変の両方の位置で使われるため）なので、
// `GenericStringError[]` → `unknown[]` も逆方向も互いに代入不可となる。
//
// このライブラリ起因の不変性を回避する唯一の方法は、select ビルダーを
// `FilterFn` へ渡す箇所（executeSelect 参照）での単一の型アサーションのみ。
// FilterFn は ReturnType を使って定義することで、ユーザーが正しい補完を得られる。

type QueryBuilderType = ReturnType<SupabaseClient["from"]>;
type SelectBuilderType = ReturnType<QueryBuilderType["select"]>;

/**
 * SELECTクエリビルダーを受け取り、フィルター条件をチェーンして返す関数型。
 * `.eq()` / `.order()` / `.limit()` などを任意に組み合わせることができる。
 *
 * @example
 * ```ts
 * filter: (q) => q.eq("is_favorite", true).order("published_at", { ascending: false })
 * ```
 */
export type FilterFn = (query: SelectBuilderType) => SelectBuilderType;

type OptionsFor<K extends string, S extends SupabaseSchemaMap> =
  GetOp<K> extends "select"
    ? { filter?: FilterFn } | undefined
    : GetOp<K> extends "insert"
      ? S[K & keyof S] extends InsertEntry<infer I>
        ? { data: z.input<z.ZodType<I>> | Array<z.input<z.ZodType<I>>> }
        : never
      : GetOp<K> extends "update"
        ? S[K & keyof S] extends UpdateEntry<infer I>
          ? { data: z.input<z.ZodType<I>>; match: Record<string, unknown> }
          : never
        : GetOp<K> extends "upsert"
          ? S[K & keyof S] extends UpsertEntry<infer I>
            ? { data: z.input<z.ZodType<I>> | Array<z.input<z.ZodType<I>>> }
            : never
          : GetOp<K> extends "delete"
            ? { match: Record<string, unknown> }
            : never;

type SupabaseQueryFn<S extends SupabaseSchemaMap> = <
  K extends keyof S & OperationKey,
>(
  key: K,
  options: OptionsFor<K, S>,
) => Promise<Result<OutputOf<S[K]>, SupabaseError>>;

/**
 * スキーママップをそのまま返すヘルパー関数。
 * ジェネリック型 `S` を保持したまま型推論させるために使用する。
 */
export const createSupabaseSchema = <S extends SupabaseSchemaMap>(
  schema: S,
): S => schema;

// AnyCall は `_op` をトップレベルに持ち上げ、各エントリと具体的な opts 型を対にする。
// ディスパッチが `call._op` で分岐すると、TypeScript は `call.entry` と `call.opts` の
// 両方を同時に絞り込める — ロジック内部でのアサーションは不要。

type AnyEntry =
  | SelectEntry
  | InsertEntry
  | UpdateEntry
  | UpsertEntry
  | DeleteEntry;

type SelectCall = {
  _op: "select";
  entry: SelectEntry;
  opts: { filter?: FilterFn } | undefined;
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

/**
 * エントリとオプションを組み合わせ、判別共用体 `AnyCall` を生成する内部関数。
 *
 * 型アサーション (1/4): `opts` は呼び出し側で `OptionsFor<K, S>` として正しく制約されているが、
 * TypeScript はジェネリックの条件型を `AnyCall` の具体的な共用体へ伝播できないため、
 * この境界で型アサーションが必要となる。`SupabaseSchemaMap` により各キーは正しいエントリ型に
 * マッピングされ、`OptionsFor` が対応するオプション型を導出するため、アサーションは安全。
 */
const buildCall = (entry: AnyEntry, opts: unknown): AnyCall =>
  ({ _op: entry._op, entry, opts }) as AnyCall;

// 各関数は具体的かつ完全に絞り込まれたエントリ型を受け取る。
// ロジック内部にアサーションなし。`any` 型も使用しない。
//
// Supabase JS クライアントはデフォルトで `Database = any` を使うため、
// クエリビルダーのメソッドは `unknown` 引数を受け付ける（`any` パラメータに解決される）。
// `.match()` のシグネチャは `match(query: Record<string, unknown>): this`。

async function executeSelect(
  client: SupabaseClient,
  table: string,
  entry: SelectEntry,
  opts: { filter?: FilterFn } | undefined,
): Promise<Result<unknown, SupabaseError>> {
  // 型アサーション (2/4): `select(columns: string)` を呼ぶと TypeScript は
  // `Query = string` と推論し、postgrest-js パーサーが Result 型パラメータとして
  // `GenericStringError[]` を生成する。引数なしの `select()` は `unknown[]` を生成する。
  // PostgrestFilterBuilder は Result に対して不変（`then()` メソッドにより）なので、
  // 2つの変種は互いに非互換で、どちらももう一方に代入できない。
  // SelectBuilderType（= Query = "*" の ReturnType）へのキャストが安全な理由:
  //   1. カラム選択は型に関係なく実行時に正しく適用される。
  //   2. レスポンスは常に Zod の `entry.output` で検証され、推論された Result 型では検証されない。
  const q = client.from(table).select(entry.select ?? "*") as SelectBuilderType;
  const filtered = opts?.filter ? opts.filter(q) : q;
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
  // `.update()` は `unknown` を受け付ける（Supabase の型なしクライアントは `any` に解決される）。
  // `.match()` のシグネチャは `match(query: Record<string, unknown>): this`。
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
  // `.match()` のシグネチャは `match(query: Record<string, unknown>): this`。
  const { error } = await client.from(table).delete().match(opts.match);
  if (error) {
    return err(
      new SupabaseQueryError(error.message, error.code, error.details),
    );
  }
  return ok(undefined);
}

// AnyCall は `_op` をトップレベルに持ち上げることで、各ブランチで TypeScript が
// `call.entry` と `call.opts` の両方を完全に絞り込めるようにする。
// `Result<unknown, SupabaseError>` を返す — void は unknown に代入可能（unknown は
// TypeScript のトップ型）なので、全エグゼキュータの戻り型と互換性がある。

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
 * スキーマから型安全なSupabaseクエリ関数を生成する。
 *
 * ## 型アサーション（計4箇所 — すべて構造的な境界に限定）
 *
 * 1. **スキーマ境界** (`schema as Record<string, AnyEntry | undefined>`):
 *    呼び出し側での型推論に必要なジェネリックスキーママップを、
 *    内部ディスパッチ用の具体的な判別共用体へ変換する。
 *    安全性: `SupabaseSchemaMap` により `@select/*` → `SelectEntry` などのマッピングが保証される。
 *
 * 2. **buildCall境界** (`{ _op, entry, opts } as AnyCall`):
 *    ジェネリックな `OptionsFor<K, S>` とエントリを `AnyCall` に結合する。
 *    安全性: `OptionsFor` が各操作に対応する正しいオプション型を導出する。
 *
 * 3. **FilterFn互換性** (`executeSelect` 内):
 *    `select(columns: string)` と `select()` は Result 型パラメータに対して不変な
 *    `PostgrestFilterBuilder` の互換性のない変種を生成する。
 *    安全性: カラム選択は実行時に正しく適用され、レスポンスはZodが検証するため問題ない。
 *
 * 4. **出力境界** (`result as Result<OutputOf<S[K]>, SupabaseError>`):
 *    エグゼキュータが `unknown` で処理した `Result<unknown>` を、
 *    呼び出し側のスキーマから推論した具体的な出力型へ戻す。
 *    安全性: `executeSelect` は `S[K]` と紐付いた `z.ZodType<O>` である `entry.output` で検証済み。
 *
 * ディスパッチロジックおよびエグゼキュータ関数はすべて完全に型安全である。
 */
export const createSupabaseClient = <S extends SupabaseSchemaMap>({
  client,
  schema,
}: {
  client: SupabaseClient;
  schema: S;
}): SupabaseQueryFn<S> => {
  // 型アサーション (1/4) — スキーマ境界
  const concreteSchema: Record<string, AnyEntry | undefined> = schema;

  return async (key, options) => {
    const entry = concreteSchema[key as string];
    if (!entry) {
      return err(new SupabaseQueryError(`No schema entry found for "${key}"`));
    }

    const table = (key as string).split("/").slice(1).join("/");
    const result = await dispatch(client, table, buildCall(entry, options));

    // 型アサーション (4/4) — 出力境界
    return result as Result<OutputOf<S[typeof key]>, SupabaseError>;
  };
};
