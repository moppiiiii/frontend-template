-- @sample-todos: todo サンプルの一部。strip-sample skill で削除される。
-- 行レベル認可の正本はこのポリシー（serverFn では所有者チェックを書かない）。

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

alter table public.categories enable row level security;

create policy "authenticated can read categories"
  on public.categories for select to authenticated
  using (true);

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category_id uuid references public.categories (id),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade
);

create index todos_user_id_idx on public.todos (user_id);
create index todos_category_id_idx on public.todos (category_id);

alter table public.todos enable row level security;

-- 所有者のみ読み書き可。auth.uid() は Supabase 方言のため、
-- 別バックエンドへ移行する場合はこの防衛線を serverFn 層へ移す。
create policy "owner can select todos"
  on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "owner can insert todos"
  on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "owner can update todos"
  on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "owner can delete todos"
  on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);

-- updated_at の自動更新
create extension if not exists moddatetime with schema extensions;

create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function extensions.moddatetime (updated_at);
