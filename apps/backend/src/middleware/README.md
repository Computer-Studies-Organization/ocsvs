# Middleware

This directory contains middleware functions and utilities for the Hono application. Middleware in Hono are functions that execute during the request-response cycle and can modify requests, responses, or terminate the cycle early.

## Structure

```
middleware/
├── README.md                 # This file
├── env.ts                   # Environment configuration with validation
├── custom-logger.ts         # Simple timestamp-based logger
├── pino-logger.ts          # Structured logging with Pino
└── utils/                  # Utility functions for middleware
    ├── create-error-schema.ts    # OpenAPI error schema generator
    ├── id-params-validator.ts    # URL parameter validation
    ├── json-content.ts          # OpenAPI JSON content helpers
    ├── not-found.ts            # 404 error handler
    ├── on-error.ts             # Global error handler
    └── serve-emoji-favicon.ts   # Emoji favicon middleware
```

## Core Middleware

### Environment Configuration (`env.ts`)

Provides type-safe environment variable validation and access throughout the application.

```typescript
import env from '@/middleware/env'

console.log(env.PORT)        // number (default: 3000)
console.log(env.NODE_ENV)    // string (default: 'development')
console.log(env.DATABASE_URL) // string (required)
```

**Environment Variables:**
- `NODE_ENV`: Application environment (default: 'development')
- `PORT`: Server port (default: 3000)
- `LOG_LEVEL`: Logging verbosity (default: 'info')
- `DATABASE_URL`: Database connection URL (required)

### Logging Middleware

#### Pino Logger (`pino-logger.ts`)

Structured logging with environment-aware formatting:

```typescript
import { logger } from '@/middleware/pino-logger'

app.use(logger()) // Pretty logs in dev, JSON in production
```

**Features:**
- Environment-aware formatting
- Configurable log levels
- Automatic request ID generation
- Structured JSON output in production

#### Custom Logger (`custom-logger.ts`)

Simple timestamp-based logging:

```typescript
import { customLogger } from '@/middleware/custom-logger'

app.use(logger(customLogger))
customLogger('Server started', 'on port 3000')
// Output: [2024-01-15T10:30:45.123Z] - Server started on port 3000
```

## Utility Functions (`utils/`)

### OpenAPI Utilities

#### Error Schema Generator (`create-error-schema.ts`)

Creates standardized error schemas for OpenAPI documentation:

```typescript
import createErrorSchema from '@/middleware/utils/create-error-schema'

responses: {
  [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
    createErrorSchema(insertItemSchema),
    'Validation error'
  )
}
```

#### JSON Content Helpers (`json-content.ts`)

Standardizes JSON content objects for OpenAPI:

```typescript
import jsonContent, { jsonContentRequired } from '@/middleware/utils/json-content'

// For responses
responses: {
  [httpStatusCodes.OK]: jsonContent(itemSchema, 'Item details')
}

// For required request bodies
request: {
  body: jsonContentRequired(createItemSchema, 'Item to create')
}
```

#### ID Parameter Validator (`id-params-validator.ts`)

Validates numeric ID parameters in URL paths:

```typescript
import IdParamsSchema from '@/middleware/utils/id-params-validator'

export const getItem = createRoute({
  path: '/items/{id}',
  request: { params: IdParamsSchema },
  // ...
})
```

### Error Handling

#### Global Error Handler (`on-error.ts`)

Handles all unhandled errors with environment-aware details:

```typescript
import onError from '@/middleware/utils/on-error'

app.onError(onError)
```

**Features:**
- HTTPException handling
- Environment-aware stack traces
- Consistent error response format
- Development vs production error details

#### 404 Handler (`not-found.ts`)

Standardized 404 responses for undefined routes:

```typescript
import notFound from '@/middleware/utils/not-found'

app.notFound(notFound)
```

## Usage Patterns

### Basic App Setup

```typescript
import { createRouter } from '@/lib/create-app'
import { logger } from '@/middleware/pino-logger'
import notFound from '@/middleware/utils/not-found'
import onError from '@/middleware/utils/on-error'

const app = createRouter()
  .use(logger())
  .notFound(notFound)
  .onError(onError)
```

### Route Definition with Utilities

```typescript
import { createRoute } from '@hono/zod-openapi'
import createErrorSchema from '@/middleware/utils/create-error-schema'
import IdParamsSchema from '@/middleware/utils/id-params-validator'
import jsonContent from '@/middleware/utils/json-content'

export const getItem = createRoute({
  path: '/items/{id}',
  method: 'get',
  request: {
    params: IdParamsSchema,
  },
  responses: {
    [httpStatusCodes.OK]: jsonContent(itemSchema, 'Item details'),
    [httpStatusCodes.NOT_FOUND]: jsonContent(errorSchema, 'Item not found'),
    [httpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
      createErrorSchema(IdParamsSchema),
      'Invalid ID parameter'
    ),
  },
})
```

## Best Practices

1. **Environment Variables**: Always use the `env` module for accessing environment variables to ensure type safety and validation.

2. **Error Handling**: Use the provided error utilities (`createErrorSchema`, `onError`, `notFound`) for consistent error responses.

3. **Logging**: Prefer the Pino logger for structured logging in production applications. Use the custom logger for simple development scenarios.

4. **OpenAPI Documentation**: Use the JSON content utilities to maintain consistent OpenAPI schema definitions.

5. **Parameter Validation**: Use `IdParamsSchema` for numeric ID parameters and create similar schemas for other parameter types.

## Development vs Production

The middleware is designed to behave differently based on the environment:

- **Development**: Pretty-printed logs, detailed error messages with stack traces
- **Production**: Structured JSON logs, sanitized error responses without stack traces

This is automatically handled by checking `env.NODE_ENV` throughout the middleware stack.