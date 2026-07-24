# データアクセス層

`src/lib/supabase/` のスキーマ駆動エンジンと、その上の規約を説明します。

## 全体像

```
schemas/<resource>.ts          lib/supabase/
  zod スキーマ                    query.ts   … 型安全エンジン（createSupabaseClient）
  + 取得クエリ定数        ──┐     client.ts  … $supabaseClient（ブラウザ）
  + 操作の断片              │     server.ts  … $supabaseServer（サーバー・cookie）
schemas/index.ts             │     index.ts   … エンジン公開 API
  appSchema（全断片を合流） ◀┘
        ▲
        └ $supabaseClient / $supabaseServer が同じ appSchema を共有
```

## 操作キーとスキーマ断片

各操作は `@<操作>/<テーブル>` 形式のキーで表す。

```ts
export const todosSchema = createSupabaseSchema({
  "@select/todos": select({ output, select: GET_TODOS_QUERY, row }),
  "@insert/todos": insert({ input }),
  "@update/todos": update({ input }),
  "@delete/todos": deleteFrom(),
});
```

`upsert({ input })` も同型で定義できる。mutation 系の戻り値は既定 `void`（`returning` で結果行を返せる。「書き込みの返却」参照）。行数だけが要るときは `count({ row })`（「ページネーション」参照）。

呼び出しはキーで行い、キーはコンパイル時に検証される。

```ts
const $supabase = await $supabaseServer();
const result = await $supabase("@select/todos", { filter: (q) => q.order("created_at") });
//                              ^^^^^^^^^^^^^^ タイポはコンパイルエラー
```

戻り値は常に `Result<T, SupabaseError>`（neverthrow）。serverFn 境界では fetch / mutation とも `unwrapForClient`（`@/lib/errors`）で unwrap し、失敗はユーザー向け文言に変換して throw する。`unwrapOr` で既定値に落とすとデータ層の失敗が正常表示（空一覧など）に化けてエラー境界に届かなくなるため、既定の経路では使わない。

## エンティティ / レスポンス パターン

DB の全カラムを表す **EntitySchema** を定義し、レスポンスはそこから `.pick()`（必要なら `.extend()`／`.transform()`）で派生させる。

```ts
// 全カラム
export const TodoEntitySchema = z.object({
  id, title, completed, created_at, updated_at, category_id,
});

// レスポンス: フラット列を pick + 関連を extend + camelCase に transform
export const TodoResponseSchema = TodoEntitySchema.pick({
  id: true, title: true, completed: true, created_at: true,
})
  .extend({ category: CategorySchema.nullable() })
  .transform((row) => ({ ...row, createdAt: row.created_at }));

export type Todo = z.infer<typeof TodoResponseSchema>; // camelCase + ネスト
```

## 型安全の要：入力と出力の分離

エンジンは 1 つのスキーマから **2 つの型**を取り出して別々の用途に使う。

| 用途 | 型ソース | 例 |
|---|---|---|
| 戻り値の型 | `z.output<Schema>`（変換後） | `todo.createdAt`（camelCase） |
| filter のカラム型 | `select({ row })` の行型（変換前 ＝ 実 DB カラム） | `q.order("created_at")`（snake_case） |

この分離のおかげで、**`.transform()` で camelCase 化しても filter のカラム安全性が壊れない**。

```ts
$supabase("@select/todos", {
  filter: (q) =>
    q.eq("category_id", id)        // ✅ row（実テーブル）由来。response に無くても OK
     .order("created_at"),         // ✅ snake_case
  //  .order("createdAt")          // ❌ コンパイルエラー
});
```

`filter` に渡るのは `TypedFilterBuilder<Row>`（`query.ts`）。postgrest のよく使うメソッド（`eq`/`order`/`in`/`like`/`match` ...）をカラム名 `keyof Row` に制約した安全なサブセット。**使いたいメソッドが無ければこのインターフェースに足して拡張する。**

## join（embed）

関連テーブルは postgrest の埋め込みで取得する。

```ts
// 取得クエリに埋め込みを書く
export const GET_TODOS_QUERY =
  "id, title, completed, created_at, category:categories(id, name)";

// レスポンススキーマをネスト構造にする → 戻り値の型もネストして付く
.extend({ category: CategorySchema.nullable() })
```

- **読み取り**（関連データの表示）: 上記で型付きのまま通る。
- **絞り込み**: `select({ row: TodoEntitySchema })` を渡すことで、レスポンスに含めない外部キー（`category_id`）でも filter が型付けされる。

