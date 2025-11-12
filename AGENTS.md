# AI Agent Guide - Hono + Effect + Bun REST API

This document provides guidance for AI coding agents working on this project.

## Project Overview

**Stack:**
- **Runtime:** Bun (also used for package management)
- **Framework:** Hono (lightweight web framework)
- **Effect System:** EffectTS (functional programming, error handling, DI)
- **Database:** PostgreSQL with Drizzle ORM (type-safe queries and migrations)
- **Language:** TypeScript

**Purpose:** A REST API template demonstrating best practices for combining Hono with EffectTS and PostgreSQL.

## Architecture Patterns

### 1. Effect Service Layer Pattern

All business logic is encapsulated in Effect services with dependency injection:

```typescript
// Service definition using Context.Tag
export class ServiceName extends Context.Tag("ServiceName")<
  ServiceName,
  {
    readonly method1: Effect.Effect<ReturnType, ErrorType>;
    readonly method2: (param: Type) => Effect.Effect<ReturnType, ErrorType>;
  }
>() {}

// Implementation
class ServiceNameLive {
  method1 = Effect.gen(function* () {
    // Implementation using Effect.gen for composability
  });
}

// Layer for dependency injection
export const ServiceNameLiveLayer = Layer.sync(ServiceName, () => {
  const service = new ServiceNameLive();
  return {
    method1: service.method1,
    method2: service.method2,
  };
});
```

### 2. Error Handling Pattern

Use tagged errors for type-safe error handling:

```typescript
// Define errors in src/errors.ts
export class CustomError extends Data.TaggedError("CustomError")<{
  field: string;
}> {}

// Use in service methods
someMethod = (id: string) =>
  Effect.gen(this, function* () {
    const item = this.items.get(id);
    if (!item) {
      return yield* Effect.fail(new CustomError({ field: id }));
    }
    return item;
  });
```

### 3. Hono Integration Pattern

Each route follows this pattern:

```typescript
app.get("/resource/:id", async (c) => {
  const id = c.req.param("id");

  // 1. Define Effect program
  const program = Effect.gen(function* () {
    const service = yield* ServiceName;
    return yield* service.getById(id);
  });

  // 2. Run program
  const result = await runEffect(program);

  // 3. Handle result
  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof SpecificError) {
      return c.json({ error: "message" }, 404);
    }
    return c.json({ error: "Failed" }, 500);
  }
});
```

## File Structure

```
src/
├── index.ts                 # Main app: Hono routes, runtime, server setup
├── types.ts                 # TypeScript interfaces and types
├── errors.ts                # Effect tagged errors
├── db/
│   ├── schema.ts            # Drizzle ORM schema definitions
│   ├── connection.ts        # Database connection setup
│   └── migrate.ts           # Migration runner script
└── services/
    ├── DatabaseService.ts   # Database connection service (Effect layer)
    ├── UserService.ts       # User service with Drizzle operations
    └── PostService.ts       # Post service with Drizzle operations
```

### File Responsibilities

**src/index.ts:**
- Creates Effect runtime with service layers
- Defines Hono app and routes
- Handles HTTP request/response
- Runs Effect programs and handles results
- Exports server configuration

**src/types.ts:**
- Domain model interfaces
- Input/output DTOs
- No logic, pure type definitions

**src/errors.ts:**
- Tagged error classes using `Data.TaggedError`
- One error class per error type
- Include relevant context fields

**src/db/schema.ts:**
- Drizzle ORM table definitions
- Database schema with types
- Table relationships
- Type exports for services

**src/db/connection.ts:**
- PostgreSQL client creation
- Drizzle instance setup
- Connection configuration
- Type exports for DrizzleDb

**src/db/migrate.ts:**
- Migration runner script
- Applies pending migrations
- Used in deployment setup

**src/services/DatabaseService.ts:**
- Database connection Effect service
- Manages connection lifecycle
- Provides DrizzleDb instance
- Handles cleanup on scope end

**src/services/[Service].ts:**
- Service interface using `Context.Tag`
- Service implementation class
- Service layer for DI
- All business logic returns `Effect` types
- Database operations using Drizzle ORM

## Key Concepts for AI Agents

### Effect.gen Usage

The `Effect.gen` function allows imperative-style code with full type safety:

```typescript
// Use 'this' binding for instance methods
method = (id: string) =>
  Effect.gen(this, function* () {
    // Use yield* to unwrap Effects
    const item = yield* this.getById(id);

    // Can use normal control flow
    if (condition) {
      return yield* Effect.fail(new Error());
    }

    // Return value is automatically wrapped in Effect
    return item;
  });

// For standalone programs (not instance methods)
const program = Effect.gen(function* () {
  const service = yield* ServiceName;
  return yield* service.method();
});
```

### Runtime Management

The current implementation uses a single runtime:

