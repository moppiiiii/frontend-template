import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddTodo } from "@/hooks/use-add-todo";

export function AddTodoForm() {
  const [title, setTitle] = useState("");
  const addTodo = useAddTodo();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addTodo.mutate({ title: trimmed });
    setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="新しい Todo を入力..."
        aria-label="新しい Todo"
      />
      <Button type="submit" disabled={!title.trim()}>
        追加
      </Button>
    </form>
  );
}
