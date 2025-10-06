import { SlotRepository } from '../../repositories/SlotRepository';
import { Slot, SlotStatus } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection', () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  andWhereNot: jest.fn().mockReturnThis(),
  orWhere: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  into: jest.fn(),
  update: jest.fn(),
  del: jest.fn(),
  count: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  join: jest.fn().mockReturnThis(),
  raw: jest.fn(),
  __esModule: true,
  default: jest.fn()
}));

describe('SlotRepository', () => {
  let slotRepository: SlotRepository;
  const mockTenantId = 'tenant-123';
  const mockSlot: Slot = {
    id: 'slot-123',
    tenant_id: mockTenantId,
    staff_id: 'staff-123',
    service_id: 'service-123',
    start_time: new Date('2024-01-15T10:00:00Z'),
    end_time: new Date('2024-01-15T11:00:00Z'),
    status: SlotStatus.OPEN,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    slotRepository = new SlotRepository(mockTenantId);
    jest.clearAllMocks();
  });

  describe('findByStatus', () => {
    it('should find slots by status', async () => {
      const mockSlots = [mockSlot];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockSlots)
        })
      });

      const result = await slotRepository.findByStatus(SlotStatus.OPEN);

      expect(result).toEqual(mockSlots);
    });
  });

  describe('findOpen', () => {
    it('should find open slots', async () => {
      const mockOpenSlots = [mockSlot];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockOpenSlots)
        })
      });

      const result = await slotRepository.findOpen();

      expect(result).toEqual(mockOpenSlots);
    });
  });

  describe('findByStaff', () => {
    it('should find slots by staff member', async () => {
      const mockStaffSlots = [mockSlot];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockStaffSlots)
        })
      });

      const result = await slotRepository.findByStaff('staff-123');

      expect(result).toEqual(mockStaffSlots);
    });
  });

  describe('findByService', () => {
    it('should find slots by service', async () => {
      const mockServiceSlots = [mockSlot];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockServiceSlots)
        })
      });

      const result = await slotRepository.findByService('service-123');

      expect(result).toEqual(mockServiceSlots);
    });
  });

  describe('findByDateRange', () => {
    it('should find slots within date range', async () => {
      const startDate = new Date('2024-01-15T00:00:00Z');
      const endDate = new Date('2024-01-15T23:59:59Z');
      const mockDateSlots = [mockSlot];

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({
              andWhere: jest.fn().mockReturnValue({
                orderBy: jest.fn().mockResolvedValue(mockDateSlots)
              })
            })
          })
        })
      });

      const result = await slotRepository.findByDateRange(startDate, endDate);

      expect(result).toEqual(mockDateSlots);
    });
  });

  describe('findWithDetails', () => {
    it('should find slots with staff and service details', async () => {
      const mockSlotsWithDetails = [{
        ...mockSlot,
        staff_name: 'John Doe',
        service_name: 'Haircut',
        service_duration: 60
      }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockResolvedValue(mockSlotsWithDetails)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await slotRepository.findWithDetails();

      expect(result).toEqual(mockSlotsWithDetails);
      expect(mockQuery.join).toHaveBeenCalledWith('staff', 'slots.staff_id', 'staff.id');
      expect(mockQuery.join).toHaveBeenCalledWith('services', 'slots.service_id', 'services.id');
    });
  });

  describe('findConflictingSlots', () => {
    it('should find conflicting slots for a staff member', async () => {
      const staffId = 'staff-123';
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');
      const mockConflictingSlots = [mockSlot];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        andWhereNot: jest.fn().mockResolvedValue(mockConflictingSlots)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await slotRepository.findConflictingSlots(staffId, startTime, endTime);

      expect(result).toEqual(mockConflictingSlots);
    });

    it('should exclude specific slot ID when finding conflicts', async () => {
      const staffId = 'staff-123';
      const startTime = new Date('2024-01-15T10:00:00Z');
      const endTime = new Date('2024-01-15T11:00:00Z');
      const excludeId = 'slot-456';

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        andWhereNot: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockResolvedValue([])
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await slotRepository.findConflictingSlots(staffId, startTime, endTime, excludeId);

      expect(mockQuery.whereNot).toHaveBeenCalledWith('id', excludeId);
    });
  });

  describe('holdSlot', () => {
    it('should hold a slot with default duration', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD, hold_expires_at: new Date() };
      
      // Mock the update method
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      // Mock findById for the return value
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(heldSlot)
          })
        })
      });

      const result = await slotRepository.holdSlot('slot-123');

      expect(result?.status).toBe(SlotStatus.HELD);
      expect(result?.hold_expires_at).toBeDefined();
    });

    it('should hold a slot with custom duration', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD, hold_expires_at: new Date() };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(heldSlot)
          })
        })
      });

      const result = await slotRepository.holdSlot('slot-123', 15);

      expect(result?.status).toBe(SlotStatus.HELD);
    });
  });

  describe('releaseHold', () => {
    it('should release held slot back to open status', async () => {
      const releasedSlot = { ...mockSlot, status: SlotStatus.OPEN, hold_expires_at: null };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(releasedSlot)
          })
        })
      });

      const result = await slotRepository.releaseHold('slot-123');

      expect(result?.status).toBe(SlotStatus.OPEN);
      expect(result?.hold_expires_at).toBeNull();
    });
  });

  describe('bookSlot', () => {
    it('should book a slot', async () => {
      const bookedSlot = { ...mockSlot, status: SlotStatus.BOOKED, hold_expires_at: null };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(bookedSlot)
          })
        })
      });

      const result = await slotRepository.bookSlot('slot-123');

      expect(result?.status).toBe(SlotStatus.BOOKED);
      expect(result?.hold_expires_at).toBeNull();
    });
  });

  describe('cancelSlot', () => {
    it('should cancel a slot', async () => {
      const canceledSlot = { ...mockSlot, status: SlotStatus.CANCELED, hold_expires_at: null };
      
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(1)
      };
      (db as any).mockReturnValue(mockDb);

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(canceledSlot)
          })
        })
      });

      const result = await slotRepository.cancelSlot('slot-123');

      expect(result?.status).toBe(SlotStatus.CANCELED);
      expect(result?.hold_expires_at).toBeNull();
    });
  });

  describe('findExpiredHolds', () => {
    it('should find expired held slots', async () => {
      const expiredSlot = { ...mockSlot, status: SlotStatus.HELD, hold_expires_at: new Date(Date.now() - 60000) };
      
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({
              andWhere: jest.fn().mockResolvedValue([expiredSlot])
            })
          })
        })
      });

      const result = await slotRepository.findExpiredHolds();

      expect(result).toEqual([expiredSlot]);
    });
  });

  describe('releaseExpiredHolds', () => {
    it('should release all expired holds and return count', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(3)
      };
      (db as any).mockReturnValue(mockDb);

      const result = await slotRepository.releaseExpiredHolds();

      expect(result).toBe(3);
    });
  });

  describe('getSlotStats', () => {
    it('should return slot statistics for date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockStats = {
        total_slots: '10',
        open_slots: '3',
        held_slots: '2',
        booked_slots: '4',
        canceled_slots: '1'
      };

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockStats)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await slotRepository.getSlotStats(startDate, endDate);

      expect(result).toEqual({
        total_slots: 10,
        open_slots: 3,
        held_slots: 2,
        booked_slots: 4,
        canceled_slots: 1
      });
    });

    it('should handle null values in stats', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({})
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await slotRepository.getSlotStats(startDate, endDate);

      expect(result).toEqual({
        total_slots: 0,
        open_slots: 0,
        held_slots: 0,
        booked_slots: 0,
        canceled_slots: 0
      });
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(slotRepository.findOpen()).rejects.toThrow('Database error');
    });
  });
});