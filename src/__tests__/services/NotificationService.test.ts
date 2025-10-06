import { NotificationService } from '../../services/NotificationService';
import { redisClient } from '../../config/redis';
import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import { 
  WaitlistEntry, 
  Slot, 
  Service, 
  Staff, 
  NotificationStatus, 
  NotificationType,
  WaitlistStatus,
  SlotStatus
} from '../../models';

// Mock dependencies
jest.mock('@sendgrid/mail');
jest.mock('../../config/redis');
jest.mock('jsonwebtoken');

const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;
const mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDb: any;
  const tenantId = 'tenant-123';

  // Mock data
  const mockEntry: WaitlistEntry = {
    id: 'entry-123',
    tenant_id: tenantId,
    customer_name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    service_id: 'service-123',
    staff_id: 'staff-123',
    earliest_time: new Date('2024-01-15T09:00:00Z'),
    latest_time: new Date('2024-01-15T17:00:00Z'),
    priority_score: 75,
    vip_status: false,
    status: WaitlistStatus.ACTIVE,
    created_at: new Date('2024-01-10T10:00:00Z')
  };

  const mockSlot: Slot = {
    id: 'slot-123',
    tenant_id: tenantId,
    staff_id: 'staff-123',
    service_id: 'service-123',
    start_time: new Date('2024-01-15T14:00:00Z'),
    end_time: new Date('2024-01-15T15:00:00Z'),
    status: SlotStatus.HELD,
    hold_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    created_at: new Date('2024-01-15T13:50:00Z')
  };

  const mockService: Service = {
    id: 'service-123',
    tenant_id: tenantId,
    name: 'Hair Cut',
    duration_minutes: 60,
    price: 50,
    active: true,
    created_at: new Date('2024-01-01T00:00:00Z')
  };

  const mockStaff: Staff = {
    id: 'staff-123',
    tenant_id: tenantId,
    name: 'Jane Smith',
    role: 'Stylist',
    active: true,
    created_at: new Date('2024-01-01T00:00:00Z')
  };

  beforeEach(() => {
    // Mock database
    mockDb = jest.fn();
    const mockQueryBuilder = {
      insert: jest.fn().mockResolvedValue([1]),
      where: jest.fn().mockReturnThis(),
      whereBetween: jest.fn().mockReturnThis(),
      first: jest.fn(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1)
    };
    
    mockDb.mockReturnValue(mockQueryBuilder);
    mockDb.raw = jest.fn();

    // Set environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.JWT_SECRET = 'test-secret';
    process.env.FROM_EMAIL = 'test@example.com';
    process.env.BASE_URL = 'http://localhost:3000';
    process.env.NOTIFICATION_RATE_LIMIT = '25';
    process.env.CONFIRMATION_TOKEN_EXPIRY = '15';

    notificationService = new NotificationService(mockDb, tenantId);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('sendEmailNotification', () => {
    it('should send email notification successfully', async () => {
      // Mock rate limit check
      mockRedisClient.get.mockResolvedValue('5'); // 5 notifications sent
      mockRedisClient.ttl.mockResolvedValue(3600); // 1 hour remaining

      // Mock SendGrid response
      mockSgMail.send.mockResolvedValue([
        {
          statusCode: 202,
          body: {},
          headers: { 'x-message-id': 'msg-123' }
        },
        {}
      ]);

      // Mock Redis increment
      mockRedisClient.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      } as any);

      const result = await notificationService.sendEmailNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          from: 'test@example.com',
          subject: expect.stringContaining('Test Business: Slot Available'),
          html: expect.stringContaining('John Doe'),
          text: expect.stringContaining('John Doe')
        })
      );
      expect(mockDb).toHaveBeenCalledWith('notifications');
    });

    it('should respect rate limiting', async () => {
      // Mock rate limit exceeded
      mockRedisClient.get.mockResolvedValue('25'); // Rate limit reached
      mockRedisClient.ttl.mockResolvedValue(3600);

      const result = await notificationService.sendEmailNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(mockSgMail.send).not.toHaveBeenCalled();
    });

    it('should handle SendGrid errors gracefully', async () => {
      // Mock rate limit check
      mockRedisClient.get.mockResolvedValue('5');
      mockRedisClient.ttl.mockResolvedValue(3600);

      // Mock SendGrid error
      mockSgMail.send.mockRejectedValue(new Error('SendGrid API error'));

      const result = await notificationService.sendEmailNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('SendGrid API error');
      
      // Should save failed notification
      expect(mockDb).toHaveBeenCalledWith('notifications');
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock Redis error
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection error'));

      // Mock SendGrid success
      mockSgMail.send.mockResolvedValue([
        {
          statusCode: 202,
          body: {},
          headers: { 'x-message-id': 'msg-123' }
        },
        {}
      ]);

      const result = await notificationService.sendEmailNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      // Should still allow the notification (graceful degradation)
      expect(result.success).toBe(true);
    });
  });

  describe('generateConfirmToken', () => {
    it('should generate valid confirmation token', () => {
      const mockToken = 'mock-jwt-token';
      (mockJwt.sign as jest.Mock).mockReturnValue(mockToken);

      const token = notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');

      expect(token).toBe(mockToken);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          entryId: 'entry-123',
          slotId: 'slot-123',
          tenantId: tenantId,
          action: 'confirm',
          exp: expect.any(Number)
        }),
        'test-secret'
      );
    });

    it('should throw error if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
      }).toThrow('JWT_SECRET environment variable is required');
    });
  });

  describe('verifyConfirmToken', () => {
    it('should verify valid token', () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: tenantId,
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900 // 15 minutes
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = notificationService.verifyConfirmToken('valid-token');

      expect(result).toEqual(mockDecoded);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret');
    });

    it('should return null for invalid token', () => {
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = notificationService.verifyConfirmToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null for wrong tenant', () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'different-tenant',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      (mockJwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = notificationService.verifyConfirmToken('wrong-tenant-token');

      expect(result).toBeNull();
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests under rate limit', async () => {
      mockRedisClient.get.mockResolvedValue('10'); // 10 notifications sent
      mockRedisClient.ttl.mockResolvedValue(3600); // 1 hour remaining

      const result = await notificationService.checkRateLimit();

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(14); // 25 - 10 - 1
      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should block requests over rate limit', async () => {
      mockRedisClient.get.mockResolvedValue('25'); // Rate limit reached
      mockRedisClient.ttl.mockResolvedValue(3600);

      const result = await notificationService.checkRateLimit();

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should handle new rate limit window', async () => {
      mockRedisClient.get.mockResolvedValue(null); // No previous count
      mockRedisClient.ttl.mockResolvedValue(-1); // No TTL set

      const result = await notificationService.checkRateLimit();

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(24); // 25 - 0 - 1
    });

    it('should gracefully handle Redis errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await notificationService.checkRateLimit();

      // Should allow request when Redis is down
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(24);
    });
  });

  describe('retryFailedNotification', () => {
    it('should retry failed notification successfully', async () => {
      // Mock notification retrieval
      const mockNotification = {
        id: 'notification-123',
        tenant_id: tenantId,
        waitlist_entry_id: 'entry-123',
        slot_id: 'slot-123',
        type: NotificationType.EMAIL,
        recipient: 'john@example.com',
        status: NotificationStatus.FAILED,
        error_message: 'Previous error'
      };

      mockDb().first
        .mockResolvedValueOnce(mockNotification) // getNotification
        .mockResolvedValueOnce(mockEntry) // waitlist entry
        .mockResolvedValueOnce(mockSlot) // slot
        .mockResolvedValueOnce(mockService) // service
        .mockResolvedValueOnce(mockStaff) // staff
        .mockResolvedValueOnce({ id: tenantId, name: 'Test Business' }); // tenant

      // Mock rate limit and SendGrid for retry
      mockRedisClient.get.mockResolvedValue('5');
      mockRedisClient.ttl.mockResolvedValue(3600);
      mockSgMail.send.mockResolvedValue([
        {
          statusCode: 202,
          body: {},
          headers: { 'x-message-id': 'retry-msg-123' }
        },
        {}
      ]);
      mockRedisClient.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      } as any);

      const result = await notificationService.retryFailedNotification('notification-123');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('retry-msg-123');
    });

    it('should stop retrying after max attempts', async () => {
      const result = await notificationService.retryFailedNotification('notification-123', 3);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Maximum retry attempts exceeded');
    });

    it('should handle missing notification', async () => {
      mockDb().first.mockResolvedValue(null);

      const result = await notificationService.retryFailedNotification('nonexistent-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notification not found');
    });
  });

  describe('getNotificationStats', () => {
    it('should calculate notification statistics correctly', async () => {
      const mockStats = {
        total: '100',
        sent: '85',
        delivered: '80',
        failed: '15'
      };

      mockDb().first.mockResolvedValue(mockStats);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await notificationService.getNotificationStats(startDate, endDate);

      expect(result).toEqual({
        total: 100,
        sent: 85,
        delivered: 80,
        failed: 15,
        deliveryRate: 85 // (85 / 100) * 100 = 85%
      });
    });

    it('should handle zero notifications', async () => {
      const mockStats = {
        total: '0',
        sent: '0',
        delivered: '0',
        failed: '0'
      };

      mockDb().first.mockResolvedValue(mockStats);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await notificationService.getNotificationStats(startDate, endDate);

      expect(result).toEqual({
        total: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0
      });
    });
  });

  describe('email template generation', () => {
    it('should generate proper email template with all required elements', async () => {
      // Mock rate limit and SendGrid
      mockRedisClient.get.mockResolvedValue('5');
      mockRedisClient.ttl.mockResolvedValue(3600);
      mockSgMail.send.mockResolvedValue([
        {
          statusCode: 202,
          body: {},
          headers: { 'x-message-id': 'msg-123' }
        },
        {}
      ]);
      mockRedisClient.multi.mockReturnValue({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      } as any);

      await notificationService.sendEmailNotification(
        mockEntry,
        mockSlot,
        mockService,
        mockStaff,
        'Test Business'
      );

      const sentEmail = mockSgMail.send.mock.calls[0][0] as any;
      
      // Check subject
      expect(sentEmail.subject).toContain('Test Business: Slot Available');
      expect(sentEmail.subject).toContain('Hair Cut');

      // Check HTML content includes all required elements
      expect(sentEmail.html).toContain('John Doe'); // Customer name
      expect(sentEmail.html).toContain('Hair Cut'); // Service name
      expect(sentEmail.html).toContain('Jane Smith'); // Staff name
      expect(sentEmail.html).toContain('Test Business'); // Business name
      expect(sentEmail.html).toContain('CONFIRM BOOKING'); // Confirm button
      expect(sentEmail.html).toContain('DECLINE'); // Decline button
      expect(sentEmail.html).toContain('10 minutes'); // Hold duration

      // Check text content
      expect(sentEmail.text).toContain('John Doe');
      expect(sentEmail.text).toContain('Hair Cut');
      expect(sentEmail.text).toContain('Jane Smith');
      expect(sentEmail.text).toContain('Test Business');
      expect(sentEmail.text).toContain('CONFIRM:');
      expect(sentEmail.text).toContain('DECLINE:');
    });
  });

  describe('token security', () => {
    it('should generate tokens with proper expiration', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        expect(payload.exp).toBeGreaterThan(beforeTime);
        expect(payload.exp).toBeLessThanOrEqual(beforeTime + 15 * 60); // 15 minutes
        return 'mock-token';
      });

      notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');

      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('should include all required token fields', () => {
      (mockJwt.sign as jest.Mock).mockImplementation((payload: any) => {
        expect(payload).toHaveProperty('entryId', 'entry-123');
        expect(payload).toHaveProperty('slotId', 'slot-123');
        expect(payload).toHaveProperty('tenantId', tenantId);
        expect(payload).toHaveProperty('action', 'confirm');
        expect(payload).toHaveProperty('exp');
        return 'mock-token';
      });

      notificationService.generateConfirmToken('entry-123', 'slot-123', 'confirm');
    });
  });
});