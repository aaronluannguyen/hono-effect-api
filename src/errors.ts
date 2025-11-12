import { Data } from "effect";

export class TodoNotFoundError extends Data.TaggedError("TodoNotFoundError")<{
  id: string;
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  message: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  message: string;
}> {}
