import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useRemoveTodo } from "@/hooks/use-remove-todo";
import { useToggleTodo } from "@/hooks/use-toggle-todo";
import { cn } from "@/lib/utils";
import type { Todo } from "@/schemas/todos";

export function TodoItem({ todo }: { todo: Todo }) {
  const toggle = useToggleTodo();
  const remove = useRemoveTodo();

  return (
    <li className="flex items-center gap-3 py-2">
      <Switch
        checked={todo.completed}
        onCheckedChange={(completed) =>
          toggle.mutate({ id: todo.id, completed })
        }
        aria-label={`「${todo.title}」を完了にする`}
      />
      <span
        className={cn(
          "flex-1",
          todo.completed && "text-muted-foreground line-through",
        )}
      >
        {todo.title}
      </span>
      {todo.category && (
        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
          {todo.category.name}
        </span>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => remove.mutate({ id: todo.id })}
      >
        削除
      </Button>
    </li>
  );
}
