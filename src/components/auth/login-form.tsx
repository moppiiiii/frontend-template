import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSignIn } from "@/hooks/use-sign-in";
import { CredentialsSchema } from "@/schemas/auth";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const signIn = useSignIn();

  const dest = redirectTo ?? "/";
  const authError = signIn.error;

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: CredentialsSchema },
    onSubmit: async ({ value }) => {
      try {
        await signIn.mutateAsync(value);
        navigate({ href: dest });
      } catch {
        // 失敗はミューテーションの error として表示する（submit 自体は完了扱い）。
      }
    },
  });

  return (
    <div className="mx-auto max-w-sm space-y-6 p-8">
      <h1 className="text-2xl font-bold">ログイン</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="email">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>メールアドレス</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
                required
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="space-y-1.5">
              <Label htmlFor={field.name}>パスワード</Label>
              <Input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="current-password"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                aria-invalid={field.state.meta.errors.length > 0}
                required
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        {authError ? (
          <p className="text-destructive text-sm" role="alert">
            {authError.message}
          </p>
        ) : null}

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              ログイン
            </Button>
          )}
        </form.Subscribe>
      </form>
    </div>
  );
}

// フィールド検証エラー（zod の issue）を 1 行で表示する小さなヘルパー。
function FieldError({
  errors,
}: {
  errors: ReadonlyArray<{ message?: string } | undefined>;
}) {
  if (errors.length === 0) return null;
  return (
    <p className="text-destructive text-sm" role="alert">
      {errors
        .map((e) => e?.message)
        .filter(Boolean)
        .join(", ")}
    </p>
  );
}
