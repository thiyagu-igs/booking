import { CalendarService } from '../../services/CalendarService';
import { SlotService } from '../../services/SlotService';
import { CalendarEventRepository } from '../../repositories/CalendarEventRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { SlotRepository } from '../../repositories/SlotRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { WaitlistService } from '../../services/WaitlistService';
import { google } from 'googleapis';

// Mock googleapis
jest.mock('googleapis');
const mockGoogle = google as jest.Mocked<typeof google>;

// Mock repositories
jest.mock('../../repositories/CalendarEventRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../services/WaitlistService');

const MockCalendarEventRepository = CalendarEventRepository as jest.MockedClass<typeof CalendarEventRepository>;
const MockStaffRepository = StaffRepository as jest.MockedClass<typeof StaffRepository>;
const MockSlotRepository = SlotRepository as jest.MockedClass<typeof SlotRepository>;
const MockServiceRepository = ServiceRepository as jest.MockedClass<typeof ServiceRepository>;
const MockWaitlistRepository = WaitlistRepository as jest.MockedClass<typeof WaitlistRepository>;
const MockWaitlistService = WaitlistService as jest.MockedClass<typeof WaitlistService>;

describe('Calendar Integration Tests', () => {
  let calendarService: CalendarService;
  let slotService: SlotService;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockSlotRepo: jest.Mocked<SlotRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockCalendarEventRepo: jest.Mocked<CalendarEventRepository>;
  let mockWaitlistRepo: jest.Mocked<WaitlistRepository>;
  let mockWaitlistService: jest.Mocked<WaitlistService>;
  let mockOAuth2Client: any;
  let mockCalendar: any;

  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock OAuth2Client
    mockOAuth2Client = {
      generateAuthUrl: jest.fn(),
      getAccessToken: jest.fn(),
      setCredentials: jest.fn()
    };

    // Mock Calendar API
    mockCalendar = {
      calendarList: {
        list: jest.fn()
      },
      calendars: {
        get: jest.fn()
      },
      events: {
        insert: jest.fn(),
        delete: jest.fn()
      }
    };

    // Mock google.auth.OAuth2 constructor
    mockGoogle.auth = {
      OAuth2: jest.fn().mockImplementation(() => mockOAuth2Client)
    } as any;

    // Mock google.calendar
    mockGoogle.calendar = jest.fn().mockReturnValue(mockCalendar);

    // Mock repository instances
    mockStaffRepo = new MockStaffRepository(tenantId) as jest.Mocked<StaffRepository>;
    mockSlotRepo = new MockSlotRepository(tenantId) as jest.Mocked<SlotRepository>;
    mockServiceRepo = new MockServiceRepository(tenantId) as jest.Mocked<ServiceRepository>;
    mockCalendarEventRepo = new MockCalendarEventRepository(tenantId) as jest.Mocked<CalendarEventRepository>;
    mockWaitlistRepo = new MockWaitlistRepository(tenantId) as jest.Mocked<WaitlistRepository>;
    mockWaitlistService = new MockWaitlistService(
      mockWaitlistRepo,
      mockServiceRepo,
      mockStaffRepo
    ) as jest.Mocked<WaitlistService>;

    // Set up environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

    calendarService = new CalendarService(tenantId);
    slotService = new SlotService(
      mockSlotRepo,
      mockWaitlistRepo,
      mockServiceRepo,
      mockStaffRepo,
      mockWaitlistService,
      tenantId
    );
  });

  describe('Complete OAuth Flow', () => {
    it('should complete OAuth flow and enable calendar sync', async () => {
      const staffId = 'staff-123';
      const authCode = 'auth-code-123';

      // Step 1: Generate auth URL
      const expectedAuthUrl = 'https://accounts.google.com/oauth/authorize?...';
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedAuthUrl);

      const authUrl = calendarService.generateAuthUrl(staffId);
      expect(authUrl).toBe(expectedAuthUrl);

      // Step 2: Handle OAuth callback
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        scope: 'calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      };

      const mockCalendarList = {
        data: {
          items: [
            { id: 'primary-calendar-id', primary: true }
          ]
        }
      };

      mockOAuth2Client.getAccessToken.mockResolvedValue({ tokens: mockTokens });
      mockCalendar.calendarList.list.mockResolvedValue(mockCalendarList);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const callbackResult = await calendarService.handleOAuthCallback(authCode, staffId);

      expect(callbackResult.success).toBe(true);
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        google_calendar_id: 'primary-calendar-id',
        google_refresh_token: 'refresh-token',
        calendar_sync_enabled_at: expect.any(Date),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });

      // Step 3: Verify sync status
      const mockStaff = {
        id: staffId,
        calendar_sync_status: 'enabled',
        calendar_last_sync_at: new Date(),
        calendar_sync_error: null
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      const status = await calendarService.getCalendarSyncStatus(staffId);
      expect(status.enabled).toBe(true);
      expect(status.status).toBe('enabled');
    });
  });

  describe('Slot Booking with Calendar Integration', () => {
    it('should create calendar event when booking slot through waitlist', async () => {
      const slotId = 'slot-123';
      const staffId = 'staff-123';
      const serviceId = 'service-123';
      const customerName = 'John Doe';
      const customerEmail = 'john@example.com';

      // Mock slot data
      const mockSlot = {
        id: slotId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        status: 'open'
      };

      // Mock service data
      const mockService = {
        id: serviceId,
        name: 'Haircut',
        duration_minutes: 60,
        price: 50
      };

      // Mock staff with calendar sync enabled
      const mockStaff = {
        id: staffId,
        name: 'Jane Smith',
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id',
        calendar_sync_status: 'enabled'
      };

      // Mock Google Calendar API response
      const mockEventResponse = {
        data: {
          id: 'google-event-id'
        }
      };

      // Set up mocks
      mockSlotRepo.findById.mockResolvedValue(mockSlot as any);
      mockSlotRepo.bookSlot.mockResolvedValue({ ...mockSlot, status: 'booked' } as any);
      mockServiceRepo.findById.mockResolvedValue(mockService as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.insert.mockResolvedValue(mockEventResponse);
      mockCalendarEventRepo.create.mockResolvedValue({} as any);
      mockStaffRepo.update.mockResolvedValue({} as any);

      // Book slot with customer information
      const bookedSlot = await slotService.bookSlotWithCustomer(
        slotId,
        customerName,
        customerEmail
      );

      // Verify slot was booked
      expect(bookedSlot).toBeTruthy();
      expect(bookedSlot?.status).toBe('booked');

      // Verify calendar event was created
      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'calendar-id',
        requestBody: {
          summary: 'Haircut - John Doe',
          description: 'Booking through waitlist system\nCustomer: John Doe\nEmail: john@example.com',
          start: {
            dateTime: mockSlot.start_time.toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: mockSlot.end_time.toISOString(),
            timeZone: 'UTC'
          },
          attendees: [
            { email: customerEmail, displayName: customerName }
          ]
        }
      });

      // Verify calendar event record was created
      expect(mockCalendarEventRepo.create).toHaveBeenCalledWith({
        slot_id: slotId,
        staff_id: staffId,
        google_event_id: 'google-event-id',
        google_calendar_id: 'calendar-id',
        status: 'created'
      });
    });

    it('should handle calendar sync failure gracefully during booking', async () => {
      const slotId = 'slot-123';
      const staffId = 'staff-123';
      const serviceId = 'service-123';
      const customerName = 'John Doe';

      // Mock slot data
      const mockSlot = {
        id: slotId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        status: 'open'
      };

      // Mock service data
      const mockService = {
        id: serviceId,
        name: 'Haircut',
        duration_minutes: 60,
        price: 50
      };

      // Mock staff with calendar sync enabled but API fails
      const mockStaff = {
        id: staffId,
        name: 'Jane Smith',
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id',
        calendar_sync_status: 'enabled'
      };

      // Set up mocks
      mockSlotRepo.findById.mockResolvedValue(mockSlot as any);
      mockSlotRepo.bookSlot.mockResolvedValue({ ...mockSlot, status: 'booked' } as any);
      mockServiceRepo.findById.mockResolvedValue(mockService as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.insert.mockRejectedValue(new Error('Google API Error'));
      mockStaffRepo.update.mockResolvedValue({} as any);

      // Book slot with customer information
      const bookedSlot = await slotService.bookSlotWithCustomer(
        slotId,
        customerName
      );

      // Verify slot was still booked despite calendar error
      expect(bookedSlot).toBeTruthy();
      expect(bookedSlot?.status).toBe('booked');

      // Verify staff sync status was updated to error
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: 'Google API Error'
      });
    });
  });

  describe('Slot Cancellation with Calendar Integration', () => {
    it('should delete calendar event when canceling slot', async () => {
      const slotId = 'slot-123';
      const staffId = 'staff-123';

      // Mock slot data
      const mockSlot = {
        id: slotId,
        staff_id: staffId,
        status: 'booked'
      };

      // Mock calendar event data
      const mockCalendarEvent = {
        id: 'calendar-event-id',
        staff_id: staffId,
        google_event_id: 'google-event-id',
        google_calendar_id: 'calendar-id'
      };

      // Mock staff with calendar sync enabled
      const mockStaff = {
        id: staffId,
        google_refresh_token: 'refresh-token'
      };

      // Set up mocks
      mockSlotRepo.findById.mockResolvedValue(mockSlot as any);
      mockSlotRepo.cancelSlot.mockResolvedValue({ ...mockSlot, status: 'canceled' } as any);
      mockCalendarEventRepo.findBySlotId.mockResolvedValue(mockCalendarEvent as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.delete.mockResolvedValue({});
      mockCalendarEventRepo.update.mockResolvedValue({} as any);
      mockStaffRepo.update.mockResolvedValue({} as any);

      // Cancel slot
      const canceledSlot = await slotService.cancelSlot(slotId);

      // Verify slot was canceled
      expect(canceledSlot).toBeTruthy();
      expect(canceledSlot?.status).toBe('canceled');

      // Verify calendar event was deleted
      expect(mockCalendar.events.delete).toHaveBeenCalledWith({
        calendarId: 'calendar-id',
        eventId: 'google-event-id'
      });

      // Verify calendar event record was updated
      expect(mockCalendarEventRepo.update).toHaveBeenCalledWith('calendar-event-id', {
        status: 'deleted'
      });
    });

    it('should handle case when no calendar event exists for canceled slot', async () => {
      const slotId = 'slot-123';

      // Mock slot data
      const mockSlot = {
        id: slotId,
        status: 'booked'
      };

      // Set up mocks
      mockSlotRepo.findById.mockResolvedValue(mockSlot as any);
      mockSlotRepo.cancelSlot.mockResolvedValue({ ...mockSlot, status: 'canceled' } as any);
      mockCalendarEventRepo.findBySlotId.mockResolvedValue(null);

      // Cancel slot
      const canceledSlot = await slotService.cancelSlot(slotId);

      // Verify slot was still canceled
      expect(canceledSlot).toBeTruthy();
      expect(canceledSlot?.status).toBe('canceled');

      // Verify no calendar API calls were made
      expect(mockCalendar.events.delete).not.toHaveBeenCalled();
    });
  });

  describe('Calendar Sync Monitoring and Error Reporting', () => {
    it('should track calendar sync statistics', async () => {
      const mockStats = {
        total: 15,
        created: 10,
        updated: 3,
        deleted: 2,
        errors: 0
      };

      mockCalendarEventRepo.getSyncStats.mockResolvedValue(mockStats);

      // Access the private property for testing
      const stats = await calendarService['calendarEventRepo'].getSyncStats();

      expect(stats).toEqual(mockStats);
      expect(mockCalendarEventRepo.getSyncStats).toHaveBeenCalled();
    });

    it('should cleanup orphaned calendar events', async () => {
      const orphanedEvents = [
        {
          id: 'event-1',
          slot_id: 'deleted-slot-1',
          google_event_id: 'google-event-1'
        },
        {
          id: 'event-2',
          slot_id: 'deleted-slot-2',
          google_event_id: 'google-event-2'
        }
      ];

      mockCalendarEventRepo.findOrphanedEvents.mockResolvedValue(orphanedEvents as any);
      mockCalendarEventRepo.cleanupOrphanedEvents.mockResolvedValue(2);

      const cleanedUp = await calendarService['calendarEventRepo'].cleanupOrphanedEvents();

      expect(cleanedUp).toBe(2);
      expect(mockCalendarEventRepo.cleanupOrphanedEvents).toHaveBeenCalled();
    });

    it('should test calendar connection and update sync status', async () => {
      const staffId = 'staff-123';

      // Mock staff with calendar sync enabled
      const mockStaff = {
        id: staffId,
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id'
      };

      // Mock successful calendar access
      const mockCalendarResponse = {
        data: {
          id: 'calendar-id'
        }
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.calendars.get.mockResolvedValue(mockCalendarResponse);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.testCalendarConnection(staffId);

      expect(result.success).toBe(true);
      expect(mockCalendar.calendars.get).toHaveBeenCalledWith({
        calendarId: 'calendar-id'
      });
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        calendar_last_sync_at: expect.any(Date),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });
    });

    it('should handle calendar connection test failure', async () => {
      const staffId = 'staff-123';

      // Mock staff with calendar sync enabled
      const mockStaff = {
        id: staffId,
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id'
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.calendars.get.mockRejectedValue(new Error('Access denied'));
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.testCalendarConnection(staffId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Access denied');
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: 'Access denied'
      });
    });
  });

  describe('Fallback Mechanism', () => {
    it('should continue with internal slot management when calendar sync fails', async () => {
      const slotId = 'slot-123';
      const staffId = 'staff-123';
      const serviceId = 'service-123';
      const customerName = 'John Doe';

      // Mock slot data
      const mockSlot = {
        id: slotId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        status: 'open'
      };

      // Mock service data
      const mockService = {
        id: serviceId,
        name: 'Haircut'
      };

      // Mock staff with no calendar sync
      const mockStaff = {
        id: staffId,
        google_refresh_token: null,
        google_calendar_id: null,
        calendar_sync_status: 'disabled'
      };

      // Set up mocks
      mockSlotRepo.findById.mockResolvedValue(mockSlot as any);
      mockSlotRepo.bookSlot.mockResolvedValue({ ...mockSlot, status: 'booked' } as any);
      mockServiceRepo.findById.mockResolvedValue(mockService as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      // Book slot with customer information
      const bookedSlot = await slotService.bookSlotWithCustomer(
        slotId,
        customerName
      );

      // Verify slot was booked despite no calendar sync
      expect(bookedSlot).toBeTruthy();
      expect(bookedSlot?.status).toBe('booked');

      // Verify no calendar API calls were made
      expect(mockCalendar.events.insert).not.toHaveBeenCalled();
    });
  });
});