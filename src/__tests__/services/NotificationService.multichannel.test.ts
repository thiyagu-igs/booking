import { NotificationService } from '../../services/NotificationService';
import { NotificationType, NotificationStatus } from '../../models';
import { redisClient } from '../../config/redis';
import sgMail from '@sendgrid/mail';
import { Twilio } from 'twilio';

// Mock dependencies
jest.mock('@sendgrid/mail');
jest.mock('twilio');
jest.mock('../../config/redis', () => ({
  redisClient: {
    get: jest.fn(),
    ttl: jest.fn(),
    multi: jest.fn(() => ({
      incr: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn()
    }))
  }
}));

const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;

// Mock Twilio
const mockTwilioMessages = {
  create: jest.fn()
};

const mockTwilioClient = {
  messages: mockTwilioMessages
} as any;

(Twilio as jest.MockedClass<typeof Twilio>).mockImplementation(() => mockTwilioClient);

describe('NotificationService Multi-Channel', () => {
  let notificationService: NotificationService;
  let mockDb: any;
  const tenantId = 'tenant-123';

  const mockEntry = {
    id: 'entry-123',
    tenant_id: tenantId,
    customer_name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    service_id: 'service-123',
    staff_id: 'staff-123',
    earliest_time: new Date('2024-01-15T10:00:00Z'),
    latest_time: new Date('2024-01-15T18:00:00Z'),
    priority_score: 75,
    vip_status: false,
    status: 'active' as const,
    notification_channels: ['email', 'sms', 'whatsapp'] as NotificationType[],
    preferred_channel: 'sms' as NotificationType,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockSlot = {
    id: 'slot-123',
    tenant_id: tenantId,
    staff_id: 'staff-123',
    service_id: 'service-123',
    start_time: new Date('2024-01-15T14:00:00Z'),
    end_time: new Date('2024-01-15T15:00:00Z'),
    status: 'held' as const,
    hold_expires_at: new Date(Date.now() + 10 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockService = {
    id: 'service-123',
    tenant_id: tenantId,
    name: 'Haircut',
    duration_minutes: 60,
    price: 50,
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockStaff = {
    id: 'staff-123',
    tenant_id: tenantId,
    name: 'Sarah Johnson',
    role: 'Stylist',
    active: true,
    google_calendar_id: undefined,
    google_refresh_token: undefined,
    calendar_sync_enabled_at: undefined,
    calendar_last_sync_at: undefined,
    calendar_sync_status: 'disabled' as const,
    calendar_sync_error: undefined,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      insert: jest.fn().mockResolvedValue([1]),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      'whatsapp_templates': jest.fn().mockReturnThis()
    };

    // Set up environment variables
    process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.TWILIO_WHATSAPP_NUMBER = '+1234567890';
    process.env.BASE_URL = 'http://localhost:3000';

    notificationService = new NotificationService(mockDb, tenantId);
  });

  describe('sendNotification', () => {
    it('should try preferred channel first and succeed', async () => {
      // Mock rate limit check
      mockRedisClient.get.mockResolvedValue('0');
      mockRedisClient.ttl.mockResolvedValue(3600);

      // Mock SMS success
      mockTwilioMessages.create.mockResolvedValue({
        sid: 'SMS123456789',
        status: 'sent'
      });

      const result = await notificationService.sendNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SMS123456789');
      expect(mockTwilioMessages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('Test Business: Slot Available!'),
        from: '+1234567890',
        to: '+1234567890'
      });
    });

    it('should fallback to next channel when preferred fails', async () => {
      // Mock rate limit check
      mockRedisClient.get.mockResolvedValue('0');
      mockRedisClient.ttl.mockResolvedValue(3600);

      // Mock SMS failure
      mockTwilioMessages.create.mockRejectedValueOnce(new Error('SMS failed'));

      // Mock email success
      mockSgMail.send.mockResolvedValue([
        {
          statusCode: 202,
          body: {},
          headers: { 'x-message-id': 'EMAIL123456789' }
        },
        {}
      ]);

      const result = await notificationService.sendNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('EMAIL123456789');
      expect(mockTwilioMessages.create).toHaveBeenCalled(); // SMS tried first
      expect(mockSgMail.send).toHaveBeenCalled(); // Email used as fallback
    });

    it('should try all channels and fail if all fail', async () => {
      // Mock rate limit check
      mockRedisClient.get.mockResolvedValue('0');
      mockRedisClient.ttl.mockResolvedValue(3600);

      // Mock all channels failing
      mockTwilioMessages.create.mockRejectedValue(new Error('SMS failed'));
      mockSgMail.send.mockRejectedValue(new Error('Email failed'));

      const result = await notificationService.sendNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('All notification channels failed');
    });
  });

  describe('sendSMSNotification', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue('0');
      mockRedisClient.ttl.mockResolvedValue(3600);
    });

    it('should send SMS notification successfully', async () => {
      mockTwilioMessages.create.mockResolvedValue({
        sid: 'SMS123456789',
        status: 'sent'
      });

      const result = await notificationService.sendSMSNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SMS123456789');
      expect(mockTwilioMessages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('🎉 Test Business: Slot Available!'),
        from: '+1234567890',
        to: '+1234567890'
      });
    });

    it('should handle SMS sending failure', async () => {
      mockTwilioMessages.create.mockRejectedValue(new Error('Twilio API error'));

      const result = await notificationService.sendSMSNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio API error');
    });

    it('should fail when Twilio client not configured', async () => {
      // Create service without Twilio configuration
      delete process.env.TWILIO_ACCOUNT_SID;
      const serviceWithoutTwilio = new NotificationService(mockDb, tenantId);

      const result = await serviceWithoutTwilio.sendSMSNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Twilio client not configured');
    });

    it('should respect rate limits', async () => {
      mockRedisClient.get.mockResolvedValue('25'); // At rate limit
      mockRedisClient.ttl.mockResolvedValue(1800);

      const result = await notificationService.sendSMSNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });
  });

  describe('sendWhatsAppNotification', () => {
    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue('0');
      mockRedisClient.ttl.mockResolvedValue(3600);
      
      // Mock approved WhatsApp template
      mockDb.first.mockResolvedValue({
        id: 'template-123',
        template_name: 'waitlist_slot_available',
        template_language: 'en',
        status: 'approved',
        active: true
      });
    });

    it('should send WhatsApp notification successfully', async () => {
      mockTwilioMessages.create.mockResolvedValue({
        sid: 'WA123456789',
        status: 'sent'
      });

      const result = await notificationService.sendWhatsAppNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('WA123456789');
      expect(mockTwilioMessages.create).toHaveBeenCalledWith({
        from: 'whatsapp:+1234567890',
        to: 'whatsapp:+1234567890',
        contentSid: 'waitlist_slot_available',
        contentVariables: expect.any(String)
      });
    });

    it('should fail when no approved template exists', async () => {
      mockDb.first.mockResolvedValue(null);

      const result = await notificationService.sendWhatsAppNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('No approved WhatsApp template found');
    });

    it('should handle WhatsApp sending failure', async () => {
      mockTwilioMessages.create.mockRejectedValue(new Error('WhatsApp API error'));

      const result = await notificationService.sendWhatsAppNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('WhatsApp API error');
    });
  });

  describe('getNotificationChannels', () => {
    it('should return preferred channel first', async () => {
      const entryWithPreference = {
        ...mockEntry,
        preferred_channel: 'whatsapp' as NotificationType,
        notification_channels: ['email', 'sms', 'whatsapp'] as NotificationType[]
      };

      // Access private method through any cast for testing
      const channels = (notificationService as any).getNotificationChannels(entryWithPreference);

      expect(channels[0]).toBe('whatsapp');
      expect(channels).toContain('email');
      expect(channels).toContain('sms');
    });

    it('should fallback to available contact methods when no preferences set', async () => {
      const entryWithoutPreferences = {
        ...mockEntry,
        notification_channels: undefined,
        preferred_channel: undefined
      };

      const channels = (notificationService as any).getNotificationChannels(entryWithoutPreferences);

      expect(channels).toContain('email'); // Has email
      expect(channels).toContain('sms'); // Has phone
      expect(channels).toContain('whatsapp'); // Has phone
    });

    it('should filter out channels without proper configuration', async () => {
      const entryEmailOnly = {
        ...mockEntry,
        phone: undefined,
        notification_channels: ['email', 'sms', 'whatsapp'] as NotificationType[]
      };

      const channels = (notificationService as any).getNotificationChannels(entryEmailOnly);

      expect(channels).toContain('email');
      expect(channels).not.toContain('sms');
      expect(channels).not.toContain('whatsapp');
    });
  });

  describe('generateSMSTemplate', () => {
    it('should generate proper SMS template', async () => {
      const notificationData = {
        customerName: 'John Doe',
        serviceName: 'Haircut',
        staffName: 'Sarah Johnson',
        slotTime: 'Monday, January 15, 2024 at 2:00 PM - 3:00 PM PST',
        confirmUrl: 'http://localhost:3000/api/confirm/token123',
        declineUrl: 'http://localhost:3000/api/decline/token456',
        businessName: 'Test Business'
      };

      const template = (notificationService as any).generateSMSTemplate(notificationData);

      expect(template.message).toContain('🎉 Test Business: Slot Available!');
      expect(template.message).toContain('Hi John Doe');
      expect(template.message).toContain('Haircut with Sarah Johnson');
      expect(template.message).toContain('Reply "YES"');
      expect(template.message).toContain('Reply "NO"');
      expect(template.message).toContain('10 min hold');
    });
  });
});