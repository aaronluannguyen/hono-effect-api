# Hono + Effect + Bun REST API

A Twitter-like REST API built with:
- **TypeScript** - Type-safe development
- **Hono** - Fast, lightweight web framework
- **Bun** - JavaScript runtime and package manager
- **Effect** - Powerful functional programming library for managing effects
- **Drizzle ORM** - Type-safe database ORM
- **PostgreSQL** - Relational database

## Features

- Full CRUD operations for Users and Posts
- Effect-based error handling
- Type-safe API with TypeScript
- Service layer pattern with dependency injection
- PostgreSQL database with Drizzle ORM
- Database connection management through Effect layers
- Twitter-like features (280 character limit, user posts feed)
- Type-safe database queries and migrations

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- [PostgreSQL](https://www.postgresql.org/) installed and running
- PostgreSQL database created (default: `hono_effect_db`)

## Installation

```bash
# Install dependencies
bun install

# Copy environment variables
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=postgres
# DB_NAME=hono_effect_db

# Generate and run database migrations
bun run db:generate
bun run db:migrate
```

## Running the API

```bash
# Development mode (with auto-reload)
bun run dev

# Production mode
bun run start

# Build
bun run build

# Type checking
bun run typecheck

# Database commands
bun run db:generate    # Generate migration files from schema
bun run db:migrate     # Run pending migrations
bun run db:studio      # Open Drizzle Studio (database GUI)
```

The API will start on `http://localhost:3000`

## API Endpoints

### Root
- **GET** `/` - API information

### Users
- **GET** `/users` - Get all users
- **GET** `/users/:id` - Get a specific user by ID
- **GET** `/users/username/:username` - Get a user by username
- **POST** `/users` - Create a new user
- **PUT** `/users/:id` - Update a user
- **DELETE** `/users/:id` - Delete a user

### Posts
- **GET** `/posts` - Get all posts (sorted by newest first)
- **GET** `/posts/:id` - Get a specific post by ID
- **GET** `/users/:userId/posts` - Get all posts by a specific user
- **POST** `/posts` - Create a new post (280 character limit)
- **PUT** `/posts/:id` - Update a post
- **DELETE** `/posts/:id` - Delete a post

## Example Usage

### Users

#### Create a user
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "displayName": "John Doe",
    "bio": "Software developer and coffee enthusiast"
  }'
```

#### Get all users
```bash
curl http://localhost:3000/users
```

#### Get a user by ID
```bash
curl http://localhost:3000/users/1
```

#### Get a user by username
```bash
curl http://localhost:3000/users/username/johndoe
```

#### Update a user
```bash
curl -X PUT http://localhost:3000/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "John R. Doe",
    "bio": "Senior Software Developer"
  }'
```

#### Delete a user
```bash
curl -X DELETE http://localhost:3000/users/1
```

### Posts

#### Create a post
```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "1",
    "content": "Just learned about EffectTS and it'\''s amazing! 🚀"
  }'
```

#### Get all posts
```bash
curl http://localhost:3000/posts
```

#### Get a specific post
```bash
curl http://localhost:3000/posts/1
```

#### Get all posts by a user
```bash
curl http://localhost:3000/users/1/posts
```

#### Update a post
```bash
curl -X PUT http://localhost:3000/posts/1 \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Updated: EffectTS is incredibly powerful for type-safe error handling!"
  }'
```

#### Delete a post
```bash
curl -X DELETE http://localhost:3000/posts/1
```

## Project Structure

```
src/
├── index.ts              # Main application entry point with Hono routes
├── types.ts              # TypeScript type definitions
├── errors.ts             # Effect-based error types
├── db/
│   ├── schema.ts         # Drizzle ORM schema definitions
│   ├── connection.ts     # Database connection setup
│   └── migrate.ts        # Migration runner script
└── services/
    ├── DatabaseService.ts # Database connection service (Effect layer)
    ├── UserService.ts     # User service with Drizzle operations
    └── PostService.ts     # Post service with Drizzle operations
