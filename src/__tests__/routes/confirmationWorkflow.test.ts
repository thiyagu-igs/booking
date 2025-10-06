import request from 'supertest';
import express from 'express';
import notificationRoutes from '../../routes/notifications';
import { NotificationService } from '../../services/NotificationService';
import { WaitlistService } from '../../services/WaitlistService';
import { SlotService } from '../../services/SlotService';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { SlotRepository } from '../../repositories/SlotRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { 
  WaitlistStatus, 
  SlotStatus, 
  BookingSource,
  WaitlistEntry,
  Slot
} from '../../models';

// Mock services and repositories
jest.mock('../../services/NotificationService');
jest.mock('../../services/WaitlistService');
jest.mock('../../services/SlotService');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');

const MockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;
const MockWaitlistService = WaitlistService as jest.MockedClass<typeof WaitlistService>;
const MockSlotService = SlotService as jest.MockedClass<typeof SlotService>;

describe('Confirmation and Booking Workflow', () => {
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

  const mockNextCandidate = {
    id: 'entry-456',
    tenant_id: 'tenant-123',
    customer_name: 'Jane Smith',
    phone: '+1234567891',
    email: 'jane@example.com',
    service_id: 'service-123',
    staff_id: 'staff-123',
    earliest_time: new Date('2024-01-15T09:00:00Z'),
    latest_time: new Date('2024-01-15T17:00:00Z'),
    priority_score: 70,
    vip_status: false,
    status: WaitlistStatus.ACTIVE,
    created_at: new Date('2024-01-10T11:00:00Z'),
    service_name: 'Hair Cut',
    staff_name: 'Jane Smith',
    match_score: 85
  };

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock database and transaction
    mockTransaction = {
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      first: jest.fn(),
      update: jest.fn().mockResolvedValue(1),
      insert: jest.fn().mockResolvedValue([1])
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

  describe('Confirmation Workflow', () => {
    it('should handle successful booking confirmation', async () => {
      // Mock token verification
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

      // Mock service methods
      MockWaitlistService.prototype.getWaitlistEntry.mockResolvedValue(mockEntry);
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      // Mock transaction slot check
      mockTransaction.first.mockResolvedValue(mockSlot);

      // Mock database queries for booking creation
      mockDb().first
        .mockResolvedValueOnce({ id: 'service-123', name: 'Hair Cut' })
        .mockResolvedValueOnce({ id: 'staff-123', name: 'Jane Smith' })
        .mockResolvedValueOnce({ id: 'tenant-123', name: 'Test Business' });

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

      // Verify race condition protection
      expect(mockTransaction.first).toHaveBeenCalledWith();
      expect(mockTransaction.update).toHaveBeenCalledWith({
        status: SlotStatus.BOOKED,
        hold_expires_at: null,
        updated_at: expect.any(Date)
      });
    });

    it('should handle race condition during booking', async () => {
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
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      // Mock slot already booked in transaction
      mockTransaction.first.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.BOOKED
      });

      // Mock transaction throwing error
      mockDb.mockImplementation(() => ({
        transaction: jest.fn().mockImplementation((callback) => {
          return callback(mockTransaction).catch(() => {
            throw new Error('SLOT_NO_LONGER_AVAILABLE');
          });
        })
      }));

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('This slot is no longer available');
    });

    it('should handle expired hold during confirmation', async () => {
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
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      // Mock expired hold in transaction
      mockTransaction.first.mockResolvedValue({
        ...mockSlot,
        hold_expires_at: new Date(Date.now() - 60000) // Expired 1 minute ago
      });

      // Mock transaction throwing error
      mockDb.mockImplementation(() => ({
        transaction: jest.fn().mockImplementation((callback) => {
          return callback(mockTransaction).catch(() => {
            throw new Error('HOLD_EXPIRED');
          });
        })
      }));

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('Confirmation window has expired');
    });
  });

  describe('Decline and Cascade Workflow', () => {
    it('should handle decline with successful cascade notification', async () => {
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

      // Mock cascade notification
      MockSlotService.prototype.handleCascadeNotification.mockResolvedValue(mockNextCandidate);

      // Mock notification sending
      MockNotificationService.prototype.sendEmailNotification.mockResolvedValue({
        success: true,
        notificationId: 'notification-456',
        messageId: 'msg-456'
      });

      // Mock database queries for cascade notification
      mockDb().first
        .mockResolvedValueOnce({ id: 'service-123', name: 'Hair Cut' })
        .mockResolvedValueOnce({ id: 'staff-123', name: 'Jane Smith' })
        .mockResolvedValueOnce({ id: 'tenant-123', name: 'Test Business' });

      const response = await request(app)
        .post('/api/decline/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('declined');
      expect(response.body.cascade.next_candidate_notified).toBe(true);
      expect(response.body.cascade.next_candidate_name).toBe('Jane Smith');

      // Verify cascade notification was triggered
      expect(MockSlotService.prototype.handleCascadeNotification).toHaveBeenCalledWith('slot-123');
      expect(MockNotificationService.prototype.sendEmailNotification).toHaveBeenCalledWith(
        mockNextCandidate,
        mockSlot,
        expect.any(Object),
        expect.any(Object),
        'Test Business'
      );
    });

    it('should handle decline with no eligible candidates', async () => {
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

      // Mock no next candidate
      MockSlotService.prototype.handleCascadeNotification.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/decline/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cascade.next_candidate_notified).toBe(false);
      expect(response.body.cascade.reason).toBe('No other eligible candidates found');
    });

    it('should handle cascade notification failure gracefully', async () => {
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

      // Mock cascade notification failure
      MockSlotService.prototype.handleCascadeNotification.mockRejectedValue(
        new Error('Cascade notification failed')
      );

      const response = await request(app)
        .post('/api/decline/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.cascade.next_candidate_notified).toBe(false);
      expect(response.body.cascade.reason).toBe('Cascade notification failed');
    });
  });

  describe('Expired Confirmation Handling', () => {
    it('should handle expired confirmation with next candidate', async () => {
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

      MockSlotService.prototype.getSlot.mockResolvedValue({
        ...mockSlot,
        hold_expires_at: new Date(Date.now() - 60000) // Expired 1 minute ago
      });

      MockSlotService.prototype.handleCascadeNotification.mockResolvedValue(mockNextCandidate);

      MockNotificationService.prototype.sendEmailNotification.mockResolvedValue({
        success: true,
        notificationId: 'notification-456',
        messageId: 'msg-456'
      });

      // Mock database queries
      mockDb().first
        .mockResolvedValueOnce({ id: 'service-123', name: 'Hair Cut' })
        .mockResolvedValueOnce({ id: 'staff-123', name: 'Jane Smith' })
        .mockResolvedValueOnce({ id: 'tenant-123', name: 'Test Business' });

      const response = await request(app)
        .post('/api/handle-expired/slot-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('next candidate notified');
      expect(response.body.next_candidate.name).toBe('Jane Smith');
      expect(response.body.next_candidate.notification_sent).toBe(true);
    });

    it('should handle expired confirmation with no candidates', async () => {
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

      MockSlotService.prototype.getSlot.mockResolvedValue({
        ...mockSlot,
        hold_expires_at: new Date(Date.now() - 60000) // Expired 1 minute ago
      });

      MockSlotService.prototype.handleCascadeNotification.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/handle-expired/slot-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('no eligible candidates');
      expect(response.body.next_candidate).toBeNull();
    });

    it('should reject handling non-expired holds', async () => {
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

      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot); // Not expired

      const response = await request(app)
        .post('/api/handle-expired/slot-123')
        .expect(400);

      expect(response.body.error).toBe('Hold has not expired yet');
    });

    it('should handle non-held slots', async () => {
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

      MockSlotService.prototype.getSlot.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.OPEN
      });

      const response = await request(app)
        .post('/api/handle-expired/slot-123')
        .expect(400);

      expect(response.body.error).toBe('Slot is not in held status');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing waitlist entry during confirmation', async () => {
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

    it('should handle database transaction failures', async () => {
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
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      // Mock database transaction failure
      mockDb.mockImplementation(() => ({
        transaction: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      }));

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(500);

      expect(response.body.error).toBe('Failed to process confirmation');
    });

    it('should handle invalid token format', async () => {
      MockNotificationService.prototype.verifyConfirmToken.mockReturnValue(null);

      const response = await request(app)
        .post('/api/confirm/malformed-token')
        .expect(400);

      expect(response.body.error).toBe('Invalid or expired confirmation token');
    });

    it('should handle confirmed entry that is no longer active', async () => {
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
        status: WaitlistStatus.CONFIRMED
      });
      MockSlotService.prototype.getSlot.mockResolvedValue(mockSlot);

      const response = await request(app)
        .post('/api/confirm/valid-token')
        .expect(409);

      expect(response.body.error).toBe('Waitlist entry is no longer active');
    });
  });
});