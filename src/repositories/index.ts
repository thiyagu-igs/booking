import { BaseRepository } from './BaseRepository';
import { TenantRepository } from './TenantRepository';
import { UserRepository } from './UserRepository';
import { StaffRepository } from './StaffRepository';
import { ServiceRepository } from './ServiceRepository';
import { SlotRepository } from './SlotRepository';
import { WaitlistRepository } from './WaitlistRepository';
import { AnalyticsRepository } from './AnalyticsRepository';
import { CalendarEventRepository } from './CalendarEventRepository';
import { BookingRepository } from './BookingRepository';

export { 
  BaseRepository, 
  TenantRepository, 
  UserRepository,
  StaffRepository,
  ServiceRepository,
  SlotRepository,
  WaitlistRepository,
  AnalyticsRepository,
  CalendarEventRepository,
  BookingRepository
};

// Repository factory for creating tenant-scoped repositories
export class RepositoryFactory {
  constructor(private tenantId: string) {}

  getTenantRepository() {
    return new TenantRepository(this.tenantId);
  }

  getUserRepository() {
    return new UserRepository(this.tenantId);
  }

  getStaffRepository() {
    return new StaffRepository(this.tenantId);
  }

  getServiceRepository() {
    return new ServiceRepository(this.tenantId);
  }

  getSlotRepository() {
    return new SlotRepository(this.tenantId);
  }

  getWaitlistRepository() {
    return new WaitlistRepository(this.tenantId);
  }

  getAnalyticsRepository() {
    return new AnalyticsRepository(this.tenantId);
  }

  getCalendarEventRepository() {
    return new CalendarEventRepository(this.tenantId);
  }

  getBookingRepository() {
    return new BookingRepository(this.tenantId);
  }

  // Additional repositories will be added here as they are implemented
  // getNotificationRepository() { return new NotificationRepository(this.tenantId); }
  // getAuditLogRepository() { return new AuditLogRepository(this.tenantId); }
}