```typescript
// Create runtime once at app startup with layered dependencies
// PostService depends on UserService, both depend on DatabaseService
const runtime = Effect.runSync(
  Effect.scoped(
    Runtime.make(
      Layer.provide(
        Layer.merge(UserServiceLive, PostServiceLive),
        DatabaseServiceLive
      )
    )
  )
);

// Helper to run programs
async function runEffect<A, E>(
  effect: Effect.Effect<A, E, UserService | PostService | DatabaseService>
) {
  const result = await Runtime.runPromiseEither(runtime)(effect);
  // Returns Either type for error handling
}
```

### Type-Safe Error Handling

All errors are typed in the Effect signature:

```typescript
// Method signature shows possible errors
readonly getById: (id: string) => Effect.Effect<User, UserNotFoundError>;

// Multiple errors use union types
readonly create: (input: CreatePostInput) =>
  Effect.Effect<Post, ValidationError | UserNotFoundError>;
```

## Development Commands

```bash
bun install            # Install dependencies
bun run dev            # Development with auto-reload
bun run start          # Production mode
bun run build          # Build project
bun run typecheck      # Type checking

# Database commands
bun run db:generate    # Generate migration files from schema
bun run db:migrate     # Run pending migrations
bun run db:studio      # Open Drizzle Studio (database GUI)
```

## Adding New Features

### Adding a New Service

1. **Define types** in `src/types.ts`:
   ```typescript
   export interface Resource {
     id: string;
     name: string;
   }
   ```

2. **Define errors** in `src/errors.ts`:
   ```typescript
   export class ResourceNotFoundError extends Data.TaggedError("ResourceNotFoundError")<{
     id: string;
   }> {}
   ```

3. **Create service** in `src/services/ResourceService.ts`:
   ```typescript
   export class ResourceService extends Context.Tag("ResourceService")<
     ResourceService,
     { /* methods */ }
   >() {}

   class ResourceServiceLive { /* implementation */ }

   export const ResourceServiceLiveLayer = Layer.sync(/* ... */);
   ```

4. **Create service layer** (depends on DatabaseService if needed):
   ```typescript
   export const ResourceServiceLive = Layer.effect(
     ResourceService,
     Effect.gen(function* () {
       yield* DatabaseService;  // If database access needed
       const service = new ResourceServiceLive();
       return { /* service methods */ };
     })
   );
   ```

5. **Update runtime** in `src/index.ts`:
   ```typescript
   const runtime = Effect.runSync(
     Effect.scoped(Runtime.make(
       Layer.provide(
         Layer.mergeAll(UserServiceLive, PostServiceLive, ResourceServiceLive),
         DatabaseServiceLive
       )
     ))
   );
   ```

6. **Add routes** in `src/index.ts` following the pattern above

### Adding a New Endpoint

1. Define the route handler in `src/index.ts`
2. Extract parameters/body
3. Create Effect program using the service
4. Run program with `runEffect`
5. Handle success/error cases
6. Return appropriate HTTP response

## Common Patterns

### Validation

```typescript
create = (input: CreateInput) =>
  Effect.gen(this, function* () {
    // Validate input
    if (!input.field || input.field.trim().length === 0) {
      return yield* Effect.fail(
        new ValidationError({ message: "Field is required" })
      );
    }

    // Process...
  });
```

### Composing Effects

```typescript
complexOperation = (id: string) =>
  Effect.gen(this, function* () {
    // Chain multiple operations
    const item = yield* this.getById(id);
    const updated = yield* this.update(id, { /* changes */ });
    const validated = yield* this.validate(updated);
    return validated;
  });
```

### Dependency Injection

```typescript
// Services can depend on other services
const program = Effect.gen(function* () {
  const userService = yield* UserService;
  const postService = yield* PostService;

  const user = yield* userService.getById("1");
  const posts = yield* postService.getByUserId(user.id);

  return { user, posts };
});
```

## Important Conventions

1. **Service methods always return Effect types**
   - Never throw exceptions
   - Use `Effect.fail()` for errors
   - Use `Effect.sync()` or `Effect.gen()` for operations

2. **Error types are explicit in signatures**
   - All possible errors listed in Effect type
   - Use union types for multiple errors
   - Handle each error type in routes

3. **No business logic in routes**
   - Routes only handle HTTP concerns
   - All logic belongs in services
   - Routes orchestrate service calls

4. **Type safety everywhere**
   - No `any` types
   - Define interfaces for all data
   - Use TypeScript strict mode

5. **Immutability**
   - Update objects with spread operator
   - Never mutate input parameters
   - Create new objects for updates

## Testing Approach

When adding tests:

1. Test services independently using Effect test utilities
2. Mock service layers for integration tests
3. Use Effect's built-in testing support
4. Test error cases explicitly

```typescript
// Example test structure (when implementing tests)
describe("UserService", () => {
  it("should create a user", async () => {
    const program = Effect.gen(function* () {
      const service = yield* UserService;
      return yield* service.create({
        username: "testuser",
        email: "test@example.com",
        displayName: "Test User"
      });
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(UserServiceLiveLayer))
    );

    expect(result.username).toBe("testuser");
  });
});
```

## Extension Points

### Database Integration

**Current Implementation:** PostgreSQL with Drizzle ORM

