import { CalendarService } from '../../services/CalendarService';
import { CalendarEventRepository } from '../../repositories/CalendarEventRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { SlotRepository } from '../../repositories/SlotRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { google } from 'googleapis';

// Mock the googleapis module
jest.mock('googleapis');
const mockGoogle = google as jest.Mocked<typeof google>;

// Mock repositories
jest.mock('../../repositories/CalendarEventRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/ServiceRepository');

const MockCalendarEventRepository = CalendarEventRepository as jest.MockedClass<typeof CalendarEventRepository>;
const MockStaffRepository = StaffRepository as jest.MockedClass<typeof StaffRepository>;
const MockSlotRepository = SlotRepository as jest.MockedClass<typeof SlotRepository>;
const MockServiceRepository = ServiceRepository as jest.MockedClass<typeof ServiceRepository>;

describe('CalendarService', () => {
  let calendarService: CalendarService;
  let mockCalendarEventRepo: jest.Mocked<CalendarEventRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockSlotRepo: jest.Mocked<SlotRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockOAuth2Client: any;
  let mockCalendar: any;

  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    // Reset all mocks
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
    mockCalendarEventRepo = new MockCalendarEventRepository(tenantId) as jest.Mocked<CalendarEventRepository>;
    mockStaffRepo = new MockStaffRepository(tenantId) as jest.Mocked<StaffRepository>;
    mockSlotRepo = new MockSlotRepository(tenantId) as jest.Mocked<SlotRepository>;
    mockServiceRepo = new MockServiceRepository(tenantId) as jest.Mocked<ServiceRepository>;

    // Set up environment variables
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

    calendarService = new CalendarService(tenantId);
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth authorization URL with correct parameters', () => {
      const staffId = 'staff-123';
      const expectedUrl = 'https://accounts.google.com/oauth/authorize?...';
      
      mockOAuth2Client.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = calendarService.generateAuthUrl(staffId);

      expect(mockOAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events'
        ],
        state: staffId,
        prompt: 'consent'
      });
      expect(result).toBe(expectedUrl);
    });
  });

  describe('handleOAuthCallback', () => {
    const staffId = 'staff-123';
    const authCode = 'auth-code-123';

    it('should successfully handle OAuth callback and store tokens', async () => {
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

      const result = await calendarService.handleOAuthCallback(authCode, staffId);

      expect(mockOAuth2Client.getAccessToken).toHaveBeenCalledWith(authCode);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith(mockTokens);
      expect(mockCalendar.calendarList.list).toHaveBeenCalled();
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        google_calendar_id: 'primary-calendar-id',
        google_refresh_token: 'refresh-token',
        calendar_sync_enabled_at: expect.any(Date),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });
      expect(result.success).toBe(true);
    });

    it('should handle error when no refresh token is received', async () => {
      const mockTokens = {
        access_token: 'access-token',
        // No refresh_token
        scope: 'calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      };

      mockOAuth2Client.getAccessToken.mockResolvedValue({ tokens: mockTokens });
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.handleOAuthCallback(authCode, staffId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No refresh token received');
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: expect.stringContaining('No refresh token received')
      });
    });

    it('should handle error when primary calendar is not found', async () => {
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        scope: 'calendar',
        token_type: 'Bearer',
        expiry_date: Date.now() + 3600000
      };

      const mockCalendarList = {
        data: {
          items: [] // No calendars
        }
      };

      mockOAuth2Client.getAccessToken.mockResolvedValue({ tokens: mockTokens });
      mockCalendar.calendarList.list.mockResolvedValue(mockCalendarList);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.handleOAuthCallback(authCode, staffId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not find primary calendar');
    });
  });

  describe('createEventForSlot', () => {
    const eventData = {
      slotId: 'slot-123',
      staffId: 'staff-123',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      serviceName: 'Haircut',
      startTime: new Date('2024-01-15T10:00:00Z'),
      endTime: new Date('2024-01-15T11:00:00Z')
    };

    it('should successfully create calendar event', async () => {
      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id'
      };

      const mockEventResponse = {
        data: {
          id: 'google-event-id'
        }
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.insert.mockResolvedValue(mockEventResponse);
      mockCalendarEventRepo.create.mockResolvedValue({} as any);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.createEventForSlot(eventData);

      expect(mockStaffRepo.findById).toHaveBeenCalledWith(eventData.staffId);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'refresh-token'
      });
      expect(mockCalendar.events.insert).toHaveBeenCalledWith({
        calendarId: 'calendar-id',
        requestBody: {
          summary: 'Haircut - John Doe',
          description: 'Booking through waitlist system\nCustomer: John Doe\nEmail: john@example.com',
          start: {
            dateTime: eventData.startTime.toISOString(),
            timeZone: 'UTC'
          },
          end: {
            dateTime: eventData.endTime.toISOString(),
            timeZone: 'UTC'
          },
          attendees: [
            { email: 'john@example.com', displayName: 'John Doe' }
          ]
        }
      });
      expect(mockCalendarEventRepo.create).toHaveBeenCalledWith({
        slot_id: eventData.slotId,
        staff_id: eventData.staffId,
        google_event_id: 'google-event-id',
        google_calendar_id: 'calendar-id',
        status: 'created'
      });
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('google-event-id');
    });

    it('should handle case when staff has no calendar sync enabled', async () => {
      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: null,
        google_calendar_id: null
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      const result = await calendarService.createEventForSlot(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Calendar sync not enabled');
    });

    it('should handle Google Calendar API errors', async () => {
      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id'
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.insert.mockRejectedValue(new Error('API Error'));
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.createEventForSlot(eventData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(mockStaffRepo.update).toHaveBeenCalledWith(eventData.staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: 'API Error'
      });
    });
  });

  describe('deleteEventForSlot', () => {
    const slotId = 'slot-123';

    it('should successfully delete calendar event', async () => {
      const mockCalendarEvent = {
        id: 'calendar-event-id',
        staff_id: 'staff-123',
        google_event_id: 'google-event-id',
        google_calendar_id: 'calendar-id'
      };

      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: 'refresh-token'
      };

      mockCalendarEventRepo.findBySlotId.mockResolvedValue(mockCalendarEvent as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.events.delete.mockResolvedValue({});
      mockCalendarEventRepo.update.mockResolvedValue({} as any);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.deleteEventForSlot(slotId);

      expect(mockCalendarEventRepo.findBySlotId).toHaveBeenCalledWith(slotId);
      expect(mockStaffRepo.findById).toHaveBeenCalledWith('staff-123');
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'refresh-token'
      });
      expect(mockCalendar.events.delete).toHaveBeenCalledWith({
        calendarId: 'calendar-id',
        eventId: 'google-event-id'
      });
      expect(mockCalendarEventRepo.update).toHaveBeenCalledWith('calendar-event-id', {
        status: 'deleted'
      });
      expect(result.success).toBe(true);
      expect(result.eventId).toBe('google-event-id');
    });

    it('should handle case when no calendar event exists', async () => {
      mockCalendarEventRepo.findBySlotId.mockResolvedValue(null);

      const result = await calendarService.deleteEventForSlot(slotId);

      expect(result.success).toBe(true); // Not an error if no event exists
    });

    it('should handle case when staff has no refresh token', async () => {
      const mockCalendarEvent = {
        id: 'calendar-event-id',
        staff_id: 'staff-123',
        google_event_id: 'google-event-id',
        google_calendar_id: 'calendar-id'
      };

      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: null
      };

      mockCalendarEventRepo.findBySlotId.mockResolvedValue(mockCalendarEvent as any);
      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      const result = await calendarService.deleteEventForSlot(slotId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No refresh token available');
    });
  });

  describe('testCalendarConnection', () => {
    const staffId = 'staff-123';

    it('should successfully test calendar connection', async () => {
      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: 'refresh-token',
        google_calendar_id: 'calendar-id'
      };

      const mockCalendarResponse = {
        data: {
          id: 'calendar-id'
        }
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendar.calendars.get.mockResolvedValue(mockCalendarResponse);
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.testCalendarConnection(staffId);

      expect(mockStaffRepo.findById).toHaveBeenCalledWith(staffId);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: 'refresh-token'
      });
      expect(mockCalendar.calendars.get).toHaveBeenCalledWith({
        calendarId: 'calendar-id'
      });
      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        calendar_last_sync_at: expect.any(Date),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });
      expect(result.success).toBe(true);
    });

    it('should handle case when calendar sync is not configured', async () => {
      const mockStaff = {
        id: 'staff-123',
        google_refresh_token: null,
        google_calendar_id: null
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      const result = await calendarService.testCalendarConnection(staffId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Calendar sync not configured');
    });
  });

  describe('getCalendarSyncStatus', () => {
    it('should return calendar sync status for staff member', async () => {
      const staffId = 'staff-123';
      const mockStaff = {
        id: 'staff-123',
        calendar_sync_status: 'enabled',
        calendar_last_sync_at: new Date('2024-01-15T10:00:00Z'),
        calendar_sync_error: null
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);

      const result = await calendarService.getCalendarSyncStatus(staffId);

      expect(result).toEqual({
        enabled: true,
        status: 'enabled',
        lastSync: mockStaff.calendar_last_sync_at,
        error: null
      });
    });

    it('should handle case when staff member not found', async () => {
      const staffId = 'staff-123';
      mockStaffRepo.findById.mockResolvedValue(null);

      const result = await calendarService.getCalendarSyncStatus(staffId);

      expect(result).toEqual({
        enabled: false,
        status: 'disabled',
        lastSync: undefined,
        error: undefined
      });
    });
  });

  describe('disableCalendarSync', () => {
    it('should successfully disable calendar sync', async () => {
      const staffId = 'staff-123';
      mockStaffRepo.update.mockResolvedValue({} as any);

      const result = await calendarService.disableCalendarSync(staffId);

      expect(mockStaffRepo.update).toHaveBeenCalledWith(staffId, {
        google_calendar_id: null,
        google_refresh_token: null,
        calendar_sync_enabled_at: null,
        calendar_sync_status: 'disabled',
        calendar_sync_error: null
      });
      expect(result.success).toBe(true);
    });

    it('should handle database errors', async () => {
      const staffId = 'staff-123';
      mockStaffRepo.update.mockRejectedValue(new Error('Database error'));

      const result = await calendarService.disableCalendarSync(staffId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});