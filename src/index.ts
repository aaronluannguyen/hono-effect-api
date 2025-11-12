import { Hono } from "hono";
import { Effect, Runtime } from "effect";
import { TodoService, TodoServiceLiveLayer } from "./services/TodoService";
import { TodoNotFoundError, ValidationError } from "./errors";
import type { CreateTodoInput, UpdateTodoInput } from "./types";

// Create a runtime with our TodoService
const runtime = Effect.runSync(
  Effect.scoped(Runtime.make(TodoServiceLiveLayer))
);

// Helper function to run Effect programs and handle errors
async function runEffect<A, E>(
  effect: Effect.Effect<A, E, TodoService>
): Promise<{ success: true; data: A } | { success: false; error: E }> {
  const result = await Runtime.runPromiseEither(runtime)(effect);

  if (result._tag === "Right") {
    return { success: true, data: result.right };
  } else {
    return { success: false, error: result.left };
  }
}

// Create Hono app
const app = new Hono();

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Hono + Effect + Bun REST API",
    version: "1.0.0",
    endpoints: {
      "GET /todos": "Get all todos",
      "GET /todos/:id": "Get a todo by ID",
      "POST /todos": "Create a new todo",
      "PUT /todos/:id": "Update a todo",
      "DELETE /todos/:id": "Delete a todo",
    },
  });
});

// GET /todos - Get all todos
app.get("/todos", async (c) => {
  const program = Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.getAll;
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch todos" }, 500);
  }
});

// GET /todos/:id - Get a todo by ID
app.get("/todos/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.getById(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof TodoNotFoundError) {
      return c.json({ error: `Todo with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to fetch todo" }, 500);
  }
});

// POST /todos - Create a new todo
app.post("/todos", async (c) => {
  const body = await c.req.json<CreateTodoInput>();

  const program = Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.create(body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data, 201);
  } else {
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    return c.json({ error: "Failed to create todo" }, 500);
  }
});

// PUT /todos/:id - Update a todo
app.put("/todos/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdateTodoInput>();

  const program = Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.update(id, body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof TodoNotFoundError) {
      return c.json({ error: `Todo with id ${id} not found` }, 404);
    }
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    return c.json({ error: "Failed to update todo" }, 500);
  }
});

// DELETE /todos/:id - Delete a todo
app.delete("/todos/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.delete(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json({ message: `Todo with id ${id} deleted successfully` });
  } else {
    if (result.error instanceof TodoNotFoundError) {
      return c.json({ error: `Todo with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to delete todo" }, 500);
  }
});

// Start the server
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
