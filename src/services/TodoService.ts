import { Context, Effect, Layer, Array as EffectArray } from "effect";
import type { Todo, CreateTodoInput, UpdateTodoInput } from "../types";
import { TodoNotFoundError, ValidationError } from "../errors";

// Define the service interface
export class TodoService extends Context.Tag("TodoService")<
  TodoService,
  {
    readonly getAll: Effect.Effect<Array<Todo>, never>;
    readonly getById: (id: string) => Effect.Effect<Todo, TodoNotFoundError>;
    readonly create: (
      input: CreateTodoInput
    ) => Effect.Effect<Todo, ValidationError>;
    readonly update: (
      id: string,
      input: UpdateTodoInput
    ) => Effect.Effect<Todo, TodoNotFoundError | ValidationError>;
    readonly delete: (id: string) => Effect.Effect<void, TodoNotFoundError>;
  }
>() {}

// In-memory storage implementation
class TodoServiceLive {
  private todos: Map<string, Todo> = new Map();
  private idCounter = 1;

  getAll = Effect.sync(() => Array.from(this.todos.values()));

  getById = (id: string) =>
    Effect.gen(this, function* () {
      const todo = this.todos.get(id);
      if (!todo) {
        return yield* Effect.fail(new TodoNotFoundError({ id }));
      }
      return todo;
    });

  create = (input: CreateTodoInput) =>
    Effect.gen(this, function* () {
      // Validation
      if (!input.title || input.title.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Title is required" })
        );
      }

      const id = (this.idCounter++).toString();
      const now = new Date();
      const todo: Todo = {
        id,
        title: input.title,
        description: input.description,
        completed: false,
        createdAt: now,
        updatedAt: now,
      };

      this.todos.set(id, todo);
      return todo;
    });

  update = (id: string, input: UpdateTodoInput) =>
    Effect.gen(this, function* () {
      const todo = yield* this.getById(id);

      // Validation
      if (input.title !== undefined && input.title.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Title cannot be empty" })
        );
      }

      const updatedTodo: Todo = {
        ...todo,
        title: input.title ?? todo.title,
        description: input.description ?? todo.description,
        completed: input.completed ?? todo.completed,
        updatedAt: new Date(),
      };

      this.todos.set(id, updatedTodo);
      return updatedTodo;
    });

  delete = (id: string) =>
    Effect.gen(this, function* () {
      const todo = yield* this.getById(id);
      this.todos.delete(id);
    });
}

// Create the service layer
export const TodoServiceLiveLayer = Layer.sync(TodoService, () => {
  const service = new TodoServiceLive();
  return {
    getAll: service.getAll,
    getById: service.getById,
    create: service.create,
    update: service.update,
    delete: service.delete,
  };
});
