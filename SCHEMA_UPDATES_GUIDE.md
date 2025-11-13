# Schema Updates and Database Migration Guide

## Overview

This project uses **Drizzle ORM** with **Drizzle Kit** for managing database schema changes and migrations. This guide explains the complete process for updating the database schema safely and effectively.

## Architecture

### Components

1. **Drizzle ORM** (`drizzle-orm`) - Type-safe database query builder and ORM
2. **Drizzle Kit** (`drizzle-kit`) - CLI tool for generating and managing migrations
3. **PostgreSQL** - Relational database
4. **Migration Files** - SQL files auto-generated from schema changes

### File Structure

```
project-root/
├── src/db/
│   ├── schema.ts          # Source of truth for database schema
│   ├── connection.ts      # Database connection setup
│   └── migrate.ts         # Migration runner script
├── drizzle/               # Generated migration files (auto-created)
│   ├── 0000_*.sql        # First migration
│   ├── 0001_*.sql        # Second migration
│   ├── meta/             # Migration metadata
│   └── ...
├── drizzle.config.ts     # Drizzle Kit configuration
└── .env                  # Database credentials (not in git)
```

## Configuration

### drizzle.config.ts

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",        // Where schema is defined
  out: "./drizzle",                    // Where migrations are generated
  dialect: "postgresql",               // Database type
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_NAME || "hono_effect_db",
  },
});
```

### Environment Variables

Create a `.env` file (or use defaults):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=hono_effect_db
```

## Schema Update Process

### Step-by-Step Workflow

#### 1. Update Schema Definition

Edit `src/db/schema.ts` to reflect your desired schema changes.

**Example: Adding a new table**

```typescript
import { pgTable, text, timestamp, serial } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Add new table
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

// Add relations
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

// Update existing relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  user: one(users, {
    fields: [posts.userId],
    references: [users.id],
  }),
  comments: many(comments),  // NEW
}));

// Type exports
export type DbComment = typeof comments.$inferSelect;
export type DbCommentInsert = typeof comments.$inferInsert;
```

**Example: Adding a column to existing table**

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),  // NEW COLUMN
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

#### 2. Generate Migration

Run the migration generation command:

```bash
bun run db:generate
```

**What happens:**
- Drizzle Kit reads `src/db/schema.ts`
- Compares it to the current database state (via migration history)
- Generates SQL migration files in `./drizzle/` directory
- Creates timestamped migration file (e.g., `0001_shiny_klaw.sql`)
- Updates migration metadata in `./drizzle/meta/`

**Example generated migration:**

```sql
-- drizzle/0001_add_comments_table.sql
CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "post_id" serial NOT NULL,
  "user_id" serial NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_comments_post_id" ON "comments" ("post_id");
CREATE INDEX IF NOT EXISTS "idx_comments_user_id" ON "comments" ("user_id");
```

#### 3. Review Migration

**IMPORTANT:** Always review the generated SQL before applying!

- Check the migration file in `./drizzle/XXXX_*.sql`
- Verify it matches your intended changes
- Look for potential issues:
  - Missing `NOT NULL` constraints on new columns
  - Missing default values for non-nullable columns
  - Incorrect foreign key relationships
  - Missing indexes for foreign keys

#### 4. Apply Migration

Once reviewed, apply the migration to your database:

```bash
bun run db:migrate
```

**What happens:**
- Connects to PostgreSQL using credentials from `drizzle.config.ts`
- Reads migration files from `./drizzle/` directory
- Applies any pending migrations in order
- Tracks applied migrations in a `__drizzle_migrations` table
- Only runs migrations that haven't been applied yet

**Console output:**

```
Running migrations...
Connecting to: localhost:5432/hono_effect_db
Migrations completed successfully!
```

#### 5. Verify Migration

Check that the migration was successful:

**Option A: Using Drizzle Studio (GUI)**

```bash
bun run db:studio
```

Opens a web-based database browser at `https://local.drizzle.studio/`

**Option B: Using PostgreSQL CLI**

```bash
psql -h localhost -U postgres -d hono_effect_db

\dt                    # List all tables
\d comments           # Describe comments table
\d __drizzle_migrations  # View migration history
```

**Option C: Query from code**

```typescript
// Test in your application
const program = Effect.gen(function* () {
  const { db } = yield* DatabaseService;
  const result = yield* Effect.tryPromise({
    try: () => db.select().from(comments).limit(1),
    catch: (error) => new DatabaseError({ message: String(error) }),
  });
  return result;
});
```

## Available Commands

### Core Commands

```bash
# Generate migration from schema changes
bun run db:generate

# Apply pending migrations to database
bun run db:migrate

# Open Drizzle Studio (database GUI)
bun run db:studio
```

### Additional Drizzle Kit Commands

