# Implementation Plan

- [x] 1. Fix WhatsApp Templates Route Type Errors





  - Add Request and Response type imports from express
  - Add type annotations to all route handler parameters (req: Request, res: Response)
  - Add non-null assertion for req.tenantId on line 365 where WhatsAppTemplateService is instantiated
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3_

- [x] 2. Fix Google Calendar OAuth API Usage





  - Replace getAccessToken callback-based call with getToken promise-based call in CalendarService.ts
  - Update the code to use await with getToken method
  - Remove callback parameter type annotations (err, tokens)
  - Handle the returned Promise<GetTokenResponse> correctly by destructuring tokens
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 3. Fix Redis Multi-Command Type Issues





  - Refactor Redis multi-command usage in NotificationService.ts to chain commands in single expression
  - Change from separate multi.incr() and multi.expire() calls to chained multi.incr().expire().exec()
  - Verify type inference works correctly for chained commands
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Fix Notification Channel Type Consistency




- [x] 4.1 Add type conversion helper functions


  - Create isValidNotificationType type guard function
  - Create validateNotificationChannels function to filter and convert string[] to NotificationType[]
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.2 Update WaitlistService.createWaitlistEntry


  - Add type conversion for notification_channels from string[] to NotificationType[]
  - Add type conversion for preferred_channel from string to NotificationType
  - Use validation functions to ensure only valid NotificationType values are used
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4.3 Update WaitlistService.updateWaitlistEntry


  - Add type conversion for notification_channels in update operations
  - Ensure updateData uses NotificationType[] for notification_channels
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Fix Monitoring Middleware Type Errors






  - Add Request, Response, NextFunction type imports from express
  - Add type annotations to middleware function parameters
  - Add proper typing for res.end override (use function signature with proper this context)
  - Add type annotation for requestId property access
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 6.4_

- [x] 6. Fix Public Routes Type Errors





  - Add Request and Response type imports from express
  - Add type annotations to all route handler parameters in public.ts
  - Ensure all async route handlers have proper (req: Request, res: Response) signatures
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 7. Fix Push Notification Routes Type Errors





  - Add Request and Response type imports from express
  - Add type annotations to all route handler parameters in push.ts
  - Add type annotations for authenticated route handlers that access req.user
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 8. Fix Webhook Routes Type Errors





  - Add Request and Response type imports from express
  - Add type annotations to all route handler parameters in webhooks.ts
  - Ensure all async route handlers have proper type signatures
  - _Requirements: 1.1, 1.2, 1.3, 1.5_

- [x] 9. Fix Test Helper Type Errors





  - Add type annotations to test helper functions in src/__tests__/helpers/database.ts
  - Ensure all function parameters and return types are explicitly typed
  - _Requirements: 1.1, 1.5_

- [x] 10. Verify TypeScript Compilation





  - Run TypeScript compiler with tsc --noEmit to verify all errors are resolved
  - Confirm error count reduced from 49 to 0
  - Verify no new type errors were introduced
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11. Fix Public Routes Service Instantiation Errors









- [x] 11.1 Fix NotificationService instantiation for OTP sending




  - Add db parameter when instantiating NotificationService (line 154)
  - Replace sendSMS call with direct Twilio client usage for simple OTP messages
  - Import Twilio client and use messages.create for OTP delivery
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 11.2 Fix WaitlistRepository method calls




  - Replace findByPhone(phone, 'active') with findActiveByPhone(phone) on line 221
  - Remove calculatePriorityScore call (private method) and use inline priority calculation
  - Use default priority score of 50 for public waitlist signups
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 11.3 Fix WaitlistEntry creation with missing properties




  - Add vip_status: false to waitlist entry creation
  - Add notification_channels: [NotificationType.SMS] to entry creation
  - Add preferred_channel: NotificationType.SMS to entry creation
  - Import NotificationType enum from models
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 12. Fix Push Routes Error Type Handling










- [x] 12.1 Add type annotations for subscription map parameters



  - Add type annotation for 'sub' parameter in map callback on line 130
  - Add type annotation for 'sub' parameter in map callback on line 204
  - Use appropriate subscription interface type
  - _Requirements: 10.1, 10.2, 10.3, 10.4_


- [x] 12.2 Fix error type handling in catch blocks



  - Add type guard or type assertion for error on line 146
  - Add type guard or type assertion for error on line 152
  - Add type guard or type assertion for error on line 220
  - Add type guard or type assertion for error on line 226
  - Use pattern: `const err = error as any` or `if (error instanceof Error)`
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 13. Fix Webhook Routes Service Instantiation Errors









- [x] 13.1 Fix service instantiation with proper dependencies




  - Instantiate WaitlistRepository, ServiceRepository, and StaffRepository
  - Pass repository instances to WaitlistService constructor (line 211)
  - Instantiate SlotRepository and pass all required dependencies to SlotService (line 212)
  - Remove AuditService instantiation and use static methods instead (line 213)
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.1, 11.2, 11.3, 11.4_

- [x] 13.2 Replace AuditService instance methods with static calls




  - Replace auditService.logAction with AuditService.log on line 221
  - Replace auditService.logAction with AuditService.log on line 246
  - Use proper AuditLogEntry interface for parameters
  - Pass tenantId, actorType, action, resourceType, and metadata
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [x] 13.3 Remove non-existent SlotService methods




  - Remove confirmSlotBooking call (method doesn't exist) on line 218
  - Remove declineSlotBooking call (method doesn't exist) on line 243
  - Use SlotService.bookSlot for confirmations
  - Use SlotService.releaseHold and openSlot for declines
  - _Requirements: 7.1, 7.2, 7.3, 7.4_
-

- [x] 14. Final TypeScript Compilation Verification








  - Run TypeScript compiler with tsc --noEmit to verify all errors are resolved
  - Confirm error count reduced to 0
  - Verify no new type errors were introduced
  - Test build process with npm run build
  - _Requirements: 12.1, 12.2, 12.3, 12.4_
