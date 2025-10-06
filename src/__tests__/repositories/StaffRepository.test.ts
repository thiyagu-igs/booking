import { StaffRepository } from '../../repositories/StaffRepository';
import { Staff } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection', () => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  whereNot: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  first: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  into: jest.fn(),
  update: jest.fn(),
  del: jest.fn(),
  count: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  raw: jest.fn(),
  __esModule: true,
  default: jest.fn()
}));

describe('StaffRepository', () => {
  let staffRepository: StaffRepository;
  const mockTenantId = 'tenant-123';
  const mockStaff: Staff = {
    id: 'staff-123',
    tenant_id: mockTenantId,
    name: 'John Doe',
    role: 'Stylist',
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    staffRepository = new StaffRepository(mockTenantId);
    jest.clearAllMocks();
  });

  describe('findActive', () => {
    it('should find all active staff members', async () => {
      const mockActiveStaff = [mockStaff];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockActiveStaff)
        })
      });

      const result = await staffRepository.findActive();

      expect(result).toEqual(mockActiveStaff);
      expect(db.select).toHaveBeenCalledWith('*');
    });
  });

  describe('findByName', () => {
    it('should find staff by name', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(mockStaff)
          })
        })
      });

      const result = await staffRepository.findByName('John Doe');

      expect(result).toEqual(mockStaff);
    });

    it('should return null if staff not found', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(undefined)
          })
        })
      });

      const result = await staffRepository.findByName('Non Existent');

      expect(result).toBeNull();
    });
  });

  describe('isNameAvailable', () => {
    it('should return true if name is available', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await staffRepository.isNameAvailable('Available Name');

      expect(result).toBe(true);
    });

    it('should return false if name is taken', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '1' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await staffRepository.isNameAvailable('Taken Name');

      expect(result).toBe(false);
    });

    it('should exclude specific ID when checking availability', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        whereNot: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '0' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await staffRepository.isNameAvailable('Name', 'exclude-id');

      expect(result).toBe(true);
      expect(mockDb.whereNot).toHaveBeenCalledWith({ id: 'exclude-id' });
    });
  });

  describe('deactivate', () => {
    it('should deactivate staff member', async () => {
      const deactivatedStaff = { ...mockStaff, active: false };
      
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
            first: jest.fn().mockResolvedValue(deactivatedStaff)
          })
        })
      });

      const result = await staffRepository.deactivate('staff-123');

      expect(result).toEqual(deactivatedStaff);
    });
  });

  describe('reactivate', () => {
    it('should reactivate staff member', async () => {
      const reactivatedStaff = { ...mockStaff, active: true };
      
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
            first: jest.fn().mockResolvedValue(reactivatedStaff)
          })
        })
      });

      const result = await staffRepository.reactivate('staff-123');

      expect(result).toEqual(reactivatedStaff);
    });
  });

  describe('findWithSlotCounts', () => {
    it('should find staff with their upcoming slot counts', async () => {
      const mockStaffWithCounts = [
        { ...mockStaff, upcoming_slots: 5 }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue(mockStaffWithCounts)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await staffRepository.findWithSlotCounts();

      expect(result).toEqual(mockStaffWithCounts);
      expect(mockQuery.leftJoin).toHaveBeenCalled();
      expect(mockQuery.groupBy).toHaveBeenCalledWith('staff.id');
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockStaffWithCounts = [{ ...mockStaff, upcoming_slots: 3 }];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue(mockStaffWithCounts)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await staffRepository.findWithSlotCounts(startDate, endDate);

      expect(result).toEqual(mockStaffWithCounts);
      expect(mockQuery.andWhere).toHaveBeenCalledWith('slots.start_time', '>=', startDate);
      expect(mockQuery.andWhere).toHaveBeenCalledWith('slots.start_time', '<=', endDate);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(staffRepository.findActive()).rejects.toThrow('Database error');
    });
  });
});