# Comments Feature Implementation Plan

## Overview

This document outlines the implementation plan for adding a comments feature to the Twitter-like API. The feature will allow users to add text comments under posts, following the existing architecture patterns with Effect, Drizzle ORM, and Hono.

## Architecture

### Data Model

```
User (1) ----< (M) Post (1) ----< (M) Comment
                                 ^
                                 |
                            (M) User (1)
```

- Each comment belongs to one post
- Each comment is authored by one user
- A post can have many comments
- A user can author many comments

## Implementation Steps

### 1. Database Schema (`src/db/schema.ts`)

**Add Comments Table:**

```typescript
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: serial("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: serial("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Add Relations:**

```typescript
// Update postsRelations to include comments
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),  // NEW
}));

// Update usersRelations to include comments
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),  // NEW
}));

// Add commentsRelations
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));
```

**Type Exports:**

```typescript
export type DbComment = typeof comments.$inferSelect;
export type DbCommentInsert = typeof comments.$inferInsert;
```

### 2. Domain Types (`src/types.ts`)

**Add Comment Types:**

```typescript
// Comment types
export interface Comment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentInput {
  postId: string;
  userId: string;
  content: string;
}

export interface UpdateCommentInput {
  content?: string;
}
```

### 3. Error Definitions (`src/errors.ts`)

**Add Comment Errors:**

```typescript
// Comment errors
export class CommentNotFoundError extends Data.TaggedError("CommentNotFoundError")<{
  id: string;
}> {}

export class UnauthorizedCommentActionError extends Data.TaggedError(
  "UnauthorizedCommentActionError"
)<{
  commentId: string;
  userId: string;
}> {}
```

### 4. Comment Service (`src/services/CommentService.ts`)

**Service Interface:**

```typescript
export class CommentService extends Context.Tag("CommentService")<
  CommentService,
  {
    readonly getById: (
      id: string
    ) => Effect.Effect<Comment, CommentNotFoundError | DatabaseError>;

    readonly getByPostId: (
      postId: string
    ) => Effect.Effect<Array<Comment>, DatabaseError>;

    readonly getByUserId: (
      userId: string
    ) => Effect.Effect<Array<Comment>, DatabaseError>;

    readonly create: (
      input: CreateCommentInput
    ) => Effect.Effect<
      Comment,
      ValidationError | PostNotFoundError | UserNotFoundError | DatabaseError
    >;

    readonly update: (
      id: string,
      input: UpdateCommentInput,
      requestingUserId: string
    ) => Effect.Effect<
      Comment,
      | CommentNotFoundError
      | ValidationError
      | UnauthorizedCommentActionError
      | DatabaseError
    >;

    readonly delete: (
      id: string,
      requestingUserId: string
    ) => Effect.Effect<
      void,
      | CommentNotFoundError
      | UnauthorizedCommentActionError
      | DatabaseError
    >;
  }
>() {}
```

**Key Implementation Details:**

- **Dependencies**: Depends on `DatabaseService`, `UserService`, and `PostService`
- **Validation**:
  - Content required and non-empty
  - Max length (e.g., 500 characters for comments)
  - Verify post and user exist before creating
- **Authorization**:
  - Only comment author can update/delete their own comments
  - Check `userId` matches `requestingUserId` for update/delete operations
- **Ordering**: Return comments ordered by `createdAt` ascending (oldest first)
- **Database Operations**: Use Drizzle ORM with `Effect.tryPromise` wrapper

**Service Layer:**

```typescript
export const CommentServiceLive = Layer.effect(
  CommentService,
  Effect.gen(function* () {
    // Ensure dependencies are available
    yield* DatabaseService;
    yield* UserService;
    yield* PostService;

    const service = new CommentServiceLive();
    return {
      getById: service.getById,
      getByPostId: service.getByPostId,
      getByUserId: service.getByUserId,
      create: service.create,
      update: service.update,
      delete: service.delete,
    };
  })
);
```

### 5. HTTP Routes (`src/index.ts`)

**Add CommentService Import and Runtime Update:**

```typescript
import { CommentService, CommentServiceLive } from "./services/CommentService";

// Update runtime to include CommentService
const runtime = Effect.runSync(
  Effect.scoped(
    Runtime.make(
      Layer.provide(
        Layer.mergeAll(UserServiceLive, PostServiceLive, CommentServiceLive),
        DatabaseServiceLive
      )
    )
  )
);

