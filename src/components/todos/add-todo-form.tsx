// @sample-todos: todo サンプルの一部。strip-sample skill で削除される。
import { useForm } from "@tanstack/react-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddTodo } from "@/hooks/use-add-todo";
import { AddTodoInput } from "@/schemas/todos";

export function AddTodoForm() {
  const addTodo = useAddTodo();

  const form = useForm({
    defaultValues: { title: "" },
    validators: { onSubmit: AddTodoInput },
    onSubmit: ({ value }) => {
      // 楽観的更新（useAddTodo）が即時反映するため、完了を待たずリセットする。
      addTodo.mutate({ title: value.title.trim() });
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="flex gap-2"
    >
      <form.Field name="title">
        {(field) => (
          <Input
            name={field.name}
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder="新しい Todo を入力..."
            aria-label="新しい Todo"
          />
        )}
      </form.Field>
      <form.Subscribe selector={(s) => s.values.title.trim().length === 0}>
        {(isEmpty) => (
          <Button type="submit" disabled={isEmpty}>
            追加
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
