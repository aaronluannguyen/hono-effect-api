# Hono + Effect + Bun REST API

A Twitter-like REST API built with:
- **TypeScript** - Type-safe development
- **Hono** - Fast, lightweight web framework
- **Bun** - JavaScript runtime and package manager
- **Effect** - Powerful functional programming library for managing effects

## Features

- Full CRUD operations for Users and Posts
- Effect-based error handling
- Type-safe API with TypeScript
- Service layer pattern with dependency injection
- In-memory storage (easily replaceable with a database)
- Twitter-like features (280 character limit, user posts feed)

## Prerequisites

- [Bun](https://bun.sh/) installed on your system

## Installation

```bash
# Install dependencies
bun install
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
└── services/
    ├── UserService.ts    # User service with Effect-based operations
    └── PostService.ts    # Post service with Effect-based operations
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
2. **Error Handling**: Tagged errors (`UserNotFoundError`, `PostNotFoundError`, `ValidationError`) for type-safe error handling
3. **Effect Programs**: Using `Effect.gen` for imperative-style effect composition
4. **Layer System**: Service layers for providing implementations
5. **Runtime**: Creating and using Effect runtimes to execute programs
6. **Service Composition**: PostService depends on UserService to verify users exist

### Service Pattern

Each service (`UserService`, `PostService`) is defined as an Effect service with:
- Clear interface definition using `Context.Tag`
- Implementation separated in a Layer
- All operations return `Effect` types for composability
- Type-safe error handling with union types

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

1. **Add a Database**: Replace in-memory storage with PostgreSQL, MongoDB, etc.
2. **Add Authentication**: Implement JWT or session-based auth with Effect
3. **Add Followers/Following**: Implement Twitter-like social graph
4. **Add Likes/Retweets**: Add engagement features for posts
5. **Add Pagination**: Implement cursor-based or offset pagination
6. **Add Search**: Full-text search for users and posts
7. **Add Validation**: Use Effect Schema for schema validation
8. **Add Logging**: Integrate Effect's logging capabilities
9. **Add Testing**: Write tests using Effect's testing utilities
10. **Add Media Support**: Allow image uploads for posts

## Resources

- [Hono Documentation](https://hono.dev/)
- [Effect Documentation](https://effect.website/)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## License

MIT
