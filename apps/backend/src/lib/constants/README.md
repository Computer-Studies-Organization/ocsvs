# Constants Directory

This directory contains centralized constants used throughout the application to ensure consistency.

## Error Messages (`error-messages.ts`)

The `error-messages.ts` file contains standardized error and success messages used across all API endpoints. This ensures:

1. **Consistency**: Same message format across all endpoints
2. **Maintainability**: Easy to update messages in one place
3. **Type Safety**: TypeScript types prevent typos in message keys
4. **Internationalization Ready**: Centralized messages make future i18n implementation easier

### Usage Example

```typescript
import { ERROR_MESSAGES } from '@/lib/constants/error-messages'

// In handlers
return c.json(
  { message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND },
  httpStatusCodes.NOT_FOUND
)

// In tests
expect(body.message).toBe(ERROR_MESSAGES.CANDIDATE_CREATED_SUCCESSFULLY)
```

### Message Categories

- **Authentication errors**: Login, registration, session issues
- **Resource not found errors**: When specific resources don't exist
- **Conflict errors**: When resources already exist
- **Validation errors**: Invalid input or request format
- **Success messages**: Successful operation confirmations
- **Server errors**: Internal server issues

### Adding New Messages

1. Add the message constant to `ERROR_MESSAGES` object
2. Use a descriptive, uppercase key name
3. Add the type to the `ErrorMessageKey` type if needed
4. Update handlers and routes to use the new constant
5. Update tests to expect the new constant

### Benefits

- **Consistent User Experience**: Users see the same message format
- **Easier Testing**: Tests use the same constants as the code
- **Better Documentation**: All messages are in one place
- **Reduced Bugs**: No more typos in error messages
- **Future-Proof**: Easy to extend for new requirements