> **既知の二重定義**: 取得クエリ文字列（`GET_..._QUERY`）とレスポンススキーマはカラムを二重に持つが、`createSupabaseSchema` が定義時にトップレベルのカラム/エイリアスの一致を検証するため、ずれると起動・テストで即エラーになる。検証されるのはトップレベルのみで、embed の内側のカラム（`categories(id, name)` の中身）は対象外。そこだけは手動で同期する。

## ページネーション

`limit` / `range` を filter で使う。`range` は 0 始まりの閉区間。

```ts
const PAGE_SIZE = 20;
$supabase("@select/posts", {
  filter: (q) =>
    q.order("created_at", { ascending: false })
     .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
});
```

`page` は route の search params で受け、`loaderDeps` 経由で `queryOptions` のキーに含めてページ単位でキャッシュする（route 側の書き方は `add-route` skill を参照）。

総件数（ページ数の計算など）は count 操作で取る。

```ts
"@count/posts": count({ row: PostEntitySchema }), // filter を使うなら row を渡す

const total = await $supabase("@count/posts", {
  filter: (q) => q.eq("user_id", userId),
});
// Result<number>。head: true なので行は転送しない
```

## 書き込みの `match`（update / delete）

`update`/`deleteFrom` に `row`（実テーブルの全カラム）を渡すと、`match` が `Partial<Row>` で型付けされる。カラム名のタイポや値の型違いはコンパイルエラーになる。

```ts
"@update/todos": update({ input, row: TodoEntitySchema }),
"@delete/todos": deleteFrom({ row: TodoEntitySchema }),

$supabase("@update/todos", { data: { completed: true }, match: { id } });
//                                                       match: { idd: id }  ❌ コンパイルエラー
```

`row` 省略時は `match: Record<string, unknown>`（型なし）にフォールバックする。新規リソースでは `row` を渡すのを既定にする。

空の `match`（`{}`）は WHERE 句なしの全行 update / delete になってしまうため、エンジンが実行前に拒否して `SupabaseQueryError` を返す。

## 書き込みの返却（returning）

mutation の戻り値は既定 `void`。挿入/更新された行が必要なとき（例: 採番された id で詳細へ遷移、楽観 temp-id の置換）は、操作定義に `returning` を渡す。戻り値は select と同じく Zod 検証・変換を通った配列になる。

```ts
"@insert/todos": insert({
  input: AddTodoInput,
  returning: { output: z.array(TodoResponseSchema), select: GET_TODOS_QUERY },
}),

const result = await $supabase("@insert/todos", { data: { title } });
// Result<Todo[], SupabaseError>（returning なしなら Result<void, ...>）
```

- `select` 省略時は `"*"`。embed 込みで返すときは取得クエリ定数を共有する。
- `returning.select` も定義時にスキーマとの一致が検証される（select と同じ）。
- RLS 環境では返却行にも select ポリシーが効く。insert はできても select が許可されていないと行が返らない点に注意。

## サーバー / ブラウザ クライアント

- **`$supabaseServer()`** — serverFn 内で使う既定経路。cookie をリクエストごとに読むためファクトリ（毎回 `await` する）。生成時に `getSession()` でセッションを水和するため async。`.raw` で素のクライアント（auth など）にアクセスできる。
- **`$supabaseClient`** — ブラウザ用。mutation の既定経路では **ない**。Realtime 購読などブラウザ直叩きが必要なときだけの opt-in。

`lib/supabase/index.ts` はエンジン API だけを re-export し、クライアント実体は出さない（環境を跨いだ誤 import を防ぐため、`./server` `./client` から直接 import する）。

## 対応しないこと（referencedTable）

関連テーブルの**列**での型付き filter/order（postgrest の `referencedTable`。例: `order("name", { referencedTable: "categories" })` や `eq("categories.name", ...)`）は、**意図的に非対応**とする。

- **理由**: embed の型情報をエンジンへ持ち込むと `TypedFilterBuilder` 全メソッドの型が複雑化し、可読性のコストが利得を上回るため。実行時には dotted カラム指定はそのまま動く（無いのは型の保証だけ）。
- **必要になったら** `$supabaseServer().raw` で素のクライアントに退避する。
- 関連クエリが主役級になるアプリでは、この判断ごと見直して層を拡張するか、Supabase 公式の型生成（`supabase gen types`）併用を検討する。
