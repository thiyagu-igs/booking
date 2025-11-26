# Requirements Document

## Introduction

This specification addresses TypeScript type safety issues across the booking/waitlist management system. The system currently has 49 TypeScript compilation errors across 9 files, including implicit 'any' types, type mismatches, and incorrect API usage. These errors prevent successful compilation and deployment, and reduce code maintainability and type safety.

## Glossary

- **System**: The booking/waitlist management backend application
- **TypeScript Compiler**: The tool that validates and compiles TypeScript code
- **Express Handler**: A function that processes HTTP requests in the Express framework
- **Request Object**: The Express request object containing HTTP request data
- **Response Object**: The Express response object used to send HTTP responses
- **Type Annotation**: Explicit TypeScript type declaration for variables and parameters
- **OAuth2Client**: Google's authentication client for calendar integration
- **Redis Multi Command**: A Redis transaction that batches multiple operations
- **NotificationType**: An enum defining valid notification channels (EMAIL, SMS, WHATSAPP)
- **Twilio Client**: The SDK client for sending SMS and WhatsApp messages
- **Implicit Any**: A TypeScript error where a variable's type cannot be inferred and defaults to 'any'

## Requirements

### Requirement 1: Express Route Handler Type Safety

**User Story:** As a developer, I want all Express route handlers to have explicit type annotations, so that the TypeScript compiler can validate request and response handling.

#### Acceptance Criteria

1. WHEN THE System compiles TypeScript files, THE System SHALL ensure all Express route handler parameters have explicit type annotations
2. WHEN an Express route handler is defined, THE System SHALL annotate 'req' parameter as 'Request' type from express-validator or custom AuthRequest type
3. WHEN an Express route handler is defined, THE System SHALL annotate 'res' parameter as 'Response' type from express
4. WHERE a route handler requires authentication, THE System SHALL use AuthRequest type that includes tenantId property
5. THE System SHALL eliminate all TS7006 errors related to implicit 'any' types in route handlers

### Requirement 2: Google Calendar OAuth Type Correctness

**User Story:** As a developer, I want the Google Calendar OAuth integration to use the correct API methods, so that calendar synchronization works reliably.

#### Acceptance Criteria

1. WHEN THE System exchanges OAuth authorization codes for tokens, THE System SHALL use the promise-based getToken method instead of callback-based getAccessToken
2. WHEN THE System calls oauth2Client.getToken, THE System SHALL handle the returned Promise<GetTokenResponse> correctly
3. THE System SHALL eliminate TS2554 error related to incorrect argument count for getAccessToken
4. THE System SHALL eliminate TS7006 errors related to callback parameter types in CalendarService

### Requirement 3: Redis Multi-Command Type Safety

**User Story:** As a developer, I want Redis multi-command operations to be properly typed, so that rate limiting and caching work correctly.

#### Acceptance Criteria

1. WHEN THE System creates a Redis multi-command transaction, THE System SHALL use the correct RedisClientMultiCommandType interface
2. WHEN THE System chains Redis commands in a transaction, THE System SHALL ensure expire and exec methods are properly typed
3. THE System SHALL eliminate TS2339 errors related to missing 'expire' and 'exec' properties on Redis multi commands
4. THE System SHALL handle Redis multi-command chaining with proper type inference

### Requirement 4: Notification Channel Type Consistency

**User Story:** As a developer, I want notification channel types to be consistent throughout the codebase, so that multi-channel notifications work reliably.

#### Acceptance Criteria

1. WHEN THE System creates a waitlist entry with notification channels, THE System SHALL use NotificationType enum values instead of string arrays
2. WHEN THE System updates waitlist entry notification preferences, THE System SHALL validate that notification_channels contains only NotificationType values
3. THE System SHALL eliminate TS2345 errors related to string[] not being assignable to NotificationType[]
4. THE System SHALL eliminate TS2322 errors related to notification_channels type mismatches in WaitlistService

### Requirement 5: Tenant ID Null Safety

**User Story:** As a developer, I want tenant ID access to be null-safe, so that multi-tenant operations don't fail with undefined errors.

