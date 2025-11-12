import { Context, Effect, Layer } from "effect";
import type { User, CreateUserInput, UpdateUserInput } from "../types";
import {
  UserNotFoundError,
  UserAlreadyExistsError,
  ValidationError,
} from "../errors";

// Define the service interface
export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getAll: Effect.Effect<Array<User>, never>;
    readonly getById: (id: string) => Effect.Effect<User, UserNotFoundError>;
    readonly getByUsername: (
      username: string
    ) => Effect.Effect<User, UserNotFoundError>;
    readonly create: (
      input: CreateUserInput
    ) => Effect.Effect<User, ValidationError | UserAlreadyExistsError>;
    readonly update: (
      id: string,
      input: UpdateUserInput
    ) => Effect.Effect<User, UserNotFoundError | ValidationError>;
    readonly delete: (id: string) => Effect.Effect<void, UserNotFoundError>;
  }
>() {}

// In-memory storage implementation
class UserServiceLive {
  private users: Map<string, User> = new Map();
  private idCounter = 1;

  getAll = Effect.sync(() => Array.from(this.users.values()));

  getById = (id: string) =>
    Effect.gen(this, function* () {
      const user = this.users.get(id);
      if (!user) {
        return yield* Effect.fail(new UserNotFoundError({ id }));
      }
      return user;
    });

  getByUsername = (username: string) =>
    Effect.gen(this, function* () {
      const user = Array.from(this.users.values()).find(
        (u) => u.username === username
      );
      if (!user) {
        return yield* Effect.fail(
          new UserNotFoundError({ id: `username:${username}` })
        );
      }
      return user;
    });

  create = (input: CreateUserInput) =>
    Effect.gen(this, function* () {
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
      const existingUser = Array.from(this.users.values()).find(
        (u) => u.username === input.username
      );

      if (existingUser) {
        return yield* Effect.fail(
          new UserAlreadyExistsError({ username: input.username })
        );
      }

      const id = (this.idCounter++).toString();
      const now = new Date();
      const user: User = {
        id,
        username: input.username,
        email: input.email,
        displayName: input.displayName,
        bio: input.bio,
        createdAt: now,
        updatedAt: now,
      };

      this.users.set(id, user);
      return user;
    });

  update = (id: string, input: UpdateUserInput) =>
    Effect.gen(this, function* () {
      const user = yield* this.getById(id);

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

      const updatedUser: User = {
        ...user,
        email: input.email ?? user.email,
        displayName: input.displayName ?? user.displayName,
        bio: input.bio !== undefined ? input.bio : user.bio,
        updatedAt: new Date(),
      };

      this.users.set(id, updatedUser);
      return updatedUser;
    });

  delete = (id: string) =>
    Effect.gen(this, function* () {
      const user = yield* this.getById(id);
      this.users.delete(id);
    });
}

// Create the service layer
export const UserServiceLiveLayer = Layer.sync(UserService, () => {
  const service = new UserServiceLive();
  return {
    getAll: service.getAll,
    getById: service.getById,
    getByUsername: service.getByUsername,
    create: service.create,
    update: service.update,
    delete: service.delete,
  };
});
