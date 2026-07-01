// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Todo } from "@/schemas/todos";

// serverFn とクエリ定義をモックし、ネットワーク・サーバー実体を切り離して
// 「楽観的更新 → 巻き戻し」だけを検証する（onMutate/onError/onSettled の契約）。
const toggleTodo = vi.fn();
const queryFn = vi.fn();
vi.mock("@/server/todos", () => ({
  toggleTodo: (args: unknown) => toggleTodo(args),
  todosQueryOptions: () => ({ queryKey: ["todos"], queryFn }),
}));

// モック定義後に import する（vi.mock は巻き上げられる）。
const { useToggleTodo } = await import("./use-toggle-todo");

const ID = "00000000-0000-0000-0000-000000000000";
const todo = (over: Partial<Todo> = {}): Todo => ({
  id: ID,
  title: "牛乳を買う",
  completed: false,
  createdAt: "2020-01-01T00:00:00Z",
  category: null,
  ...over,
});

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData<Todo[]>(["todos"], [todo()]);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const cache = () => queryClient.getQueryData<Todo[]>(["todos"]);
  return { queryClient, wrapper, cache };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useToggleTodo", () => {
  it("楽観的更新: 解決前にキャッシュを即時反映し、成功後も維持する", async () => {
    // 手動で解決できる保留 Promise。解決前のキャッシュ状態を観測する。
    let resolve!: () => void;
    toggleTodo.mockReturnValue(
      new Promise<void>((r) => {
        resolve = () => r();
      }),
    );
    const { wrapper, cache } = setup();
    const { result } = renderHook(() => useToggleTodo(), { wrapper });

    act(() => {
      result.current.mutate({ id: ID, completed: true });
    });

    // まだ serverFn が解決していないのに、楽観値が入っている。
    await waitFor(() => {
      expect(cache()).toEqual([todo({ completed: true })]);
    });
    expect(result.current.isPending).toBe(true);

    act(() => {
      resolve();
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    // 成功後も楽観値が維持される（巻き戻さない）。
    expect(cache()).toEqual([todo({ completed: true })]);
    expect(toggleTodo).toHaveBeenCalledWith({
      data: { id: ID, completed: true },
    });
  });

  it("失敗時: スナップショットへ巻き戻す", async () => {
    toggleTodo.mockRejectedValue(new Error("boom"));
    const { wrapper, cache } = setup();
    const { result } = renderHook(() => useToggleTodo(), { wrapper });

    act(() => {
      result.current.mutate({ id: ID, completed: true });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    // onError で onMutate 前のスナップショット（completed:false）へ戻る。
    expect(cache()).toEqual([todo({ completed: false })]);
  });
});
