import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { dbConfig } from "./connection";

async function main() {
  const connectionString = `postgresql://${dbConfig.user}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;

  console.log("Running migrations...");
  console.log(`Connecting to: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  // Create connection for migrations
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
