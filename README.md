# Hono + Effect + Bun REST API

A simple REST API built with:
- **TypeScript** - Type-safe development
- **Hono** - Fast, lightweight web framework
- **Bun** - JavaScript runtime and package manager
- **Effect** - Powerful functional programming library for managing effects

## Features

- Full CRUD operations for Todo items
- Effect-based error handling
- Type-safe API with TypeScript
- Service layer pattern with dependency injection
- In-memory storage (easily replaceable with a database)

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

### Todos
- **GET** `/todos` - Get all todos
- **GET** `/todos/:id` - Get a specific todo
- **POST** `/todos` - Create a new todo
- **PUT** `/todos/:id` - Update a todo
- **DELETE** `/todos/:id` - Delete a todo

## Example Usage

### Get all todos
```bash
curl http://localhost:3000/todos
```

### Create a todo
```bash
curl -X POST http://localhost:3000/todos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn EffectTS",
    "description": "Study the Effect library documentation"
  }'
```

### Get a specific todo
```bash
curl http://localhost:3000/todos/1
```

### Update a todo
```bash
curl -X PUT http://localhost:3000/todos/1 \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Master EffectTS",
    "completed": true
  }'
```

### Delete a todo
```bash
curl -X DELETE http://localhost:3000/todos/1
```

## Project Structure

```
src/
├── index.ts              # Main application entry point with Hono routes
├── types.ts              # TypeScript type definitions
├── errors.ts             # Effect-based error types
└── services/
    └── TodoService.ts    # Todo service with Effect-based operations
```

## Key Concepts

### Effect Integration

This project demonstrates several EffectTS patterns:

1. **Effect Services**: Using `Context.Tag` to define services with dependency injection
2. **Error Handling**: Tagged errors (`TodoNotFoundError`, `ValidationError`) for type-safe error handling
3. **Effect Programs**: Using `Effect.gen` for imperative-style effect composition
4. **Layer System**: Service layers for providing implementations
5. **Runtime**: Creating and using Effect runtimes to execute programs

### Service Pattern

The `TodoService` is defined as an Effect service with:
- Clear interface definition using `Context.Tag`
- Implementation separated in a Layer (`TodoServiceLiveLayer`)
- All operations return `Effect` types for composability
- Type-safe error handling with union types

### Hono Integration

Each route:
1. Defines an Effect program using the TodoService
2. Runs the program using the Effect runtime
3. Handles success/failure cases
4. Returns appropriate HTTP responses

## Next Steps

To extend this API, you could:

1. **Add a Database**: Replace in-memory storage with PostgreSQL, MongoDB, etc.
2. **Add Authentication**: Implement JWT or session-based auth with Effect
3. **Add Validation**: Use a schema library like Zod or Effect Schema
4. **Add Logging**: Integrate Effect's logging capabilities
5. **Add Testing**: Write tests using Effect's testing utilities
6. **Add More Services**: Create additional services for users, projects, etc.

## Resources

- [Hono Documentation](https://hono.dev/)
- [Effect Documentation](https://effect.website/)
- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/)

## License

MIT
