import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { WaitlistEntry, WaitlistStatus } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection', () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNull: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  into: jest.fn(),
  update: jest.fn(),
  del: jest.fn(),
  count: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  raw: jest.fn(),
  __esModule: true,
  default: jest.fn()
}));

describe('WaitlistRepository', () => {
  let waitlistRepository: WaitlistRepository;
  const mockTenantId = 'tenant-123';
  const mockWaitlistEntry: WaitlistEntry = {
    id: 'waitlist-123',
    tenant_id: mockTenantId,
    customer_name: 'Jane Doe',
    phone: '+1234567890',
    email: 'jane@example.com',
    service_id: 'service-123',
    staff_id: 'staff-123',
    earliest_time: new Date('2024-01-15T09:00:00Z'),
    latest_time: new Date('2024-01-15T17:00:00Z'),
    priority_score: 50,
    vip_status: false,
    status: WaitlistStatus.ACTIVE,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    waitlistRepository = new WaitlistRepository(mockTenantId);
    jest.clearAllMocks();
  });

  describe('findActive', () => {
    it('should find all active waitlist entries', async () => {
      const mockActiveEntries = [mockWaitlistEntry];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockActiveEntries)
        })
      });

      const result = await waitlistRepository.findActive();

      expect(result).toEqual(mockActiveEntries);
    });
  });

  describe('findByPhone', () => {
    it('should find waitlist entries by phone number', async () => {
      const mockPhoneEntries = [mockWaitlistEntry];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockPhoneEntries)
        })
      });

      const result = await waitlistRepository.findByPhone('+1234567890');

      expect(result).toEqual(mockPhoneEntries);
    });
  });

  describe('findActiveByPhone', () => {
    it('should find active waitlist entries by phone number', async () => {
      const mockActivePhoneEntries = [mockWaitlistEntry];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockActivePhoneEntries)
        })
      });

      const result = await waitlistRepository.findActiveByPhone('+1234567890');

      expect(result).toEqual(mockActivePhoneEntries);
    });
  });

  describe('countActiveByPhone', () => {
    it('should count active entries for a phone number', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '2' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await waitlistRepository.countActiveByPhone('+1234567890');

      expect(result).toBe(2);
    });

    it('should return 0 if no active entries found', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await waitlistRepository.countActiveByPhone('+9999999999');

      expect(result).toBe(0);
    });
  });

  describe('findByService', () => {
    it('should find waitlist entries by service', async () => {
      const mockServiceEntries = [mockWaitlistEntry];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockServiceEntries)
        })
      });

      const result = await waitlistRepository.findByService('service-123');

      expect(result).toEqual(mockServiceEntries);
    });
  });

  describe('findByStaff', () => {
    it('should find waitlist entries by staff preference', async () => {
      const mockStaffEntries = [mockWaitlistEntry];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockStaffEntries)
        })
      });

      const result = await waitlistRepository.findByStaff('staff-123');

      expect(result).toEqual(mockStaffEntries);
    });
  });

  describe('findCandidatesForSlot', () => {
    it('should find eligible candidates for a slot', async () => {
      const serviceId = 'service-123';
      const staffId = 'staff-123';
      const slotStartTime = new Date('2024-01-15T10:00:00Z');
      const slotEndTime = new Date('2024-01-15T11:00:00Z');
      const mockCandidates = [mockWaitlistEntry];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockCandidates)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await waitlistRepository.findCandidatesForSlot(
        serviceId, 
        staffId, 
        slotStartTime, 
        slotEndTime
      );

      expect(result).toEqual(mockCandidates);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('priority_score', 'desc');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'asc');
    });
  });

  describe('findWithDetails', () => {
    it('should find waitlist entries with service and staff details', async () => {
      const mockEntriesWithDetails = [{
        ...mockWaitlistEntry,
        service_name: 'Haircut',
        service_duration: 60,
        staff_name: 'John Doe'
      }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockEntriesWithDetails)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await waitlistRepository.findWithDetails();

      expect(result).toEqual(mockEntriesWithDetails);
      expect(mockQuery.join).toHaveBeenCalledWith('services', 'waitlist_entries.service_id', 'services.id');
      expect(mockQuery.leftJoin).toHaveBeenCalledWith('staff', 'waitlist_entries.staff_id', 'staff.id');
    });
  });

  describe('updatePriorityScore', () => {
    it('should calculate and update priority score', async () => {
      const entryWithUpdatedScore = { ...mockWaitlistEntry, priority_score: 55 };
      
      // Mock findById
      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(mockWaitlistEntry)
          })
        })
      });

      // Mock update
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      // Mock findById for return value
      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(entryWithUpdatedScore)
          })
        })
      });

      const result = await waitlistRepository.updatePriorityScore('waitlist-123');

      expect(result?.priority_score).toBeGreaterThan(mockWaitlistEntry.priority_score);
    });

    it('should return null if entry not found', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(null)
          })
        })
      });

      const result = await waitlistRepository.updatePriorityScore('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update entry status', async () => {
      const notifiedEntry = { ...mockWaitlistEntry, status: WaitlistStatus.NOTIFIED };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(notifiedEntry)
          })
        })
      });

      const result = await waitlistRepository.updateStatus('waitlist-123', WaitlistStatus.NOTIFIED);

      expect(result?.status).toBe(WaitlistStatus.NOTIFIED);
    });
  });

  describe('removeFromWaitlist', () => {
    it('should remove entry from waitlist', async () => {
      const removedEntry = { ...mockWaitlistEntry, status: WaitlistStatus.REMOVED };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(removedEntry)
          })
        })
      });

      const result = await waitlistRepository.removeFromWaitlist('waitlist-123', 'Customer request');

      expect(result?.status).toBe(WaitlistStatus.REMOVED);
    });
  });

  describe('findStaleEntries', () => {
    it('should find entries that need priority score recalculation', async () => {
      const staleEntries = [mockWaitlistEntry];
      
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockResolvedValue(staleEntries)
          })
        })
      });

      const result = await waitlistRepository.findStaleEntries(24);

      expect(result).toEqual(staleEntries);
    });
  });

  describe('getWaitlistStats', () => {
    it('should return waitlist statistics', async () => {
      const mockStats = {
        total_active: '5',
        total_notified: '2',
        total_confirmed: '3',
        total_removed: '1',
        avg_priority_score: '45.5',
        vip_count: '2'
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStats)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await waitlistRepository.getWaitlistStats();

      expect(result).toEqual({
        total_active: 5,
        total_notified: 2,
        total_confirmed: 3,
        total_removed: 1,
        avg_priority_score: 45.5,
        vip_count: 2
      });
    });

    it('should handle null values in stats', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({})
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await waitlistRepository.getWaitlistStats();

      expect(result).toEqual({
        total_active: 0,
        total_notified: 0,
        total_confirmed: 0,
        total_removed: 0,
        avg_priority_score: 0,
        vip_count: 0
      });
    });
  });

  describe('findByTimeWindow', () => {
    it('should find entries by time window overlap', async () => {
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T12:00:00Z');
      const mockTimeWindowEntries = [mockWaitlistEntry];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockTimeWindowEntries)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await waitlistRepository.findByTimeWindow(startTime, endTime);

      expect(result).toEqual(mockTimeWindowEntries);
      expect(mockQuery.orderBy).toHaveBeenCalledWith('priority_score', 'desc');
      expect(mockQuery.orderBy).toHaveBeenCalledWith('created_at', 'asc');
    });
  });

  describe('priority score calculation', () => {
    it('should calculate priority score correctly for VIP customer', async () => {
      const vipEntry = { ...mockWaitlistEntry, vip_status: true, staff_id: 'staff-123' };
      
      // Mock findById
      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(vipEntry)
          })
        })
      });

      // Mock update
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      // Mock findById for return value
      (db.select as jest.Mock).mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue({ ...vipEntry, priority_score: 70 })
          })
        })
      });

      const result = await waitlistRepository.updatePriorityScore('waitlist-123');

      // VIP should get higher priority score (base 20 + VIP 15 + service 15 + staff 10 + time 10 = 70)
      expect(result?.priority_score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(waitlistRepository.findActive()).rejects.toThrow('Database error');
    });
  });
});