```bash
# Check current migration status
bunx drizzle-kit check

# Drop a migration (removes last migration file)
bunx drizzle-kit drop

# Push schema changes directly (without migration files - NOT RECOMMENDED)
bunx drizzle-kit push

# Introspect existing database and generate schema
bunx drizzle-kit introspect

# Generate TypeScript types from schema
bunx drizzle-kit generate
```

## Common Schema Changes

### Adding a New Table

1. Define table in `schema.ts` with `pgTable()`
2. Add relations if needed with `relations()`
3. Export type: `export type DbTableName = typeof tableName.$inferSelect;`
4. Run `bun run db:generate`
5. Review generated SQL
6. Run `bun run db:migrate`

### Adding a Column

**Nullable column (safe):**

```typescript
export const users = pgTable("users", {
  // ... existing columns
  avatarUrl: text("avatar_url"),  // Nullable, no default needed
});
```

**Non-nullable column with default:**

```typescript
export const users = pgTable("users", {
  // ... existing columns
  isVerified: boolean("is_verified").notNull().default(false),
});
```

**Non-nullable column for existing data:**

```typescript
// Option 1: Add as nullable first, then make non-nullable in second migration
export const users = pgTable("users", {
  status: text("status"),  // Step 1: Add as nullable
});

// Later, after backfilling data...
export const users = pgTable("users", {
  status: text("status").notNull(),  // Step 2: Make non-nullable
});

// Option 2: Add with default value
export const users = pgTable("users", {
  status: text("status").notNull().default("active"),
});
```

### Removing a Column

```typescript
// Simply remove from schema.ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  // bio: text("bio"),  // REMOVED
});
```

**Warning:** Drizzle will generate `ALTER TABLE DROP COLUMN`. Data will be lost!

### Renaming a Column

Drizzle sees renames as drop + add. To preserve data:

**Option 1: Manual SQL migration**

```sql
-- Manually edit generated migration file
ALTER TABLE users RENAME COLUMN old_name TO new_name;
```

**Option 2: Two-step process**

1. Add new column
2. Migrate data manually
3. Remove old column

### Adding Foreign Keys

```typescript
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: serial("post_id")
    .notNull()
    .references(() => posts.id, {
      onDelete: "cascade",      // Delete comments when post deleted
      onUpdate: "no action"     // Default behavior
    }),
});
```

**Common `onDelete` options:**
- `cascade` - Delete child records when parent is deleted
- `set null` - Set foreign key to NULL when parent deleted
- `restrict` - Prevent deletion of parent if children exist
- `no action` - Database default (usually same as restrict)

### Adding Indexes

```typescript
import { index } from "drizzle-orm/pg-core";

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Define indexes in second parameter
  userIdIdx: index("idx_posts_user_id").on(table.userId),
  createdAtIdx: index("idx_posts_created_at").on(table.createdAt),
}));
```

### Adding Unique Constraints

```typescript
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),  // Simple unique
  email: text("email").notNull(),
}, (table) => ({
  // Composite unique constraint
  emailUsernameUnique: unique("email_username_unique").on(table.email, table.username),
}));
```

## Migration Best Practices

### DO ✅

1. **Always review generated SQL** before applying migrations
2. **Test migrations locally** before production
3. **Commit migration files to git** - they're part of your codebase
4. **Use transactions** - Drizzle migrations run in transactions automatically
5. **Add indexes for foreign keys** - improves query performance
6. **Use cascade deletes thoughtfully** - understand data dependencies
7. **Back up production database** before major migrations
8. **Version your schema changes** - one logical change per migration

### DON'T ❌

1. **Don't edit applied migrations** - create new migration instead
2. **Don't use `drizzle-kit push`** in production - always use migrations
3. **Don't skip migration review** - SQL might not match expectations
4. **Don't delete migration files** - breaks migration history
5. **Don't make breaking changes without planning** - coordinate with application code
6. **Don't add non-nullable columns without defaults** to tables with data
7. **Don't forget to update TypeScript types** when schema changes

## Handling Migration Conflicts

### Scenario: Multiple developers, conflicting migrations

**Problem:** Developer A and Developer B both create migration `0003_*` on different branches.

**Solution:**

1. Merge both branches
2. Regenerate migrations:
   ```bash
   # Delete conflicting migration files
   rm drizzle/0003_*

   # Regenerate from current schema
   bun run db:generate
   ```
3. Review and apply new migration

### Scenario: Migration fails mid-way

**Problem:** Migration fails due to constraint violation or syntax error.

**Solution:**

1. Check error message carefully
2. If in transaction (Drizzle default), changes are rolled back automatically
3. Fix the schema or migration file
4. Regenerate migration if needed
5. Retry migration

**Manual rollback if needed:**

```sql
-- Connect to database
psql -h localhost -U postgres -d hono_effect_db

-- View migration history
SELECT * FROM __drizzle_migrations;

-- If migration was partially applied, may need manual cleanup
-- (Depends on specific failure)
```

