import { Context, Effect, Layer } from "effect";
import type { Post, CreatePostInput, UpdatePostInput } from "../types";
import {
  PostNotFoundError,
  ValidationError,
  UserNotFoundError,
} from "../errors";
import { UserService } from "./UserService";

// Define the service interface
export class PostService extends Context.Tag("PostService")<
  PostService,
  {
    readonly getAll: Effect.Effect<Array<Post>, never>;
    readonly getById: (id: string) => Effect.Effect<Post, PostNotFoundError>;
    readonly getByUserId: (userId: string) => Effect.Effect<Array<Post>, never>;
    readonly create: (
      input: CreatePostInput
    ) => Effect.Effect<Post, ValidationError | UserNotFoundError>;
    readonly update: (
      id: string,
      input: UpdatePostInput
    ) => Effect.Effect<Post, PostNotFoundError | ValidationError>;
    readonly delete: (id: string) => Effect.Effect<void, PostNotFoundError>;
  }
>() {}

// In-memory storage implementation
class PostServiceLive {
  private posts: Map<string, Post> = new Map();
  private idCounter = 1;

  getAll = Effect.sync(() => {
    // Return posts sorted by createdAt descending (newest first)
    return Array.from(this.posts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  });

  getById = (id: string) =>
    Effect.gen(this, function* () {
      const post = this.posts.get(id);
      if (!post) {
        return yield* Effect.fail(new PostNotFoundError({ id }));
      }
      return post;
    });

  getByUserId = (userId: string) =>
    Effect.sync(() => {
      // Return user's posts sorted by createdAt descending (newest first)
      return Array.from(this.posts.values())
        .filter((p) => p.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    });

  create = (input: CreatePostInput) =>
    Effect.gen(this, function* () {
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

      const id = (this.idCounter++).toString();
      const now = new Date();
      const post: Post = {
        id,
        userId: input.userId,
        content: input.content,
        createdAt: now,
        updatedAt: now,
      };

      this.posts.set(id, post);
      return post;
    });

  update = (id: string, input: UpdatePostInput) =>
    Effect.gen(this, function* () {
      const post = yield* this.getById(id);

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

      const updatedPost: Post = {
        ...post,
        content: input.content ?? post.content,
        updatedAt: new Date(),
      };

      this.posts.set(id, updatedPost);
      return updatedPost;
    });

  delete = (id: string) =>
    Effect.gen(this, function* () {
      const post = yield* this.getById(id);
      this.posts.delete(id);
    });
}

// Create the service layer
export const PostServiceLiveLayer = Layer.sync(PostService, () => {
  const service = new PostServiceLive();
  return {
    getAll: service.getAll,
    getById: service.getById,
    getByUserId: service.getByUserId,
    create: service.create,
    update: service.update,
    delete: service.delete,
  };
});