The project uses Drizzle ORM for type-safe database operations:

```typescript
// Service accesses database through DatabaseService
class UserServiceLive {
  getById = (id: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;  // Get Drizzle instance

      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      // Use Effect.tryPromise for async Drizzle operations
      const result = yield* Effect.tryPromise({
        try: () => db.select().from(users).where(eq(users.id, numId)).limit(1),
        catch: (error) => new DatabaseError({ message: String(error) })
      });

      const dbUser = result[0];
      if (!dbUser) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      // Map database types to domain types
      return {
        id: dbUser.id.toString(),
        username: dbUser.username,
        email: dbUser.email,
        displayName: dbUser.displayName,
        bio: dbUser.bio ?? undefined,
        createdAt: dbUser.createdAt,
        updatedAt: dbUser.updatedAt,
      };
    });
}
```

**Key Patterns:**
- Services depend on `DatabaseService` via Effect layers
- Database operations wrapped in `Effect.tryPromise`
- Drizzle provides end-to-end type safety
- Database types mapped to domain types
- Connection lifecycle managed by DatabaseService

### Authentication

Add auth as a service:

```typescript
export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly verifyToken: (token: string) => Effect.Effect<User, AuthError>;
  }
>() {}

// Use in routes
app.get("/protected", async (c) => {
  const program = Effect.gen(function* () {
    const authService = yield* AuthService;
    const token = c.req.header("Authorization");
    const user = yield* authService.verifyToken(token);
    // ... rest of logic
  });
});
```

### Logging

Add logging service:

```typescript
export class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  {
    readonly info: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
  }
>() {}

// Use in services
someMethod = (id: string) =>
  Effect.gen(this, function* () {
    const logger = yield* LoggerService;
    yield* logger.info(`Fetching item ${id}`);
    // ... logic
  });
```

## Debugging Tips

1. **Effect program not running:** Ensure you're calling `runEffect()` or similar
2. **Type errors with Effect.gen:** Check you're using `this` parameter correctly for instance methods
3. **Runtime errors:** Verify all service layers are provided to the runtime
4. **404 on valid endpoints:** Check Hono route patterns and parameter extraction

## Performance Considerations

1. **Runtime creation:** Create once at startup, not per request
2. **Effect composition:** Effect programs are lazy - they only run when executed
3. **Memory:** Current implementation uses in-memory storage (not for production)
4. **Concurrency:** Effect handles concurrent operations - use `Effect.all()` for parallel execution

## Migration Notes

If upgrading or modifying:

- **Effect version:** Check Effect changelog for breaking changes
- **Hono version:** Verify middleware and routing compatibility
- **Bun version:** Test runtime compatibility
- **TypeScript version:** Ensure Effect types work correctly

## Quick Reference

**Creating Effects:**
- `Effect.sync(() => value)` - Synchronous operation
- `Effect.gen(function* () {})` - Generator-style composition
- `Effect.tryPromise()` - Wrap promises with error handling
- `Effect.fail(error)` - Create failing Effect

**Running Effects:**
- `Runtime.runPromise(runtime)(effect)` - Returns promise
- `Runtime.runPromiseEither(runtime)(effect)` - Returns Either (success/failure)
- `Effect.runSync(effect)` - Synchronous execution (use sparingly)

**Error Handling:**
- `yield* Effect.fail(new Error())` - Fail with typed error
- `Effect.catchAll()` - Handle all errors
- `Effect.catchTag()` - Handle specific error type

**Service Usage:**
- `yield* ServiceName` - Get service from context
- `Layer.merge(layer1, layer2)` - Combine service layers
- `Effect.provide(layer)` - Provide dependencies

---

## Questions to Ask When Modifying

Before making changes, consider:

1. Does this belong in a service or a route?
2. What errors can this operation produce?
3. Are all dependencies available in the runtime?
4. Is the type signature accurate?
5. Should this be composable with other operations?
6. Is error handling comprehensive?
7. Are types explicit (no implicit any)?

## Common Mistakes to Avoid

1. ❌ Throwing exceptions instead of using `Effect.fail()`
2. ❌ Forgetting to `yield*` when unwrapping Effects
3. ❌ Using `any` types instead of proper interfaces
4. ❌ Putting business logic in route handlers
5. ❌ Creating runtime instances per request
6. ❌ Not handling all error cases in routes
7. ❌ Mutating objects instead of creating new ones
8. ❌ Forgetting to add new services to runtime layers

## Success Checklist

When implementing new features:

- [ ] Types defined in `types.ts`
- [ ] Errors defined in `errors.ts` as tagged errors
- [ ] Service interface using `Context.Tag`
- [ ] Service implementation with Effect return types
- [ ] Service layer exported
- [ ] Runtime updated with new service layer
- [ ] Routes follow the standard pattern
- [ ] All errors handled in routes
- [ ] No business logic in routes
- [ ] TypeScript compiles without errors
- [ ] Code follows existing patterns

---

This guide should enable AI agents to maintain consistency and follow best practices when working with this codebase.
