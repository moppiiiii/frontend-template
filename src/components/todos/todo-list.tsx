import type { Todo } from "@/schemas/todos";
import { TodoItem } from "./todo-item";

export function TodoList({ todos }: { todos: Todo[] }) {
  if (todos.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        Todo はまだありません。
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
