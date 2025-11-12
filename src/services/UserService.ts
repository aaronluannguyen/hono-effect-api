import { Context, Effect, Layer } from "effect";
import { eq } from "drizzle-orm";
import type { User, CreateUserInput, UpdateUserInput } from "../types";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  ValidationError,
  DatabaseError,
} from "../errors";
import { DatabaseService } from "./DatabaseService";
import { users } from "../db/schema";

// Define the service interface
export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getAll: Effect.Effect<Array<User>, DatabaseError>;
    readonly getById: (
      id: string
    ) => Effect.Effect<User, UserNotFoundError | DatabaseError>;
    readonly getByUsername: (
      username: string
    ) => Effect.Effect<User, UserNotFoundError | DatabaseError>;
    readonly create: (
      input: CreateUserInput
    ) => Effect.Effect<
      User,
      ValidationError | UserAlreadyExistsError | DatabaseError
    >;
    readonly update: (
      id: string,
      input: UpdateUserInput
    ) => Effect.Effect<User, UserNotFoundError | ValidationError | DatabaseError>;
    readonly delete: (
      id: string
    ) => Effect.Effect<void, UserNotFoundError | DatabaseError>;
  }
>() {}

// Database-backed implementation
class UserServiceLive {
  getAll = Effect.gen(function* () {
    const { db } = yield* DatabaseService;

    const result = yield* Effect.tryPromise({
      try: () => db.select().from(users),
      catch: (error) => new DatabaseError({ message: String(error) }),
    });

    return result.map((dbUser) => ({
      id: dbUser.id.toString(),
      username: dbUser.username,
      email: dbUser.email,
      displayName: dbUser.displayName,
      bio: dbUser.bio ?? undefined,
      createdAt: dbUser.createdAt,
      updatedAt: dbUser.updatedAt,
    }));
  });

  getById = (id: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      const result = yield* Effect.tryPromise({
        try: () => db.select().from(users).where(eq(users.id, numId)).limit(1),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbUser = result[0];
      if (!dbUser) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

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

  getByUsername = (username: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      const result = yield* Effect.tryPromise({
        try: () =>
          db.select().from(users).where(eq(users.username, username)).limit(1),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbUser = result[0];
      if (!dbUser) {
        return yield* Effect.fail(
          new UserNotFoundError({ id: `username:${username}` })
        );
      }

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

  create = (input: CreateUserInput) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validation
      if (!input.username || input.username.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Username is required" })
        );
      }

      if (!input.email || input.email.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Email is required" })
        );
      }

      if (!input.displayName || input.displayName.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Display name is required" })
        );
      }

      // Check if username already exists
      const existingUser = yield* Effect.tryPromise({
        try: () =>
          db
            .select()
            .from(users)
            .where(eq(users.username, input.username))
            .limit(1),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      if (existingUser.length > 0) {
        return yield* Effect.fail(
          new UserAlreadyExistsError({ username: input.username })
        );
      }

      // Insert new user
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .insert(users)
            .values({
              username: input.username,
              email: input.email,
              displayName: input.displayName,
              bio: input.bio ?? null,
            })
            .returning(),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbUser = result[0];

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

  update = (id: string, input: UpdateUserInput) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validate ID
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      // Validation
      if (input.email !== undefined && input.email.trim().length === 0) {
        return yield* Effect.fail(
          new ValidationError({ message: "Email cannot be empty" })
        );
      }

      if (
        input.displayName !== undefined &&
        input.displayName.trim().length === 0
      ) {
        return yield* Effect.fail(
          new ValidationError({ message: "Display name cannot be empty" })
        );
      }

      // Check if user exists
      yield* this.getById(id);

      // Update user
      const result = yield* Effect.tryPromise({
        try: () =>
          db
            .update(users)
            .set({
              email: input.email,
              displayName: input.displayName,
              bio: input.bio !== undefined ? input.bio : undefined,
              updatedAt: new Date(),
            })
            .where(eq(users.id, numId))
            .returning(),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });

      const dbUser = result[0];

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

  delete = (id: string) =>
    Effect.gen(function* () {
      const { db } = yield* DatabaseService;

      // Validate ID
      const numId = parseInt(id, 10);
      if (isNaN(numId)) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }

      // Check if user exists
      yield* this.getById(id);

      // Delete user
      yield* Effect.tryPromise({
        try: () => db.delete(users).where(eq(users.id, numId)),
        catch: (error) => new DatabaseError({ message: String(error) }),
      });
    });
}

// Create the service layer (depends on DatabaseService)
export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    // Ensure DatabaseService is available
    yield* DatabaseService;

    const service = new UserServiceLive();
    return {
      getAll: service.getAll,
      getById: service.getById,
      getByUsername: service.getByUsername,
      create: service.create,
      update: service.update,
      delete: service.delete,
    };
  })
);
