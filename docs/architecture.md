# アーキテクチャ

## ディレクトリ構成

```
src/
  routes/                 # TanStack Router のファイルルート。薄く保つ（loader + 画面シェルのみ）
  components/
    ui/                   # shadcn/ui プリミティブ（考えずに置く）
    <feature>/            # 機能ごとの画面パーツ（例: todos/）
  hooks/                  # use-<action>-<resource>.ts（楽観的更新の useMutation など）
  server/                 # serverFn（fetch / mutation 両方）＋ queryOptions。1 リソース 1 ファイル
    <resource>.ts
  schemas/                # zod スキーマ＋取得クエリ定数。1 リソース 1 ファイル
    <resource>.ts
    index.ts              # 全断片を appSchema に合流（単一の真実）
  lib/
    supabase/
      query.ts            # スキーマ駆動の型安全クエリエンジン
      client.ts           # $supabaseClient（ブラウザ・Realtime 等の直叩き用 opt-in）
      server.ts           # $supabaseServer（cookie 対応のファクトリ）
      index.ts            # エンジン公開 API の barrel
    errors.ts             # serverFn 境界のエラー処理（詳細はログへ、クライアントへは安全な文言）
    utils.ts              # cn など純粋ヘルパー
  integrations/           # tanstack-query provider など、フレームワーク配線
  env.ts                  # t3-env による環境変数（型＋実行時バリデーション）
  router.tsx
supabase/
  migrations/             # テーブル定義・RLS ポリシーの正本（SQL）
```

## 「どこに何を置くか」の規約

| 判断 | 置き場 |
|---|---|
| 汎用の見た目部品（button, input...） | `components/ui/` |
| 特定機能の画面パーツ | `components/<feature>/` |
| サーバーで動かす処理（fetch / mutation） | `server/<resource>.ts` |
| zod スキーマ・取得クエリ | `schemas/<resource>.ts` |
| 楽観的更新などのクライアントロジック | `hooks/use-*.ts` |
| エラー / 404 / pending の境界 UI | `components/boundaries/` |
| 横断的な純粋ヘルパー | `lib/` |
| テーブル定義・RLS ポリシー | `supabase/migrations/*.sql` |

原則:

- **routes は薄く**。loader で fetch を起動し、ロジックは `server/` `hooks/` `components/` から import するだけ。
- **フォルダは横に並べる**。深い階層は掘らない（`server/todos.ts` であって `server/todos/queries/...` ではない）。
- **環境変数は `env.ts` 経由**。`import.meta.env.X` を直接使わない（例: ページ `<title>` は `env.VITE_APP_TITLE` を `__root.tsx` で参照）。

## フォーム

入力フォームは **`@tanstack/react-form`（`useForm` ＋ `form.Field`）** で書く。素の `useState` で値を持たない。

- **検証は `schemas/` の zod を共有する**。`validators: { onSubmit: CredentialsSchema }` のように `.validator()` と同じスキーマを渡し、UI 側で zod を二重定義しない（[data-access.md](./data-access.md) の「スキーマを単一の真実」と同じ方針）。
- **送信は serverFn を叩くフック（`hooks/use-*`）へ委譲する**。`onSubmit` で `mutation.mutateAsync(value)` を呼び、成功時に遷移、失敗は `mutation.error` として表示する。
- 1 フォームで複数アクションがあるとき（例: 下書き保存／公開）は `onSubmitMeta` でどのボタンから送信したかを判別する。

雛形は `src/components/auth/login-form.tsx`（`useSignIn` に委譲、`CredentialsSchema` でフィールド検証）。route（`src/routes/login.tsx`）は薄く保ち、search を読んでこのフォームへ渡すだけにする。

## スタイリング

**Tailwind ユーティリティを各コンポーネントの `className` に直接書く**のが唯一のスタイリング手段。CSS ファイルにコンポーネント用クラスを定義しない。

- **`src/styles.css` はトークンとグローバルのみ**。置いてよいのは、デザイントークン（`:root` / `.dark` の CSS 変数、`@theme`）、要素セレクタのグローバルスタイル（`body`, `a`, `code` など）、`@layer base`。`.foo-card` のようなクラス定義を追加した時点で規約違反。
- **見た目の繰り返しはクラス抽出ではなくコンポーネント抽出で解決する**。同じ組み合わせを 3 回書きたくなったら `components/ui/`（バリアントは cva）か `components/<feature>/` に部品化する。
- **色・角丸などはトークン経由**（`bg-background`, `text-muted-foreground`, `rounded-lg` …）。任意値（`bg-[#123456]`）やコンポーネント内のハードコード色は避け、必要なら styles.css のトークンに追加してから使う。
- クラス結合・条件分岐は `lib/utils.ts` の `cn()` を使う。

## エラー / 404 / pending 境界

例外・未一致 URL・ローダー待ちのフォールバックは **`router.tsx` の `default*Component` で 1 度だけ定義**し、全ルートが継承する（認証ガードと同じ「define once」方針）。個別ルートで `errorComponent` 等を渡せば上書きできる。

```
router.tsx
  defaultErrorComponent    → components/boundaries/root-error.tsx     # throw の受け皿（再試行 + ホーム）
  defaultNotFoundComponent → components/boundaries/not-found.tsx      # 未一致 URL / notFound()
  defaultPendingComponent  → components/boundaries/route-pending.tsx  # ローダー待ちの骨組み
```

