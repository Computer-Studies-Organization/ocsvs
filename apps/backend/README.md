# Hono REST API Starter Template

A modern, type-safe REST API built with Hono, TypeScript, and SQLite. Features comprehensive OpenAPI documentation, database migrations, and full test coverage.

## Features

- **Modern Stack**: Built with [Hono](https://hono.dev/) - a fast, lightweight web framework
- **Type Safety**: Full TypeScript support with Zod validation
- **Database**: [Turso](https://turso.tech/) (LibSQL) with [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- **API Documentation**: Auto-generated OpenAPI 3.0 specs with [Scalar](https://scalar.com/) UI
- **Testing**: Comprehensive test suite with Vitest
- **Logging**: Structured logging with Pino
- **Validation**: Request/response validation with Zod schemas
- **Migrations**: Database schema versioning with Drizzle Kit
- **Development**: Hot reload with tsx watch mode

## Prerequisites

- Node.js 18+
- npm, pnpm, or bun

## Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd template-api
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   pnpm install
   # or
   bun install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and configure:

   ```env
   NODE_ENV=development
   PORT=3000
   LOG_LEVEL=info
   DATABASE_URL=libsql:turso.io?authToken=YOUR_TOKEN
   ```

   **For local development**, you can use a local SQLite file:

   ```env
   DATABASE_URL=file:./local.db
   ```

4. **Run database migrations**
   ```bash
   npx drizzle-kit migrate
   ```

## Getting Started

### Development

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### Production

```bash
npm run build
npm start
```

## API Documentation

Once the server is running, you can access:

- **API Documentation**: `http://localhost:3000/reference`
- **OpenAPI Spec**: `http://localhost:3000/docs`
- **Root Endpoint**: `http://localhost:3000/`

## API Endpoints

### Items Resource

| Method   | Endpoint      | Description       |
| -------- | ------------- | ----------------- |
| `GET`    | `/items`      | List all items    |
| `POST`   | `/items`      | Create a new item |
| `GET`    | `/items/{id}` | Get item by ID    |
| `PATCH`  | `/items/{id}` | Update item       |
| `DELETE` | `/items/{id}` | Delete item       |

### Example Usage

**Create an item:**

```bash
curl -X POST http://localhost:3000/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sample Item",
    "description": "This is a sample item",
    "available": true
  }'
```

**Get all items:**

```bash
curl http://localhost:3000/items
```

**Update an item:**

```bash
curl -X PATCH http://localhost:3000/items/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Item Name"
  }'
```

## Database Schema

### Items Table

```sql
CREATE TABLE items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  available INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## Testing

Run the test suite:

```bash
npm test
```

The tests cover all CRUD operations and include:

- Creating items
- Listing items
- Getting items by ID
- Updating items
- Deleting items

## Project Structure

```
src/
├── app.ts                      # Main application setup
├── index.ts                    # Server entry point
├── config/
│   └── db/
│       └── index.ts           # Database connection
├── database/
│   ├── schema.ts              # Drizzle schema definitions
│   └── migrations/            # Database migrations
├── handlers/
│   └── items.handlers.ts      # Business logic for items
├── lib/
│   ├── create-app.ts          # App factory with middleware
│   ├── openapi-configuration.ts # OpenAPI setup
│   └── types/                 # TypeScript type definitions
├── middleware/
│   ├── env.ts                 # Environment validation
│   ├── pino-logger.ts         # Logging setup
│   └── utils/                 # Utility middleware
├── openapi/
│   ├── default-hook.ts        # Validation hooks
│   ├── http-status-codes.ts   # HTTP status constants
│   └── http-status-phrases.ts # HTTP status messages
├── routes/
│   ├── index.route.ts         # Root routes
│   └── items/                 # Items resource routes
└── tests/
    └── items.test.ts          # Test suite
```

## Scripts

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start development server with hot reload |
| `npm run build`    | Build for production                     |
| `npm start`        | Start production server                  |
| `npm test`         | Run test suite                           |
| `npm run lint`     | Run ESLint                               |
| `npm run lint:fix` | Fix ESLint issues                        |

## Database Operations

### Generate Migration

```bash
npx drizzle-kit generate
```

### Run Migrations

```bash
npx drizzle-kit migrate
```

### Database Studio

```bash
npx drizzle-kit studio
```

## Environment Variables

| Variable              | Description                             | Default       | Required        |
| --------------------- | --------------------------------------- | ------------- | --------------- |
| `NODE_ENV`            | Environment mode                        | `development` | No              |
| `PORT`                | Server port                             | `3000`        | No              |
| `LOG_LEVEL`           | Logging level                           | `info`        | No              |
| `DATABASE_URL`        | Turso database URL or local SQLite file | -             | Yes             |
| `DATABASE_AUTH_TOKEN` | Turso authentication token              | -             | Yes (for Turso) |

## Architecture

This API follows a clean architecture pattern:

- **Routes**: Define OpenAPI specifications and route handlers
- **Handlers**: Contain business logic and database operations
- **Middleware**: Handle cross-cutting concerns (logging, validation, errors)
- **Schema**: Define database structure and validation rules
- **Types**: Provide type safety across the application

## Validation

All requests and responses are validated using Zod schemas:

- **Input Validation**: Request bodies and parameters are validated
- **Output Validation**: Response schemas ensure consistent API contracts
- **Error Handling**: Detailed validation errors with field-level feedback

## Logging

Structured logging with Pino provides:

- Request/response logging
- Error tracking
- Performance monitoring
- Configurable log levels

## Deployment

### Using Docker (example)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup

- Set `NODE_ENV=production`
- Configure `DATABASE_URL` with your Turso database URL
- Set `DATABASE_AUTH_TOKEN` with your Turso authentication token

### Turso Setup

1. Create a Turso account at [turso.tech](https://turso.tech/)
2. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
3. Create a database: `turso db create your-database-name`
4. Get your database URL: `turso db show your-database-name --url`
5. Create an auth token: `turso db tokens create your-database-name`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Links

- [Hono Documentation](https://hono.dev/)
- [Turso Database](https://turso.tech/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Zod Validation](https://zod.dev/)
- [Scalar API Documentation](https://scalar.com/)
- [Vitest Testing](https://vitest.dev/)
