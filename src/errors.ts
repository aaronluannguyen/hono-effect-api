import { Data } from "effect";

// User errors
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  id: string;
}> {}

export class UserAlreadyExistsError extends Data.TaggedError(
  "UserAlreadyExistsError"
)<{
  username: string;
}> {}

// Post errors
export class PostNotFoundError extends Data.TaggedError("PostNotFoundError")<{
  id: string;
}> {}

// Common errors
export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
}> {}
