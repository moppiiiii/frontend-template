// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// serverFn をモックし、「成功時に user キャッシュへ反映される」契約だけを検証する
//（use-toggle-todo.test.tsx と同じ切り離し方）。
const signIn = vi.fn();
const queryFn = vi.fn();
vi.mock("@/server/auth", () => ({
  signIn: (args: unknown) => signIn(args),
  userQueryOptions: () => ({ queryKey: ["auth", "user"], queryFn }),
}));

// モック定義後に import する（vi.mock は巻き上げられる）。
const { useSignIn } = await import("./use-sign-in");

const credentials = { email: "user@example.com", password: "password1" };
const user = { id: "u-1", email: credentials.email };

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSignIn", () => {
  it("成功時: serverFn の user をキャッシュへ反映する", async () => {
    signIn.mockResolvedValue(user);
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useSignIn(), { wrapper });

    act(() => {
      result.current.mutate(credentials);
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(["auth", "user"])).toEqual(user);
    expect(signIn).toHaveBeenCalledWith({ data: credentials });
  });

  it("失敗時: キャッシュを触らず error として返す", async () => {
    signIn.mockRejectedValue(new Error("ログインできませんでした。"));
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useSignIn(), { wrapper });

    act(() => {
      result.current.mutate(credentials);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(queryClient.getQueryData(["auth", "user"])).toBeUndefined();
    expect(result.current.error?.message).toBe("ログインできませんでした。");
  });
});