// Update runEffect helper to include CommentService in context
async function runEffect<A, E>(
  effect: Effect.Effect<A, E, UserService | PostService | CommentService | DatabaseService>
): Promise<{ success: true; data: A } | { success: false; error: E }> {
  // ... existing implementation
}
```

**Add Comment Endpoints:**

```typescript
// ============================================================================
// COMMENT ROUTES
// ============================================================================

// GET /posts/:postId/comments - Get all comments for a post
app.get("/posts/:postId/comments", async (c) => {
  const postId = c.req.param("postId");

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.getByPostId(postId);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch comments" }, 500);
  }
});

// GET /comments/:id - Get a comment by ID
app.get("/comments/:id", async (c) => {
  const id = c.req.param("id");

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.getById(id);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof CommentNotFoundError) {
      return c.json({ error: `Comment with id ${id} not found` }, 404);
    }
    return c.json({ error: "Failed to fetch comment" }, 500);
  }
});

// GET /users/:userId/comments - Get all comments by a user
app.get("/users/:userId/comments", async (c) => {
  const userId = c.req.param("userId");

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.getByUserId(userId);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    return c.json({ error: "Failed to fetch user comments" }, 500);
  }
});

// POST /comments - Create a new comment
app.post("/comments", async (c) => {
  const body = await c.req.json<CreateCommentInput>();

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.create(body);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data, 201);
  } else {
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    if (result.error instanceof PostNotFoundError) {
      return c.json({ error: `Post with id ${result.error.id} not found` }, 404);
    }
    if (result.error instanceof UserNotFoundError) {
      return c.json({ error: `User with id ${result.error.id} not found` }, 404);
    }
    return c.json({ error: "Failed to create comment" }, 500);
  }
});

// PUT /comments/:id - Update a comment
app.put("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<UpdateCommentInput & { requestingUserId: string }>();

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.update(id, body, body.requestingUserId);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json(result.data);
  } else {
    if (result.error instanceof CommentNotFoundError) {
      return c.json({ error: `Comment with id ${id} not found` }, 404);
    }
    if (result.error instanceof ValidationError) {
      return c.json({ error: result.error.message }, 400);
    }
    if (result.error instanceof UnauthorizedCommentActionError) {
      return c.json(
        { error: "You are not authorized to update this comment" },
        403
      );
    }
    return c.json({ error: "Failed to update comment" }, 500);
  }
});

// DELETE /comments/:id - Delete a comment
app.delete("/comments/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ requestingUserId: string }>();

  const program = Effect.gen(function* () {
    const service = yield* CommentService;
    return yield* service.delete(id, body.requestingUserId);
  });

  const result = await runEffect(program);

  if (result.success) {
    return c.json({ message: `Comment with id ${id} deleted successfully` });
  } else {
    if (result.error instanceof CommentNotFoundError) {
      return c.json({ error: `Comment with id ${id} not found` }, 404);
    }
    if (result.error instanceof UnauthorizedCommentActionError) {
      return c.json(
        { error: "You are not authorized to delete this comment" },
        403
      );
    }
    return c.json({ error: "Failed to delete comment" }, 500);
  }
});
```

**Update Root Endpoint Documentation:**

```typescript
app.get("/", (c) => {
  return c.json({
    message: "Twitter-like API - Hono + Effect + Bun",
    version: "1.0.0",
    endpoints: {
      users: { /* ... existing ... */ },
      posts: { /* ... existing ... */ },
      comments: {
        "GET /posts/:postId/comments": "Get all comments for a post",
        "GET /comments/:id": "Get a comment by ID",
        "GET /users/:userId/comments": "Get all comments by a user",
        "POST /comments": "Create a new comment",
        "PUT /comments/:id": "Update a comment (requires requestingUserId)",
        "DELETE /comments/:id": "Delete a comment (requires requestingUserId)",
      },
    },
  });
});
```

### 6. Database Migration

**Generate Migration:**

```bash
bun run db:generate
```

This will create a new migration file in `drizzle/` directory with SQL to:
- Create the `comments` table
- Add foreign key constraints to `posts` and `users` tables
- Create indexes for `post_id` and `user_id` columns (for query performance)

**Apply Migration:**

```bash
bun run db:migrate
```

## Validation Rules

### Comment Content Validation

- **Required**: Content must not be empty or whitespace-only
- **Max Length**: 500 characters (more generous than posts' 280)
- **Min Length**: At least 1 character after trimming
- **Error Messages**: Clear, actionable validation errors

### Authorization Rules

- **Create**: Any authenticated user can comment on any post
- **Update**: Only the comment author can update their own comment
- **Delete**: Only the comment author can delete their own comment

## Testing Strategy

### Manual Testing Checklist

1. **Create Comment**:
   - ✓ Valid comment on existing post
   - ✓ Reject empty content
   - ✓ Reject content over 500 chars
   - ✓ Reject comment on non-existent post
   - ✓ Reject comment from non-existent user

2. **Get Comments**:
   - ✓ Get all comments for a post
   - ✓ Get comment by ID
   - ✓ Get all comments by a user
   - ✓ Verify ordering (oldest first)

3. **Update Comment**:
   - ✓ Author can update their own comment
   - ✓ Non-author cannot update comment (403)
   - ✓ Validate updated content

4. **Delete Comment**:
   - ✓ Author can delete their own comment
   - ✓ Non-author cannot delete comment (403)
   - ✓ Verify cascade deletion when post is deleted
   - ✓ Verify cascade deletion when user is deleted

### Sample Test Data

```bash
# Create a user
POST /users
{
  "username": "alice",
  "email": "alice@example.com",
  "displayName": "Alice"
}
# Response: { "id": "1", ... }

