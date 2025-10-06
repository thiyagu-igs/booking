import request from 'supertest';
import express from 'express';
import notificationRoutes from '../../routes/notifications';
import { NotificationService } from '../../services/NotificationService';
import { WaitlistService } from '../../services/WaitlistService';
import { SlotService } from '../../services/SlotService';
import { 
  WaitlistStatus, 
  SlotStatus, 
  BookingSource,
  WaitlistEntry,
  Slot
} from '../../models';

// Mock services
jest.mock('../../services/NotificationService');
jest.mock('../../services/WaitlistService');
jest.mock('../../services/SlotService');

const MockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;
const MockWaitlistService = WaitlistService as jest.MockedClass<typeof WaitlistService>;
const MockSlotService = SlotService as jest.MockedClass<typeof SlotService>;

describe('Notification Routes', () => {
  let app: express.Application;
  let mockDb: any;
  let mockTransaction: any;

  const mockEntry: WaitlistEntry = {
    id: 'entry-123',
    tenant_id: 'tenant-123',
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
    tenant_id: 'tenant-123',
    staff_id: 'staff-123',
    service_id: 'service-123',
    start_time: new Date('2024-01-15T14:00:00Z'),
    end_time: new Date('2024-01-15T15:00:00Z'),
    status: SlotStatus.HELD,
    hold_expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    created_at: new Date('2024-01-15T13:50:00Z')
  };

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock database and transaction
    mockTransaction = {
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([1]),
      whereNot: jest.fn().mockReturnThis()
    };

    mockDb = jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      whereBetween: jest.fn().mockReturnThis(),
      transaction: jest.fn().mockImplementation((callback) => callback(mockTransaction))
    });

    app.locals.db = mockDb;
    app.use('/api', notificationRoutes);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('POST /api/confirm/:token', () => {
    it('should confirm booking successfully', async () => {
      // Mock token verification
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null) // First call (temp service)
        .mockReturnValueOnce(mockDecoded); // Second call (proper service)

      // Mock service methods
      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(mockEntry);
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      // Mock database queries for booking creation
      mockDb().first
        .mockResolvedValueOnce({ id: 'service-123', name: 'Hair Cut' }) // service
        .mockResolvedValueOnce({ id: 'staff-123', name: 'Jane Smith' }) // staff
        .mockResolvedValueOnce({ id: 'tenant-123', name: 'Test Business' }); // tenant

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('confirmed successfully');
      expect(response.body.booking).toMatchObject({
        customerName: 'John Doe',
        serviceName: 'Hair Cut',
        staffName: 'Jane Smith',
        businessName: 'Test Business',
        status: 'confirmed'
      });

      // Verify database operations
      expect(mockTransaction.update).toHaveBeenCalledWith({
        status: SlotStatus.BOOKED,
        hold_expires_at: null,
        updated_at: expect.any(Date)
      });

      expect(mockTransaction.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          slot_id: 'slot-123',
          waitlist_entry_id: 'entry-123',
          customer_name: 'John Doe',
          status: 'confirmed',
          booking_source: BookingSource.WAITLIST
        })
      );
    });

    it('should reject invalid token', async () => {
      MockNotificationService.prototype.verifyConfirmToken.mockReturnValue(null);

      const response = await request(app)
        .post('/api/confirm/invalid-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid or expired confirmation token');
    });

    it('should reject wrong action token', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'decline' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      const response = await request(app)
        .post('/api/confirm/wrong-action-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid token action');
    });

    it('should handle slot no longer available', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(mockEntry);
      MockSlotService.prototype.getSlot.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.BOOKED
      });

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('This slot is no longer available');
    });

    it('should handle expired hold', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(mockEntry);
      MockSlotService.prototype.getSlot.mockResolvedValue({
        ...mockSlot,
        hold_expires_at: new Date(Date.now() - 60000) // Expired 1 minute ago
      });

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('Confirmation window has expired');
    });

    it('should handle inactive waitlist entry', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue({
        ...mockEntry,
        status: WaitlistStatus.REMOVED
      });
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('Waitlist entry is no longer active');
    });

    it('should handle missing entry or slot', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(null);
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(404);

      expect(response.body.error).toBe('Waitlist entry or slot not found');
    });
  });

  describe('POST /api/decline/:token', () => {
    it('should decline booking successfully', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'decline' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(mockEntry);
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      const response = await request(app)
        .post('/api/decline/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('declined');
      expect(response.body.customerName).toBe('John Doe');

      // Verify slot is released
      expect(mockTransaction.update).toHaveBeenCalledWith({
        status: SlotStatus.OPEN,
        hold_expires_at: null,
        updated_at: expect.any(Date)
      });

      // Verify audit log is created
      expect(mockTransaction.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'booking_declined',
          resource_type: 'slot',
          resource_id: 'slot-123'
        })
      );
    });

    it('should reject invalid decline token', async () => {
      MockNotificationService.prototype.verifyConfirmToken.mockReturnValue(null);

      const response = await request(app)
        .post('/api/decline/invalid-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid or expired decline token');
    });

    it('should reject wrong action token for decline', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      const response = await request(app)
        .post('/api/decline/wrong-action-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid token action');
    });
  });

  describe('GET /api/history', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/history')
        .expect(401);

      expect(response.body.error).toBe('Access token is required');
    });

    it('should get notification history with authentication', async () => {
      // Mock authentication middleware
      app.use((req, res, next) => {
        req.user = { 
          userId: 'user-123', 
          tenantId: 'tenant-123',
          email: 'test@example.com',
          role: 'admin'
        };
        next();
      });

      const mockNotifications = [
        {
          id: 'notification-1',
          tenant_id: 'tenant-123',
          waitlist_entry_id: 'entry-123',
          slot_id: 'slot-123',
          type: 'email' as any,
          recipient: 'john@example.com',
          subject: 'Test Subject',
          message: 'Test message',
          status: 'sent' as any,
          created_at: new Date()
        }
      ];

      MockNotificationService.prototype.getNotificationsForEntry.mockResolvedValue(mockNotifications);

      const response = await request(app)
        .get('/api/history?entryId=entry-123')
        .expect(200);

      expect(response.body.notifications).toEqual(mockNotifications);
      expect(response.body.total).toBe(1);
    });
  });

  describe('GET /api/stats', () => {
    it('should get notification statistics', async () => {
      // Mock authentication
      app.use((req, res, next) => {
        req.user = { 
          userId: 'user-123', 
          tenantId: 'tenant-123',
          email: 'test@example.com',
          role: 'admin'
        };
        next();
      });

      const mockStats = {
        total: 100,
        sent: 85,
        delivered: 80,
        failed: 15,
        deliveryRate: 85
      };

      MockNotificationService.prototype.getNotificationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.stats).toEqual(mockStats);
      expect(response.body.period).toHaveProperty('startDate');
      expect(response.body.period).toHaveProperty('endDate');
    });
  });

  describe('POST /api/retry/:notificationId', () => {
    it('should retry failed notification', async () => {
      // Mock authentication
      app.use((req, res, next) => {
        req.user = { 
          userId: 'user-123', 
          tenantId: 'tenant-123',
          email: 'test@example.com',
          role: 'admin'
        };
        next();
      });

      const mockRetryResult = {
        success: true,
        notificationId: 'notification-123',
        messageId: 'retry-msg-123'
      };

      MockNotificationService.prototype.retryFailedNotification.mockResolvedValue(mockRetryResult);

      const response = await request(app)
        .post('/api/retry/notification-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.messageId).toBe('retry-msg-123');
    });

    it('should handle retry failure', async () => {
      // Mock authentication
      app.use((req, res, next) => {
        req.user = { 
          userId: 'user-123', 
          tenantId: 'tenant-123',
          email: 'test@example.com',
          role: 'admin'
        };
        next();
      });

      const mockRetryResult = {
        success: false,
        notificationId: 'notification-123',
        error: 'Maximum retry attempts exceeded'
      };

      MockNotificationService.prototype.retryFailedNotification.mockResolvedValue(mockRetryResult);

      const response = await request(app)
        .post('/api/retry/notification-123')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Maximum retry attempts exceeded');
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'confirm' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to process confirmation');
    });

    it('should handle service errors gracefully', async () => {
      const mockDecoded = {
        entryId: 'entry-123',
        slotId: 'slot-123',
        tenantId: 'tenant-123',
        action: 'decline' as const,
        exp: Math.floor(Date.now() / 1000) + 900
      };

      MockNotificationService.prototype.verifyConfirmToken
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockDecoded);

      MockWaitlistService.prototype.getWaitlistEntry.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .post('/api/decline/valid-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to process decline');
    });
  });
});