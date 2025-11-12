import { Hono } from "hono";
import { Effect, Runtime, Layer } from "effect";
import { UserService, UserServiceLiveLayer } from "./services/UserService";
import { PostService, PostServiceLiveLayer } from "./services/PostService";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  PostNotFoundError,
  ValidationError,
} from "./errors";
import type {
  CreateUserInput,
  UpdateUserInput,
  CreatePostInput,
  UpdatePostInput,
} from "./types";

// Create a runtime with our services
const runtime = Effect.runSync(
  Effect.scoped(
    Runtime.make(Layer.merge(UserServiceLiveLayer, PostServiceLiveLayer))
  )
);

// Helper function to run Effect programs and handle errors
async function runEffect<A, E>(
  effect: Effect.Effect<A, E, UserService | PostService>
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
    message: "Twitter-like API - Hono + Effect + Bun",
    version: "1.0.0",
    endpoints: {
      users: {
        "GET /users": "Get all users",
        "GET /users/:id": "Get a user by ID",
        "GET /users/username/:username": "Get a user by username",
        "POST /users": "Create a new user",
        "PUT /users/:id": "Update a user",
        "DELETE /users/:id": "Delete a user",
      },
      posts: {
        "GET /posts": "Get all posts",
        "GET /posts/:id": "Get a post by ID",
        "GET /users/:userId/posts": "Get all posts by a user",
        "POST /posts": "Create a new post",
        "PUT /posts/:id": "Update a post",
        "DELETE /posts/:id": "Delete a post",
      },
    },
  });
});

// ============================================================================
// USER ROUTES
// ============================================================================

// GET /users - Get all users
app.get("/users", async (c) => {
  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.getAll;
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch users" }, 500);
  }
});

// GET /users/:id - Get a user by ID
app.get("/users/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.getById(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// GET /users/username/:username - Get a user by username
app.get("/users/username/:username", async (c) => {
  const username = c.req.param("username");

  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.getByUsername(username);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User @${username} not found` }, 404);
    }
    return c.json({ error: "Failed to fetch user" }, 500);
  }
});

// POST /users - Create a new user
app.post("/users", async (c) => {
  const body = await c.req.json<CreateUserInput>();

  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.create(body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data, 201);
  } else {
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    if (result.error instanceof UserAlreadyExistsError) {
      return c.json(
        { error: `Username @${result.error.username} already exists` },
        409
      );
    }
    return c.json({ error: "Failed to create user" }, 500);
  }
});

// PUT /users/:id - Update a user
app.put("/users/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdateUserInput>();

  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.update(id, body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User with id ${id} not found` }, 404);
    }
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    return c.json({ error: "Failed to update user" }, 500);
  }
});

// DELETE /users/:id - Delete a user
app.delete("/users/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* UserService;
    return yield* service.delete(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json({ message: `User with id ${id} deleted successfully` });
  } else {
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

// ============================================================================
// POST ROUTES
// ============================================================================

// GET /posts - Get all posts
app.get("/posts", async (c) => {
  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.getAll;
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch posts" }, 500);
  }
});

// GET /posts/:id - Get a post by ID
app.get("/posts/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.getById(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof PostNotFoundError) {
      return c.json({ error: `Post with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to fetch post" }, 500);
  }
});

// GET /users/:userId/posts - Get all posts by a user
app.get("/users/:userId/posts", async (c) => {
  const userId = c.req.param("userId");

  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.getByUserId(userId);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch user posts" }, 500);
  }
});

// POST /posts - Create a new post
app.post("/posts", async (c) => {
  const body = await c.req.json<CreatePostInput>();

  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.create(body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data, 201);
  } else {
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User with id ${result.error.id} not found` }, 404);
    }
    return c.json({ error: "Failed to create post" }, 500);
  }
});

// PUT /posts/:id - Update a post
app.put("/posts/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdatePostInput>();

  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.update(id, body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof PostNotFoundError) {
      return c.json({ error: `Post with id ${id} not found` }, 404);
    }
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    return c.json({ error: "Failed to update post" }, 500);
  }
});

// DELETE /posts/:id - Delete a post
app.delete("/posts/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* PostService;
    return yield* service.delete(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json({ message: `Post with id ${id} deleted successfully` });
  } else {
    if (result.error instanceof PostNotFoundError) {
      return c.json({ error: `Post with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to delete post" }, 500);
  }
});

// Start the server
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
