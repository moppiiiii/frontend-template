import { describe, expect, it } from "vitest";

import { CredentialsSchema, LoginSearchSchema } from "./auth";

describe("LoginSearchSchema", () => {
  it("アプリ内パスはそのまま通す", () => {
    expect(LoginSearchSchema.parse({ redirect: "/dashboard" })).toEqual({
      redirect: "/dashboard",
    });
  });

  it("未指定なら undefined のまま", () => {
    expect(LoginSearchSchema.parse({})).toEqual({ redirect: undefined });
  });

  it.each([
    ["絶対 URL", "https://evil.com"],
    ["プロトコル相対", "//evil.com"],
    ["バックスラッシュ（ブラウザが / に正規化）", "/\\evil.com"],
    ["先頭が / でない", "evil.com"],
  ])("オープンリダイレクトになる %s は未指定扱いに落とす", (_label, value) => {
    expect(LoginSearchSchema.parse({ redirect: value })).toEqual({
      redirect: undefined,
    });
  });
});

describe("CredentialsSchema", () => {
  it("正しい形式を通す", () => {
    expect(
      CredentialsSchema.safeParse({
        email: "user@example.com",
        password: "password1",
      }).success,
    ).toBe(true);
  });

  it("メール形式でない email を弾く", () => {
    expect(
      CredentialsSchema.safeParse({
        email: "not-an-email",
        password: "password1",
      }).success,
    ).toBe(false);
  });

  it("8 文字未満のパスワードを弾く", () => {
    expect(
      CredentialsSchema.safeParse({
        email: "user@example.com",
        password: "short",
      }).success,
    ).toBe(false);
  });
});