#### Acceptance Criteria

1. WHEN THE System accesses req.tenantId in authenticated routes, THE System SHALL ensure the value is defined before use
2. WHERE req.tenantId might be undefined, THE System SHALL add null checks or type guards
3. THE System SHALL eliminate TS2345 errors related to 'string | undefined' not being assignable to 'string'
4. THE System SHALL provide clear error messages when tenant ID is missing in authenticated contexts

### Requirement 6: Middleware Type Annotations

**User Story:** As a developer, I want middleware functions to have proper type annotations, so that request processing is type-safe.

#### Acceptance Criteria

1. WHEN THE System defines middleware functions, THE System SHALL annotate all parameters with Express types
2. WHEN middleware modifies the response object, THE System SHALL maintain proper type safety for overridden methods
3. THE System SHALL eliminate all TS7006 errors in middleware files
4. THE System SHALL ensure custom properties on Request objects are properly typed through declaration merging

### Requirement 7: Service Constructor Consistency

**User Story:** As a developer, I want service class constructors to have consistent signatures, so that services can be instantiated correctly throughout the application.

#### Acceptance Criteria

1. WHEN THE System instantiates NotificationService, THE System SHALL provide both db and tenantId parameters
2. WHEN THE System instantiates WaitlistService, THE System SHALL provide repository instances instead of db and tenantId
3. WHEN THE System instantiates SlotService, THE System SHALL provide all required repository and service dependencies
4. THE System SHALL eliminate TS2554 errors related to incorrect argument counts in service constructors

### Requirement 8: Repository Method Signatures

**User Story:** As a developer, I want repository methods to match their actual implementations, so that data access operations work correctly.

#### Acceptance Criteria

1. WHEN THE System calls WaitlistRepository.findByPhone, THE System SHALL provide only the phone parameter
2. WHEN THE System accesses WaitlistRepository.calculatePriorityScore, THE System SHALL recognize it as a private method
3. THE System SHALL eliminate TS2554 errors related to incorrect argument counts in repository methods
4. THE System SHALL eliminate TS2341 errors related to accessing private methods

### Requirement 9: Data Model Completeness

**User Story:** As a developer, I want data model objects to include all required properties, so that database operations succeed.

#### Acceptance Criteria

1. WHEN THE System creates a WaitlistEntry, THE System SHALL include vip_status, notification_channels, and preferred_channel properties
2. THE System SHALL eliminate TS2345 errors related to missing required properties
3. THE System SHALL eliminate TS2353 errors related to unknown properties in object literals
4. THE System SHALL ensure all required WaitlistEntry fields are provided during creation

### Requirement 10: Error Type Handling

**User Story:** As a developer, I want error objects to be properly typed in catch blocks, so that error handling is type-safe.

#### Acceptance Criteria

1. WHEN THE System catches errors in try-catch blocks, THE System SHALL properly type error parameters
2. WHEN THE System accesses error properties, THE System SHALL use type guards or type assertions
3. THE System SHALL eliminate TS7006 errors related to implicit 'any' type on error parameters
4. THE System SHALL eliminate TS18046 errors related to accessing properties on 'unknown' type errors

### Requirement 11: Static Method Usage

**User Story:** As a developer, I want to use AuditService methods correctly, so that audit logging works as designed.

#### Acceptance Criteria

1. WHEN THE System calls AuditService methods, THE System SHALL use static method syntax
2. THE System SHALL eliminate TS2339 errors related to missing instance methods on AuditService
3. THE System SHALL not attempt to instantiate AuditService with constructor parameters
4. THE System SHALL use AuditService.log or AuditService.logFromRequest for audit logging

### Requirement 12: Compilation Success

**User Story:** As a developer, I want the TypeScript compilation to succeed without errors, so that the application can be built and deployed.

#### Acceptance Criteria

1. WHEN THE System runs TypeScript compilation, THE System SHALL complete without any type errors
2. THE System SHALL reduce the error count to 0 across all affected files
3. THE System SHALL maintain backward compatibility with existing functionality while fixing type errors
4. THE System SHALL not introduce new type errors in the process of fixing existing ones
