# Design Document

## Overview

This design addresses TypeScript type safety issues across 9 files in the booking/waitlist management system. The solution focuses on adding explicit type annotations, correcting API usage, and ensuring type consistency throughout the codebase. The design maintains backward compatibility while eliminating all 49 TypeScript compilation errors.

## Architecture

### Type System Hierarchy

```
Express.Request (base)
  ↓
  Extended via declaration merging
  ↓
Express.Request (with custom properties)
  - user?: TokenPayload
  - tenantId?: string
  - repositories?: {...}
  - requestId?: string
  - db?: any
```

### Affected Components

1. **Route Handlers** (whatsapp-templates.ts, public.ts, push.ts, webhooks.ts)
   - Missing type annotations on req/res parameters
   - Need explicit Request/Response types

2. **Services** (CalendarService.ts, NotificationService.ts, WaitlistService.ts)
   - Incorrect Google OAuth API usage
   - Redis multi-command type issues
   - Type mismatches in notification channels

3. **Middleware** (monitoring.ts)
   - Missing type annotations on middleware functions
   - Response method override type safety

4. **Test Helpers** (database.ts)
   - Test utility type annotations

## Components and Interfaces

### 1. Express Request Type Extensions

The system already extends Express.Request through declaration merging in `src/middleware/auth.ts`:

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      tenantId?: string;
      repositories?: {
        user: UserRepository;
        tenant: TenantRepository;
        [key: string]: any;
      };
      requestId?: string;  // Added by monitoring middleware
      db?: any;            // Added by database middleware
    }
  }
}
```

**Design Decision**: Use the existing declaration merging pattern. All route handlers should import from 'express' and use `Request` and `Response` types directly.

### 2. Route Handler Type Annotations

**Pattern for Unauthenticated Routes**:
```typescript
import { Request, Response } from 'express';

router.get('/path', async (req: Request, res: Response) => {
  // Handler implementation
});
```

**Pattern for Authenticated Routes**:
```typescript
import { Request, Response } from 'express';

router.get('/path', authenticate, async (req: Request, res: Response) => {
  // req.tenantId is available but optional (string | undefined)
  // Use non-null assertion or null check
  const tenantId = req.tenantId!; // When guaranteed by authenticate middleware
  // OR
  if (!req.tenantId) {
    return res.status(401).json({ error: 'Tenant ID missing' });
  }
});
```

**Rationale**: The authenticate middleware always sets `req.tenantId`, but TypeScript sees it as optional. Using non-null assertion (`!`) is safe after authenticate middleware runs.

### 3. Google Calendar OAuth API Correction

**Current (Incorrect)**:
```typescript
this.oauth2Client.getAccessToken(code, (err, tokens) => {
  if (err) reject(err);
  else resolve({ tokens });
});
```

**Corrected**:
```typescript
const { tokens } = await this.oauth2Client.getToken(code);
```

**API Details**:
- Method: `getToken(code: string): Promise<GetTokenResponse>`
- Returns: `{ tokens: Credentials }`
- No callback parameter needed

**Rationale**: The googleapis library v100+ uses promise-based APIs. The callback-based `getAccessToken` method doesn't exist in the current version.

### 4. Redis Multi-Command Type Handling

**Current (Incorrect)**:
```typescript
const multi = redisClient.multi();
multi.incr(key);
multi.expire(key, Math.floor(windowMs / 1000));
await multi.exec();
```

**Issue**: TypeScript cannot infer the correct type for chained multi commands.

**Corrected Approach**:
```typescript
const multi = redisClient.multi();
await multi
  .incr(key)
  .expire(key, Math.floor(windowMs / 1000))
  .exec();
```

**Alternative (if chaining doesn't work)**:
```typescript
await redisClient.multi()
  .incr(key)
  .expire(key, Math.floor(windowMs / 1000))
  .exec();
```

**Rationale**: Chaining the commands in a single expression helps TypeScript infer the correct multi-command type. If the Redis client version doesn't support proper type inference, we may need to add a type assertion.

### 5. Notification Channel Type Consistency

**Current Issue**: `notification_channels` is defined as `string[]` but should be `NotificationType[]`.

**Type Definition**:
```typescript
export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp'
}
```

**Correction Strategy**:
1. Cast string arrays to `NotificationType[]` when creating entries
2. Validate that strings are valid NotificationType values
3. Use type guards for runtime validation

**Implementation**:
```typescript
// In WaitlistService.createWaitlistEntry
const notificationChannels: NotificationType[] = (data.notification_channels || [])
  .filter((ch): ch is NotificationType => 
    Object.values(NotificationType).includes(ch as NotificationType)
  );

