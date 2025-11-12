import { Context, Effect, Layer } from "effect";
import { eq, desc } from "drizzle-orm";
import type { Post, CreatePostInput, UpdatePostInput } from "../types";
import {
  PostNotFoundError,
  ValidationError,
  UserNotFoundError,
  DatabaseError,
} from "../errors";
import { DatabaseService } from "./DatabaseService";
import { UserService } from "./UserService";
import { posts } from "../db/schema";

// Define the service interface
export class PostService extends Context.Tag("PostService")<
  PostService,
  {
    readonly getAll: Effect.Effect<Array<Post>, DatabaseError>;
    readonly getById: (
      id: string
    ) => Effect.Effect<Post, PostNotFoundError | DatabaseError>;
    readonly getByUserId: (
      userId: string
    ) => Effect.Effect<Array<Post>, DatabaseError>;
    readonly create: (
      input: CreatePostInput
    ) => Effect.Effect<
      Post,
      ValidationError | UserNotFoundError | DatabaseError
    >;
    readonly update: (
      id: string,
      input: UpdatePostInput
    ) => Effect.Effect<Post, PostNotFoundError | ValidationError | DatabaseError>;
    readonly delete: (
      id: string
    ) => Effect.Effect<void, PostNotFoundError | DatabaseError>;
  }
>() {}

// Database-backed implementation
class PostServiceLive {
  getAll = Effect.gen(function* () {
    const { db } = yield* DatabaseService;

    const result = yield* Effect.tryPromise({
      try: () => db.select().from(posts).orderBy(desc(posts.createdAt)),
      catch: (error) => new DatabaseError({ message: String(error) }),
    });

    return result.map((dbPost) => ({
      id: dbPost.id.toString(),
      userId: dbPost.userId.toString(),
      content: dbPost.content,
      createdAt: dbPost.createdAt,
      updatedAt: dbPost.updatedAt,
    }));
  });

  getById = (id: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new PostNotFoundError({ id }));
      }

      const result = yield* Effect.tryPromise({
        try: () => db.select().from(posts).where(eq(posts.id, numId)).limit(1),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbPost = result[0];
      if (!dbPost) {
        return yield* Effect.fail(new PostNotFoundError({ id }));
      }

      return {
        id: dbPost.id.toString(),
        userId: dbPost.userId.toString(),
        content: dbPost.content,
        createdAt: dbPost.createdAt,
        updatedAt: dbPost.updatedAt,
      };
    });

  getByUserId = (userId: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      const numUserId = parseInt(userId, 10);
      if (isNaN(numUserId)) {
        return [];
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(posts)
            .where(eq(posts.userId, numUserId))
            .orderBy(desc(posts.createdAt)),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      return result.map((dbPost) => ({
        id: dbPost.id.toString(),
        userId: dbPost.userId.toString(),
        content: dbPost.content,
        createdAt: dbPost.createdAt,
        updatedAt: dbPost.updatedAt,
      }));
    });

  create = (input: CreatePostInput) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validation
      if (!input.content || input.content.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Post content is required" })
        );
      }

      // Twitter-like character limit
      if (input.content.length > 280) {
        return yield* Effect.fail(
          new ValidationError({
            message: "Post content must be 280 characters or less",
          })
        );
      }

      // Verify user exists
      const userService = yield* UserService;
      yield* userService.getById(input.userId);

      const numUserId = parseInt(input.userId, 10);

      // Insert new post
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(posts)
            .values({
              userId: numUserId,
              content: input.content,
            })
            .returning(),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbPost = result[0];

      return {
        id: dbPost.id.toString(),
        userId: dbPost.userId.toString(),
        content: dbPost.content,
        createdAt: dbPost.createdAt,
        updatedAt: dbPost.updatedAt,
      };
    });

  update = (id: string, input: UpdatePostInput) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validate ID
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new PostNotFoundError({ id }));
      }

      // Validation
      if (input.content !== undefined) {
        if (input.content.trim().length === 0) {
          return yield* Effect.fail(
            new ValidationError({ message: "Post content cannot be empty" })
          );
        }

        if (input.content.length > 280) {
          return yield* Effect.fail(
            new ValidationError({
              message: "Post content must be 280 characters or less",
            })
          );
        }
      }

      // Check if post exists
      yield* this.getById(id);

      // Update post
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(posts)
            .set({
              content: input.content,
              updatedAt: new Date(),
            })
            .where(eq(posts.id, numId))
            .returning(),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbPost = result[0];

      return {
        id: dbPost.id.toString(),
        userId: dbPost.userId.toString(),
        content: dbPost.content,
        createdAt: dbPost.createdAt,
        updatedAt: dbPost.updatedAt,
      };
    });

  delete = (id: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validate ID
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new PostNotFoundError({ id }));
      }

      // Check if post exists
      yield* this.getById(id);

      // Delete post
      yield* Effect.tryPromise({
        try: () => db.delete(posts).where(eq(posts.id, numId)),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });
    });
}

// Create the service layer (depends on DatabaseService and UserService)
export const PostServiceLive = Layer.effect(
  PostService,
  Effect.gen(function* () {
    // Ensure dependencies are available
    yield* DatabaseService;
    yield* UserService;

    const service = new PostServiceLive();
    return {
      getAll: service.getAll,
      getById: service.getById,
      getByUserId: service.getByUserId,
      create: service.create,
      update: service.update,
      delete: service.delete,
    };
  })
);