これら 3 つは「分類（エラーか否か）」ではなく「役割（router の境界フォールバック＝一緒に配線・継承される）」で括り、`components/boundaries/` に同居させる。

- **`useSuspenseQuery` の fetch 失敗は throw として浮上**し、最も近い `errorComponent`（既定は上記）に捕まる。境界が無いと画面全体が白落ちするため、テンプレの既定として全ルートに敷いている。
- **`redirect()` は例外ではなく制御フロー**。未ログイン→`/login` のガード（`_authed/route.tsx`）は `errorComponent` には落ちず、Router が遷移として処理する。
- 特定ルートだけ独自のエラー表示にしたいときは、その route に `errorComponent` / `notFoundComponent` / `pendingComponent` を直接書く（既定より優先される）。

## データフロー

### 読み取り（SSR ファースト）

```
route loader
  → queryClient.ensureQueryData(todosQueryOptions())
    → getTodos()  [serverFn]
      → $supabaseServer()("@select/todos", { filter })
        → postgrest → zod 検証 → Result<Todo[]>
  → コンポーネントは useSuspenseQuery(todosQueryOptions()) で同じキャッシュを購読
```

初回表示はサーバーで fetch 済みのデータがキャッシュに載った状態でレンダリングされる。

クエリのグローバル既定は `staleTime: 30_000`（`integrations/tanstack-query/root-provider.tsx`）。0 だと SSR で loader が載せたデータがハイドレーション直後に stale 扱いになり、クライアントで即再フェッチ（二重フェッチ）が走るのを防ぐための値。auth の user クエリだけはガードの失効検知（`revalidateIfStale` との組）に関わるため、グローバル既定に依存させず `userQueryOptions` 側で明示している。

### 書き込み（serverFn ＋ 楽観的更新）

```
コンポーネント
  → useToggleTodo().mutate(vars)        [hooks/]
    → onMutate: TanStack Query キャッシュを即時更新（楽観）
    → mutationFn: toggleTodo({ data })  [serverFn]
       → $supabaseServer()("@update/todos", { data, match })
    → onError: スナップショットへ巻き戻し
    → onSettled: invalidateQueries で再同期
```

**mutation の実体はサーバー（serverFn）**だが、即時の UI 反映は「キャッシュ操作」の責務として `onMutate` で行う。これにより検証・認可をサーバーに集約しつつ楽観更新も両立する。

## 認証ガード（保護ルート）

保護したいルートは pathless レイアウトルート `_authed`（先頭 `_` = URL に出ない）の下にまとめる。ガードは `beforeLoad` に 1 度だけ書き、配下ルートが継承する。保護ページを増やすときは `routes/_authed/` にファイルを置くだけでよい。

```
routes/_authed/route.tsx      # beforeLoad で user を確定 → 未ログインは /login へ redirect
routes/_authed/dashboard.tsx  # 配下（URL: /dashboard）。context.user は非 null が保証される
routes/login.tsx              # 未ログイン用。ログイン済みなら遷移先へ redirect
```

`_authed` という名前は任意（`_protected` 等でも可）。意味を持つのは先頭の `_`（pathless）だけ。保護ページが 1 枚だけなら、そのルートに直接 `beforeLoad` を書いてもよい（レイアウト不要）。

```ts
// routes/_authed/route.tsx
beforeLoad: async ({ context, location }) => {
  const user = await context.queryClient.ensureQueryData({
    ...userQueryOptions(),
    revalidateIfStale: true, // stale なら裏で再検証（セッション失効を放置しない）
  });
  if (!user) throw redirect({ to: "/login", search: { redirect: location.href } });
  return { user }; // 配下ルートの context にマージされる
},
```

- **user の取得は `userQueryOptions()`（= `getUser` serverFn）経由**。`ensureQueryData` なので SSR・遷移で二重に叩かず、`use-sign-*` フックのキャッシュ更新と一貫する。
- **行レベルの認可は Supabase RLS が正**。serverFn 側で所有者チェックを書かないのは、RLS（＋ Cookie セッション）を単一の防衛線に寄せているため。ガードは「未ログインを弾く」までを担う。
- **RLS ポリシーとテーブル定義の正本は `supabase/migrations/` の SQL**。テーブルを足すときは必ず `enable row level security` とポリシーをセットで書く（RLS を有効にし忘れると全行が公開される）。ポリシー内の `auth.uid()` は Supabase 方言のため、別バックエンドへ移行する場合はこの防衛線を serverFn 層の認可へ移す。

## テスト

Vitest ＋ Testing Library。テストは対象ファイルの隣に `*.test.ts(x)` を置き、`bun run test` で実行する（DOM が要るファイルは先頭に `// @vitest-environment jsdom`）。

- **フック（楽観的更新）**: serverFn を `vi.mock` で切り離し、「即時反映 → 失敗で巻き戻し」のキャッシュ契約を `renderHook` で検証する（例: `src/hooks/use-sign-in.test.tsx`）。
- **クエリエンジン**: PostgREST ビルダーのモックで `Result` の成否・検証動作を確認する（`src/lib/supabase/query.test.ts`）。
- **型契約**: `expectTypeOf` ＋ `@ts-expect-error` で書く。実行時ではなく `bun run check`（tsgo）が検証する。

詳しいクエリ層の仕組みは [data-access.md](./data-access.md) を参照。
