import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Database configuration with mocked/default values
export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "hono_effect_db",
};

// Create postgres client
export function createPostgresClient() {
  const connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

  return postgres(connectionString, {
    max: 10, // Connection pool size
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

// Create drizzle instance
export function createDrizzleDb(client: ReturnType<typeof createPostgresClient>) {
  return drizzle(client, { schema });
}

// Type exports
export type DrizzleDb = ReturnType<typeof createDrizzleDb>;
