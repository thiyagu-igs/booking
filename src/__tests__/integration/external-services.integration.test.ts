import { NotificationService } from '../../services/NotificationService';
import { CalendarService } from '../../services/CalendarService';
import { setupTestDatabase, cleanupTestDatabase, createTestTenant } from '../helpers/database';
import { mockSendGridResponse, mockGoogleCalendarEvent } from '../helpers/fixtures';

// Mock external services
jest.mock('@sendgrid/mail');
jest.mock('googleapis');

describe('External Services Integration Tests', () => {
  let tenantId: string;
  let notificationService: NotificationService;
  let calendarService: CalendarService;

  beforeAll(async () => {
    await setupTestDatabase();
    const tenant = await createTestTenant();
    tenantId = tenant.id;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(() => {
    notificationService = new NotificationService(tenantId);
    calendarService = new CalendarService(tenantId);
    jest.clearAllMocks();
  });

  describe('SendGrid Email Integration', () => {
    it('should send email notifications successfully', async () => {
      const sendGridMock = require('@sendgrid/mail');
      sendGridMock.send.mockResolvedValue([mockSendGridResponse]);

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        service: { name: 'Haircut' },
        staff: { name: 'Jane Stylist' }
      };

      const result = await notificationService.sendSlotNotification(waitlistEntry, slot);

      expect(result.success).toBe(true);
      expect(sendGridMock.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          from: expect.any(String),
          subject: expect.stringContaining('Slot Available'),
          html: expect.stringContaining('John Doe')
        })
      );
    });

    it('should handle SendGrid API failures gracefully', async () => {
      const sendGridMock = require('@sendgrid/mail');
      sendGridMock.send.mockRejectedValue(new Error('SendGrid API Error'));

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        service: { name: 'Haircut' },
        staff: { name: 'Jane Stylist' }
      };

      const result = await notificationService.sendSlotNotification(waitlistEntry, slot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid API Error');
    });

    it('should retry failed email sends with exponential backoff', async () => {
      const sendGridMock = require('@sendgrid/mail');
      
      // Fail first two attempts, succeed on third
      sendGridMock.send
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce([mockSendGridResponse]);

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        service: { name: 'Haircut' },
        staff: { name: 'Jane Stylist' }
      };

      const result = await notificationService.sendSlotNotificationWithRetry(waitlistEntry, slot);

      expect(result.success).toBe(true);
      expect(sendGridMock.send).toHaveBeenCalledTimes(3);
    });

    it('should respect rate limiting for email notifications', async () => {
      const sendGridMock = require('@sendgrid/mail');
      sendGridMock.send.mockResolvedValue([mockSendGridResponse]);

      // Mock Redis rate limiting
      const mockRedis = {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
        get: jest.fn().mockResolvedValue('25') // At rate limit
      };

      notificationService.setRedisClient(mockRedis);

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        service: { name: 'Haircut' },
        staff: { name: 'Jane Stylist' }
      };

      const result = await notificationService.sendSlotNotification(waitlistEntry, slot);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(sendGridMock.send).not.toHaveBeenCalled();
    });

    it('should validate email templates and personalization', async () => {
      const sendGridMock = require('@sendgrid/mail');
      sendGridMock.send.mockResolvedValue([mockSendGridResponse]);

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z'),
        service: { name: 'Haircut', price: 50.00 },
        staff: { name: 'Jane Stylist' }
      };

      await notificationService.sendSlotNotification(waitlistEntry, slot);

      const sentEmail = sendGridMock.send.mock.calls[0][0];
      
      expect(sentEmail.html).toContain('John Doe'); // Customer name
      expect(sentEmail.html).toContain('Haircut'); // Service name
      expect(sentEmail.html).toContain('Jane Stylist'); // Staff name
      expect(sentEmail.html).toContain('January 15'); // Formatted date
      expect(sentEmail.html).toContain('2:00 PM'); // Formatted time
      expect(sentEmail.html).toContain('$50.00'); // Price
      expect(sentEmail.html).toContain('/api/confirm/'); // Confirm link
      expect(sentEmail.html).toContain('/api/decline/'); // Decline link
    });
  });

  describe('Google Calendar Integration', () => {
    it('should create calendar events successfully', async () => {
      const googleApisMock = require('googleapis');
      const calendarMock = {
        events: {
          insert: jest.fn().mockResolvedValue({ data: mockGoogleCalendarEvent })
        }
      };
      googleApisMock.google.calendar.mockReturnValue(calendarMock);

      const booking = {
        id: 'test-booking-id',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        service: { name: 'Haircut', duration_minutes: 60 },
        staff: { name: 'Jane Stylist', calendar_id: 'staff-calendar-id' },
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z')
      };

      const result = await calendarService.createEvent(booking);

      expect(result.success).toBe(true);
      expect(result.eventId).toBe('test-event-id');
      expect(calendarMock.events.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarId: 'staff-calendar-id',
          resource: expect.objectContaining({
            summary: 'Haircut - John Doe',
            start: { dateTime: '2024-01-15T14:00:00.000Z' },
            end: { dateTime: '2024-01-15T15:00:00.000Z' },
            attendees: [{ email: 'john@example.com' }]
          })
        })
      );
    });

    it('should handle calendar API failures gracefully', async () => {
      const googleApisMock = require('googleapis');
      const calendarMock = {
        events: {
          insert: jest.fn().mockRejectedValue(new Error('Calendar API Error'))
        }
      };
      googleApisMock.google.calendar.mockReturnValue(calendarMock);

      const booking = {
        id: 'test-booking-id',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        service: { name: 'Haircut', duration_minutes: 60 },
        staff: { name: 'Jane Stylist', calendar_id: 'staff-calendar-id' },
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z')
      };

      const result = await calendarService.createEvent(booking);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Calendar API Error');
    });

    it('should delete calendar events when bookings are cancelled', async () => {
      const googleApisMock = require('googleapis');
      const calendarMock = {
        events: {
          delete: jest.fn().mockResolvedValue({ status: 204 })
        }
      };
      googleApisMock.google.calendar.mockReturnValue(calendarMock);

      const result = await calendarService.deleteEvent('staff-calendar-id', 'test-event-id');

      expect(result.success).toBe(true);
      expect(calendarMock.events.delete).toHaveBeenCalledWith({
        calendarId: 'staff-calendar-id',
        eventId: 'test-event-id'
      });
    });

    it('should handle OAuth token refresh', async () => {
      const googleApisMock = require('googleapis');
      const authMock = {
        refreshAccessToken: jest.fn().mockResolvedValue({
          credentials: {
            access_token: 'new-access-token',
            refresh_token: 'refresh-token'
          }
        })
      };
      
      googleApisMock.google.auth.OAuth2.mockReturnValue(authMock);

      const result = await calendarService.refreshOAuthToken('expired-token', 'refresh-token');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('new-access-token');
      expect(authMock.refreshAccessToken).toHaveBeenCalled();
    });

    it('should fall back to internal slot management when calendar sync fails', async () => {
      const googleApisMock = require('googleapis');
      const calendarMock = {
        events: {
          insert: jest.fn().mockRejectedValue(new Error('Calendar unavailable'))
        }
      };
      googleApisMock.google.calendar.mockReturnValue(calendarMock);

      const booking = {
        id: 'test-booking-id',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        service: { name: 'Haircut', duration_minutes: 60 },
        staff: { name: 'Jane Stylist', calendar_id: 'staff-calendar-id' },
        start_time: new Date('2024-01-15T14:00:00Z'),
        end_time: new Date('2024-01-15T15:00:00Z')
      };

      // This should not throw an error, but continue with internal booking
      const result = await calendarService.createEventWithFallback(booking);

      expect(result.success).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.internalBookingId).toBeTruthy();
    });
  });

  describe('Service Health Monitoring', () => {
    it('should monitor SendGrid service health', async () => {
      const sendGridMock = require('@sendgrid/mail');
      sendGridMock.send.mockResolvedValue([mockSendGridResponse]);

      const healthCheck = await notificationService.checkServiceHealth();

      expect(healthCheck.sendgrid.status).toBe('healthy');
      expect(healthCheck.sendgrid.responseTime).toBeGreaterThan(0);
    });

    it('should monitor Google Calendar service health', async () => {
      const googleApisMock = require('googleapis');
      const calendarMock = {
        calendarList: {
          list: jest.fn().mockResolvedValue({ data: { items: [] } })
        }
      };
      googleApisMock.google.calendar.mockReturnValue(calendarMock);

      const healthCheck = await calendarService.checkServiceHealth();

      expect(healthCheck.googleCalendar.status).toBe('healthy');
      expect(healthCheck.googleCalendar.responseTime).toBeGreaterThan(0);
    });

    it('should detect service degradation', async () => {
      const sendGridMock = require('@sendgrid/mail');
      
      // Simulate slow responses
      sendGridMock.send.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([mockSendGridResponse]), 5000))
      );

      const healthCheck = await notificationService.checkServiceHealth();

      expect(healthCheck.sendgrid.status).toBe('degraded');
      expect(healthCheck.sendgrid.responseTime).toBeGreaterThan(3000);
    });
  });

  describe('Error Recovery and Circuit Breaker', () => {
    it('should implement circuit breaker for external services', async () => {
      const sendGridMock = require('@sendgrid/mail');
      
      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 5; i++) {
        sendGridMock.send.mockRejectedValueOnce(new Error('Service unavailable'));
      }

      const waitlistEntry = {
        id: 'test-entry-id',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'test-service-id'
      };

      const slot = {
        id: 'test-slot-id',
        start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
        service: { name: 'Haircut' },
        staff: { name: 'Jane Stylist' }
      };

      // First few calls should fail and increment failure count
      for (let i = 0; i < 5; i++) {
        const result = await notificationService.sendSlotNotification(waitlistEntry, slot);
        expect(result.success).toBe(false);
      }

      // Circuit breaker should now be open
      const circuitBreakerResult = await notificationService.sendSlotNotification(waitlistEntry, slot);
      expect(circuitBreakerResult.success).toBe(false);
      expect(circuitBreakerResult.error).toContain('Circuit breaker open');
    });
  });
});