```

## Data Models

### User
```typescript
{
  id: string;
  username: string;      // Unique username
  email: string;
  displayName: string;
  bio?: string;          // Optional bio
  createdAt: Date;
  updatedAt: Date;
}
```

### Post
```typescript
{
  id: string;
  userId: string;        // Author's user ID
  content: string;       // Max 280 characters (Twitter-like)
  createdAt: Date;
  updatedAt: Date;
}
```

## Key Concepts

### Effect Integration

This project demonstrates several EffectTS patterns:

1. **Effect Services**: Using `Context.Tag` to define services with dependency injection
2. **Error Handling**: Tagged errors (`UserNotFoundError`, `PostNotFoundError`, `ValidationError`, `DatabaseError`) for type-safe error handling
3. **Effect Programs**: Using `Effect.gen` for imperative-style effect composition
4. **Layer System**: Service layers for providing implementations with proper dependency management
5. **Runtime**: Creating and using Effect runtimes to execute programs
6. **Service Composition**: PostService depends on UserService; both depend on DatabaseService
7. **Resource Management**: DatabaseService manages connection lifecycle with automatic cleanup

### Service Pattern

Each service (`DatabaseService`, `UserService`, `PostService`) is defined as an Effect service with:
- Clear interface definition using `Context.Tag`
- Implementation separated in a Layer
- All operations return `Effect` types for composability
- Type-safe error handling with union types
- Explicit dependency declarations through Effect layers

### Database Integration

The database layer demonstrates Effect's resource management:
- **DatabaseService**: Manages PostgreSQL connection pool as an Effect service
- **Layer Composition**: `Layer.provide()` ensures DatabaseService is available to dependent services
- **Connection Lifecycle**: Automatic cleanup when the Effect scope ends
- **Type-Safe Queries**: Drizzle ORM provides end-to-end type safety
- **Error Handling**: Database errors wrapped in `Effect.tryPromise` for composable error handling

### Hono Integration

Each route:
1. Defines an Effect program using the appropriate service
2. Runs the program using the Effect runtime
3. Handles success/failure cases
4. Returns appropriate HTTP responses with correct status codes

## Validation Rules

### Users
- Username is required and must not be empty
- Username must be unique
- Email is required and must not be empty
- Display name is required and must not be empty
- Bio is optional

### Posts
- Content is required and must not be empty
- Content must be 280 characters or less (Twitter-like constraint)
- User must exist (verified via UserService dependency)

## HTTP Status Codes

- **200** - Successful GET, PUT, DELETE operations
- **201** - Successful POST (resource created)
- **400** - Validation error
- **404** - Resource not found
- **409** - Conflict (e.g., username already exists)
- **500** - Internal server error

## Next Steps

To extend this API, you could:

1. **Add Authentication**: Implement JWT or session-based auth with Effect
2. **Add Followers/Following**: Implement Twitter-like social graph
3. **Add Likes/Retweets**: Add engagement features for posts
4. **Add Pagination**: Implement cursor-based or offset pagination for large datasets
5. **Add Search**: Full-text search for users and posts using PostgreSQL features
6. **Add Schema Validation**: Use Effect Schema or Zod for runtime input validation
7. **Add Logging**: Integrate Effect's logging capabilities for observability
8. **Add Testing**: Write tests using Effect's testing utilities and Drizzle's test helpers
9. **Add Media Support**: Allow image uploads for posts with cloud storage
10. **Add Caching**: Implement Redis caching layer for frequently accessed data
11. **Add Database Indexes**: Optimize query performance with proper indexes
12. **Add Connection Pooling**: Fine-tune PostgreSQL connection pool settings

## Resources

- [Hono Documentation](https://hono.dev/)
- [Effect Documentation](https://effect.website/)
- [Bun Documentation](https://bun.sh/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## License

MIT
