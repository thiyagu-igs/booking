export { AuthService } from './AuthService';
export type { LoginCredentials, RegisterData, TokenPayload, AuthResult } from './AuthService';

export { WaitlistService } from './WaitlistService';
export type { 
  CreateWaitlistEntryData, 
  WaitlistFilters, 
  PaginationOptions, 
  PriorityWeights, 
  WaitlistStats 
} from './WaitlistService';

export { OTPService } from './OTPService';
export type { OTPData, OTPVerificationResult } from './OTPService';

export { SlotService } from './SlotService';
export type { 
  CreateSlotData, 
  SlotFilters, 
  SlotCandidate, 
  SlotMatchResult 
} from './SlotService';

export { NotificationService } from './NotificationService';
export type { 
  EmailTemplate, 
  NotificationData, 
  SendNotificationResult, 
  ConfirmationToken, 
  RateLimitResult 
} from './NotificationService';

export { AnalyticsService } from './AnalyticsService';
export type { AnalyticsExportData } from './AnalyticsService';

export { CalendarService } from './CalendarService';
export type { 
  CalendarEventData, 
  CalendarSyncResult, 
  OAuthTokens 
} from './CalendarService';