import { BackgroundJobService } from '../../services/BackgroundJobService';
import { SlotRepository } from '../../repositories/SlotRepository';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { TenantRepository } from '../../repositories/TenantRepository';
import { NotificationService } from '../../services/NotificationService';
import { SlotService } from '../../services/SlotService';
import { WaitlistService } from '../../services/WaitlistService';
import { SlotStatus, WaitlistStatus } from '../../models';

// Mock all dependencies
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../repositories/TenantRepository');
jest.mock('../../services/NotificationService');
jest.mock('../../services/SlotService');
jest.mock('../../services/WaitlistService');

describe('BackgroundJobService', () => {
  let backgroundJobService: BackgroundJobService;
  let mockDb: any;
  let mockSlotService: jest.Mocked<SlotService>;
  let mockNotificationService: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      del: jest.fn().mockResolvedValue(0),
    };

    backgroundJobService = new BackgroundJobService(mockDb);

    // Setup mocks
    mockSlotService = {
      processExpiredHolds: jest.fn(),
      handleCascadeNotification: jest.fn(),
    } as any;

    mockNotificationService = {
      sendEmailNotification: jest.fn(),
      retryFailedNotification: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processExpiredHolds', () => {
    it('should process expired holds for all tenants when no tenantId specified', async () => {
      const mockJob = {
        id: 'job-1',
        data: {},
      } as any;

      // Mock tenants query
      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([
        { id: 'tenant-1' },
        { id: 'tenant-2' },
      ]);

      // Mock SlotService constructor and processExpiredHolds
      const mockSlotServiceInstance = {
        processExpiredHolds: jest.fn().mockResolvedValue({
          released_count: 2,
          cascade_notifications: 1,
        }),
      };

      // Mock constructor calls
      jest.mocked(SlotService).mockImplementation(() => mockSlotServiceInstance as any);

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.processed_tenants).toBe(2);
      expect(result.data?.released_slots).toBe(4); // 2 per tenant
      expect(result.data?.cascade_notifications).toBe(2); // 1 per tenant
    });

    it('should process expired holds for specific tenant when tenantId provided', async () => {
      const mockJob = {
        id: 'job-1',
        data: { tenantId: 'tenant-1' },
      } as any;

      const mockSlotServiceInstance = {
        processExpiredHolds: jest.fn().mockResolvedValue({
          released_count: 3,
          cascade_notifications: 2,
        }),
      };

      jest.mocked(SlotService).mockImplementation(() => mockSlotServiceInstance as any);

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.processed_tenants).toBe(1);
      expect(result.data?.released_slots).toBe(3);
      expect(result.data?.cascade_notifications).toBe(2);
    });

    it('should handle errors gracefully and continue processing other tenants', async () => {
      const mockJob = {
        id: 'job-1',
        data: {},
      } as any;

      mockDb.select.mockReturnValueOnce(mockDb);
      mockDb.where.mockResolvedValueOnce([
        { id: 'tenant-1' },
        { id: 'tenant-2' },
      ]);

      let callCount = 0;
      jest.mocked(SlotService).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Database connection failed');
        }
        return {
          processExpiredHolds: jest.fn().mockResolvedValue({
            released_count: 1,
            cascade_notifications: 0,
          }),
        } as any;
      });

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.processed_tenants).toBe(1); // Only successful tenant
      expect(result.data?.errors).toHaveLength(1);
      expect(result.data?.errors[0]).toContain('tenant-1');
    });

    it('should return failure when job completely fails', async () => {
      const mockJob = {
        id: 'job-1',
        data: {},
      } as any;

      mockDb.select.mockRejectedValueOnce(new Error('Database unavailable'));

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database unavailable');
    });
  });

  describe('processNotificationCascade', () => {
    it('should process notification cascade successfully', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          tenantId: 'tenant-1',
          slotId: 'slot-1',
          previousEntryId: 'entry-1',
          reason: 'declined' as const,
        },
      } as any;

      const mockSlot = {
        id: 'slot-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        start_time: new Date(),
        end_time: new Date(),
        status: SlotStatus.HELD,
      };

      const mockCandidate = {
        id: 'entry-2',
        customer_name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        service_id: 'service-1',
        staff_id: 'staff-1',
        earliest_time: new Date(),
        latest_time: new Date(),
        priority_score: 50,
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
        tenant_id: 'tenant-1',
      };

      const mockService = { id: 'service-1', name: 'Haircut' };
      const mockStaff = { id: 'staff-1', name: 'Jane Smith' };
      const mockTenant = { id: 'tenant-1', name: 'Test Salon' };

      // Mock repository methods
      const mockSlotRepo = {
        findById: jest.fn().mockResolvedValue(mockSlot),
      };

      const mockWaitlistRepo = {
        updateStatus: jest.fn().mockResolvedValue(true),
      };

      const mockServiceRepo = {
        findById: jest.fn().mockResolvedValue(mockService),
      };

      const mockStaffRepo = {
        findById: jest.fn().mockResolvedValue(mockStaff),
      };

      const mockTenantRepo = {
        findById: jest.fn().mockResolvedValue(mockTenant),
      };

      const mockSlotServiceInstance = {
        handleCascadeNotification: jest.fn().mockResolvedValue(mockCandidate),
      };

      const mockNotificationServiceInstance = {
        sendEmailNotification: jest.fn().mockResolvedValue({
          success: true,
          notificationId: 'notif-1',
        }),
      };

      // Mock constructors
      jest.mocked(SlotRepository).mockImplementation(() => mockSlotRepo as any);
      jest.mocked(WaitlistRepository).mockImplementation(() => mockWaitlistRepo as any);
      jest.mocked(ServiceRepository).mockImplementation(() => mockServiceRepo as any);
      jest.mocked(StaffRepository).mockImplementation(() => mockStaffRepo as any);
      jest.mocked(TenantRepository).mockImplementation(() => mockTenantRepo as any);
      jest.mocked(SlotService).mockImplementation(() => mockSlotServiceInstance as any);
      jest.mocked(NotificationService).mockImplementation(() => mockNotificationServiceInstance as any);

      const result = await backgroundJobService.processNotificationCascade(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.next_candidate_found).toBe(true);
      expect(result.data?.notification_sent).toBe(true);
      expect(result.data?.candidate_name).toBe('John Doe');
      expect(mockWaitlistRepo.updateStatus).toHaveBeenCalledWith('entry-1', WaitlistStatus.REMOVED);
    });

    it('should handle case when no next candidate is found', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          tenantId: 'tenant-1',
          slotId: 'slot-1',
          previousEntryId: 'entry-1',
          reason: 'expired' as const,
        },
      } as any;

      const mockSlot = {
        id: 'slot-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        start_time: new Date(),
        end_time: new Date(),
        status: SlotStatus.HELD,
      };

      const mockSlotRepo = {
        findById: jest.fn().mockResolvedValue(mockSlot),
      };

      const mockWaitlistRepo = {
        updateStatus: jest.fn().mockResolvedValue(true),
      };

      const mockSlotServiceInstance = {
        handleCascadeNotification: jest.fn().mockResolvedValue(null), // No candidate found
      };

      jest.mocked(SlotRepository).mockImplementation(() => mockSlotRepo as any);
      jest.mocked(WaitlistRepository).mockImplementation(() => mockWaitlistRepo as any);
      jest.mocked(SlotService).mockImplementation(() => mockSlotServiceInstance as any);

      const result = await backgroundJobService.processNotificationCascade(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.next_candidate_found).toBe(false);
      expect(result.data?.notification_sent).toBe(false);
    });

    it('should handle slot not found error', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          tenantId: 'tenant-1',
          slotId: 'nonexistent-slot',
          previousEntryId: 'entry-1',
          reason: 'declined' as const,
        },
      } as any;

      const mockSlotRepo = {
        findById: jest.fn().mockResolvedValue(null),
      };

      jest.mocked(SlotRepository).mockImplementation(() => mockSlotRepo as any);

      const result = await backgroundJobService.processNotificationCascade(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Slot nonexistent-slot not found');
    });
  });

  describe('retryFailedNotification', () => {
    it('should retry failed notification successfully', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          tenantId: 'tenant-1',
          notificationId: 'notif-1',
          retryCount: 1,
        },
      } as any;

      const mockNotificationServiceInstance = {
        retryFailedNotification: jest.fn().mockResolvedValue({
          success: true,
          notificationId: 'notif-1',
        }),
      };

      jest.mocked(NotificationService).mockImplementation(() => mockNotificationServiceInstance as any);

      const result = await backgroundJobService.retryFailedNotification(mockJob);

      expect(result.success).toBe(true);
      expect(mockNotificationServiceInstance.retryFailedNotification).toHaveBeenCalledWith('notif-1', 1);
    });

    it('should handle retry failure', async () => {
      const mockJob = {
        id: 'job-1',
        data: {
          tenantId: 'tenant-1',
          notificationId: 'notif-1',
          retryCount: 2,
        },
      } as any;

      const mockNotificationServiceInstance = {
        retryFailedNotification: jest.fn().mockResolvedValue({
          success: false,
          notificationId: 'notif-1',
          error: 'Max retries exceeded',
        }),
      };

      jest.mocked(NotificationService).mockImplementation(() => mockNotificationServiceInstance as any);

      const result = await backgroundJobService.retryFailedNotification(mockJob);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Max retries exceeded');
    });
  });

  describe('cleanupOldJobs', () => {
    it('should cleanup old notifications and audit logs', async () => {
      const mockJob = {
        id: 'job-1',
        data: { olderThanDays: 30 },
      } as any;

      // Mock notifications cleanup
      const mockNotificationsQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(5),
      };

      // Mock audit logs cleanup
      const mockAuditLogsQuery = {
        where: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(3),
      };

      mockDb.mockReturnValueOnce(mockNotificationsQuery)
           .mockReturnValueOnce(mockAuditLogsQuery);

      const result = await backgroundJobService.cleanupOldJobs(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.deleted_notifications).toBe(5);
      expect(result.data?.deleted_audit_logs).toBe(3);
    });

    it('should handle missing audit logs table gracefully', async () => {
      const mockJob = {
        id: 'job-1',
        data: { olderThanDays: 30 },
      } as any;

      const mockNotificationsQuery = {
        where: jest.fn().mockReturnThis(),
        whereIn: jest.fn().mockReturnThis(),
        del: jest.fn().mockResolvedValue(2),
      };

      const mockAuditLogsQuery = {
        where: jest.fn().mockReturnThis(),
        del: jest.fn().mockRejectedValue(new Error('Table does not exist')),
      };

      mockDb.mockReturnValueOnce(mockNotificationsQuery)
           .mockReturnValueOnce(mockAuditLogsQuery);

      const result = await backgroundJobService.cleanupOldJobs(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.deleted_notifications).toBe(2);
      expect(result.data?.deleted_audit_logs).toBe(0);
    });
  });
});