# Create a post
POST /posts
{
  "userId": "1",
  "content": "My first post!"
}
# Response: { "id": "1", ... }

# Create a comment
POST /comments
{
  "postId": "1",
  "userId": "1",
  "content": "Great post!"
}
# Response: { "id": "1", ... }

# Get comments for post
GET /posts/1/comments
# Response: [{ "id": "1", "content": "Great post!", ... }]

# Update comment
PUT /comments/1
{
  "content": "Amazing post!",
  "requestingUserId": "1"
}

# Delete comment
DELETE /comments/1
{
  "requestingUserId": "1"
}
```

## Implementation Order

1. **Database Layer** (schema.ts): Define table and relations
2. **Type Definitions** (types.ts): Domain types and DTOs
3. **Error Definitions** (errors.ts): Tagged errors
4. **Service Layer** (CommentService.ts): Business logic
5. **HTTP Layer** (index.ts): Routes and error handling
6. **Migration**: Generate and apply database migration
7. **Manual Testing**: Test all endpoints with sample data

## Considerations & Future Enhancements

### Current Limitations

- No pagination (could be added for large comment threads)
- No nested comments/replies (flat structure only)
- No real authentication (userId passed in request body)
- No rate limiting or spam protection
- No soft deletes (hard deletes via cascade)

### Possible Future Enhancements

1. **Nested Comments**: Add `parentCommentId` field for threaded discussions
2. **Pagination**: Add limit/offset or cursor-based pagination
3. **Authentication**: Integrate JWT or session-based auth
4. **Reactions**: Add likes/reactions to comments
5. **Mentions**: Support @username mentions in comments
6. **Notifications**: Notify post authors of new comments
7. **Moderation**: Add reporting and moderation features
8. **Rich Content**: Support markdown or limited HTML
9. **Edit History**: Track comment edit history
10. **Soft Deletes**: Add `deletedAt` field instead of hard deletes

## Success Criteria

- [ ] Comments table created with proper foreign keys
- [ ] All CRUD operations work correctly
- [ ] Validation prevents invalid data
- [ ] Authorization prevents unauthorized updates/deletes
- [ ] Cascade deletes work correctly
- [ ] Error handling returns appropriate status codes
- [ ] TypeScript compiles without errors
- [ ] Code follows existing Effect/Drizzle patterns
- [ ] API documentation updated in root endpoint

## Estimated Effort

- **Database Schema**: 15 minutes
- **Types & Errors**: 10 minutes
- **CommentService**: 45 minutes
- **HTTP Routes**: 30 minutes
- **Migration & Testing**: 20 minutes
- **Total**: ~2 hours

---

## File Checklist

Files to be modified/created:

- [ ] `src/db/schema.ts` - Add comments table and relations
- [ ] `src/types.ts` - Add Comment types
- [ ] `src/errors.ts` - Add comment errors
- [ ] `src/services/CommentService.ts` - **NEW FILE** - Service implementation
- [ ] `src/index.ts` - Add comment routes and update runtime
- [ ] `drizzle/XXXX_add_comments.sql` - **NEW FILE** - Migration (auto-generated)

---

**This plan follows all existing architecture patterns and Effect best practices. Ready for implementation!**
