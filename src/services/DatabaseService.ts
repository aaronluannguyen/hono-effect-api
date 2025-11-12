import { Context, Effect, Layer } from "effect";
import { createPostgresClient, createDrizzleDb, type DrizzleDb } from "../db/connection";

// Define the DatabaseService interface
export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly db: DrizzleDb;
  }
>() {}

// Implementation that creates and manages the database connection
export const DatabaseServiceLive = Layer.scoped(
  DatabaseService,
  Effect.gen(function* () {
    // Create postgres client
    const client = createPostgresClient();

    // Create drizzle instance
    const db = createDrizzleDb(client);

    // Register cleanup function to close connection when scope ends
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        console.log("Closing database connection...");
        client.end();
      })
    );

    console.log("Database connection established");

    return {
      db,
    };
  })
);