const preferredChannel: NotificationType = 
  (data.preferred_channel && Object.values(NotificationType).includes(data.preferred_channel as NotificationType))
    ? data.preferred_channel as NotificationType
    : NotificationType.EMAIL;
```

**Rationale**: This provides both compile-time type safety and runtime validation, ensuring only valid notification types are stored.

## Data Models

### WaitlistEntry Interface Update

```typescript
interface WaitlistEntry {
  // ... other fields
  notification_channels: NotificationType[];  // Changed from string[]
  preferred_channel: NotificationType;        // Changed from string
}
```

### CreateWaitlistEntryData Interface Update

```typescript
interface CreateWaitlistEntryData {
  // ... other fields
  notification_channels?: string[];  // Keep as string[] for API input
  preferred_channel?: string;        // Keep as string for API input
}
```

**Rationale**: API inputs remain flexible (strings), but internal models use strict types. Conversion happens at the service layer.

## Error Handling

### Tenant ID Null Safety

**Pattern 1: Non-null Assertion (when guaranteed by middleware)**:
```typescript
router.get('/path', authenticate, async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const service = new SomeService(req.db, tenantId);
});
```

**Pattern 2: Explicit Check (when extra safety needed)**:
```typescript
router.get('/path', authenticate, async (req: Request, res: Response) => {
  if (!req.tenantId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }
  const service = new SomeService(req.db, req.tenantId);
});
```

**Rationale**: Pattern 1 is preferred for routes protected by authenticate middleware. Pattern 2 provides extra safety for critical operations.

### Type Validation for Notification Channels

```typescript
function isValidNotificationType(value: string): value is NotificationType {
  return Object.values(NotificationType).includes(value as NotificationType);
}

function validateNotificationChannels(channels: string[]): NotificationType[] {
  return channels.filter(isValidNotificationType);
}
```

**Rationale**: Type guards provide runtime safety while maintaining TypeScript type narrowing.

## Testing Strategy

### Type Safety Verification

1. **Compilation Test**: Run `tsc --noEmit` to verify no type errors
2. **Unit Tests**: Existing tests should continue to pass
3. **Integration Tests**: Verify notification channel type handling
4. **Manual Testing**: Test OAuth flow and Redis operations

### Test Cases

1. **Route Handler Types**
   - Verify all route handlers compile without errors
   - Test authenticated routes with tenantId access

2. **Google Calendar OAuth**
   - Test token exchange with valid authorization code
   - Verify error handling for invalid codes

3. **Redis Multi-Commands**
   - Test rate limiting with Redis transactions
   - Verify expire and exec methods work correctly

4. **Notification Channels**
   - Test creating waitlist entries with valid notification types
   - Test validation rejects invalid notification channel strings
   - Verify type consistency in updates

### Regression Prevention

- Add ESLint rule to enforce explicit function return types
- Configure TypeScript strict mode flags:
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `strictFunctionTypes: true`

## Implementation Notes

### File-by-File Changes

1. **src/routes/whatsapp-templates.ts** (8 errors)
   - Add `Request, Response` imports
   - Annotate 5 route handler parameters
   - Add non-null assertion for `req.tenantId` on line 365

2. **src/services/CalendarService.ts** (3 errors)
   - Replace `getAccessToken` callback with `getToken` promise
   - Remove callback parameter types

3. **src/services/NotificationService.ts** (2 errors)
   - Chain Redis multi commands in single expression
   - Or add type assertion for multi command

4. **src/services/WaitlistService.ts** (2 errors)
   - Add type conversion for notification_channels
   - Add validation for NotificationType values

5. **src/middleware/monitoring.ts** (19 errors)
   - Add `Request, Response, NextFunction` type annotations
   - Type the response.end override correctly

6. **src/routes/public.ts** (15 errors)
   - Add type annotations to all route handlers

7. **src/routes/push.ts** (13 errors)
   - Add type annotations to all route handlers

8. **src/routes/webhooks.ts** (18 errors)
   - Add type annotations to all route handlers

9. **src/__tests__/helpers/database.ts** (1 error)
   - Add type annotation to test helper function

### Dependencies

No new dependencies required. All fixes use existing TypeScript and library features.

### Backward Compatibility

All changes are type-level only. No runtime behavior changes except:
- Google Calendar OAuth uses correct API (fixes broken functionality)
- Notification channel validation (improves data integrity)

Both changes are improvements, not breaking changes.

## Performance Considerations

- Type annotations have zero runtime cost (erased during compilation)
- Notification channel validation adds minimal overhead (one filter operation)
- Redis multi-command chaining has identical performance to current implementation

## Security Considerations

- Tenant ID null checks prevent unauthorized access to tenant data
- Notification channel validation prevents injection of invalid channel types
- Type safety reduces risk of runtime errors in production