## Schema Update Checklist

When updating schema, follow this checklist:

- [ ] **Plan the change** - Understand requirements and impact
- [ ] **Update `schema.ts`** - Make schema changes
- [ ] **Update domain types** (`types.ts`) - Keep TypeScript types in sync
- [ ] **Generate migration** - Run `bun run db:generate`
- [ ] **Review SQL** - Check generated migration file carefully
- [ ] **Test locally** - Apply migration to local database
- [ ] **Verify schema** - Use `db:studio` or SQL to check tables
- [ ] **Test application** - Ensure code works with new schema
- [ ] **Update services** - Modify service layer if needed
- [ ] **Commit changes** - Commit schema.ts AND migration files together
- [ ] **Document changes** - Update API docs if endpoints changed
- [ ] **Deploy** - Apply migration to staging/production

## Production Deployment

### Zero-Downtime Migrations

For production systems, follow these patterns:

#### Adding a column (safe)

```typescript
// Migration 1: Add nullable column
export const users = pgTable("users", {
  newColumn: text("new_column"),  // Nullable
});

// Deploy code that can handle null values
// Migration 2 (later): Make non-nullable with default
export const users = pgTable("users", {
  newColumn: text("new_column").notNull().default("value"),
});
```

#### Removing a column

```typescript
// Step 1: Deploy code that doesn't use the column
// Step 2 (later): Remove from schema and migrate
```

#### Renaming a column

```typescript
// Step 1: Add new column
// Step 2: Deploy code that writes to both columns
// Step 3: Backfill data
// Step 4: Deploy code that only uses new column
// Step 5: Remove old column
```

### Deployment Process

```bash
# 1. Back up production database
pg_dump -h prod-host -U user -d dbname > backup_$(date +%Y%m%d).sql

# 2. Test migration on staging
bun run db:migrate  # On staging environment

# 3. Verify staging
# Test application functionality

# 4. Apply to production
bun run db:migrate  # On production environment

# 5. Monitor application
# Watch for errors, check logs
```

## Troubleshooting

### "Cannot find module ./drizzle"

**Cause:** Migration folder doesn't exist yet

**Solution:**
```bash
mkdir -p drizzle/meta
bun run db:generate  # Will create initial migration
```

### "Table already exists"

**Cause:** Trying to re-apply already applied migration

**Solution:** Drizzle tracks migrations automatically. Check:
```sql
SELECT * FROM __drizzle_migrations;
```

### "Foreign key constraint violation"

**Cause:** Trying to add foreign key to orphaned records

**Solution:**
1. Clean up orphaned records before migration
2. Or make FK nullable temporarily

### "Column cannot be null"

**Cause:** Adding non-nullable column without default to table with existing rows

**Solution:**
- Add column as nullable first
- Backfill data
- Then make non-nullable in second migration

OR

- Add column with default value

## Advanced Topics

### Custom SQL in Migrations

You can manually edit generated migrations to add custom SQL:

```sql
-- drizzle/0003_custom_migration.sql

-- Auto-generated content
CREATE TABLE ...

-- Your custom SQL
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Seeding Data

Create a separate script for seeding:

```typescript
// src/db/seed.ts
import { Effect } from "effect";
import { DatabaseService } from "../services/DatabaseService";
import { users, posts } from "./schema";

const seedData = Effect.gen(function* () {
  const { db } = yield* DatabaseService;

  // Insert seed data
  const [user] = yield* Effect.tryPromise({
    try: () => db.insert(users).values({
      username: "admin",
      email: "admin@example.com",
      displayName: "Admin User",
    }).returning(),
    catch: (error) => new Error(String(error)),
  });

  console.log("Seeded user:", user);
});

// Run seed
```

### Rolling Back Migrations

Drizzle doesn't have built-in rollback. For rollback capability:

1. **Backup before migrating**
2. **Write down migrations** - manually create reversal SQL
3. **Or restore from backup**

**Manual rollback example:**

```sql
-- If migration added a table
DROP TABLE comments;

-- If migration added a column
ALTER TABLE users DROP COLUMN avatar_url;
```

## Summary

**Schema Update Workflow:**

1. Edit `src/db/schema.ts`
2. Run `bun run db:generate`
3. Review generated SQL in `./drizzle/`
4. Run `bun run db:migrate`
5. Verify with `bun run db:studio`
6. Commit schema + migration files

**Key Files:**
- `src/db/schema.ts` - Schema definition (source of truth)
- `drizzle.config.ts` - Drizzle configuration
- `drizzle/` - Generated migration files
- `src/db/migrate.ts` - Migration runner

**Key Commands:**
- `bun run db:generate` - Generate migration from schema
- `bun run db:migrate` - Apply migrations
- `bun run db:studio` - View database (GUI)

For more information, see:
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit Documentation](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
