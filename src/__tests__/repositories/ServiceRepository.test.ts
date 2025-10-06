import { ServiceRepository } from '../../repositories/ServiceRepository';
import { Service } from '../../models';
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
  join: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  sum: jest.fn().mockReturnThis(),
  raw: jest.fn(),
  __esModule: true,
  default: jest.fn()
}));

describe('ServiceRepository', () => {
  let serviceRepository: ServiceRepository;
  const mockTenantId = 'tenant-123';
  const mockService: Service = {
    id: 'service-123',
    tenant_id: mockTenantId,
    name: 'Haircut',
    duration_minutes: 60,
    price: 50.00,
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    serviceRepository = new ServiceRepository(mockTenantId);
    jest.clearAllMocks();
  });

  describe('findActive', () => {
    it('should find all active services', async () => {
      const mockActiveServices = [mockService];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue(mockActiveServices)
        })
      });

      const result = await serviceRepository.findActive();

      expect(result).toEqual(mockActiveServices);
      expect(db.select).toHaveBeenCalledWith('*');
    });
  });

  describe('findByName', () => {
    it('should find service by name', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(mockService)
          })
        })
      });

      const result = await serviceRepository.findByName('Haircut');

      expect(result).toEqual(mockService);
    });

    it('should return null if service not found', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            first: jest.fn().mockResolvedValue(undefined)
          })
        })
      });

      const result = await serviceRepository.findByName('Non Existent');

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

      const result = await serviceRepository.isNameAvailable('Available Service');

      expect(result).toBe(true);
    });

    it('should return false if name is taken', async () => {
      const mockDb = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({ count: '1' })
      };
      (db as any).mockReturnValue(mockDb);

      const result = await serviceRepository.isNameAvailable('Taken Service');

      expect(result).toBe(false);
    });
  });

  describe('findByDurationRange', () => {
    it('should find services within duration range', async () => {
      const mockServices = [mockService];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({
              andWhere: jest.fn().mockReturnValue({
                andWhere: jest.fn().mockResolvedValue(mockServices)
              })
            })
          })
        })
      });

      const result = await serviceRepository.findByDurationRange(30, 90);

      expect(result).toEqual(mockServices);
    });
  });

  describe('findByPriceRange', () => {
    it('should find services within price range', async () => {
      const mockServices = [mockService];
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            andWhere: jest.fn().mockReturnValue({
              andWhere: jest.fn().mockReturnValue({
                andWhere: jest.fn().mockResolvedValue(mockServices)
              })
            })
          })
        })
      });

      const result = await serviceRepository.findByPriceRange(25, 75);

      expect(result).toEqual(mockServices);
    });
  });

  describe('findWithWaitlistCounts', () => {
    it('should find services with their waitlist entry counts', async () => {
      const mockServicesWithCounts = [
        { ...mockService, waitlist_entries: 3 }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue(mockServicesWithCounts)
      };
      (db as any).mockReturnValue(mockQuery);

      const result = await serviceRepository.findWithWaitlistCounts();

      expect(result).toEqual(mockServicesWithCounts);
      expect(mockQuery.leftJoin).toHaveBeenCalled();
      expect(mockQuery.groupBy).toHaveBeenCalledWith('services.id');
    });
  });

  describe('getServiceStats', () => {
    it('should return service statistics', async () => {
      const mockSlotStats = { total_slots: '10', booked_slots: '7' };
      const mockWaitlistCount = { count: '5' };
      const mockRevenueStats = { total_revenue: '350.00' };

      // Mock Promise.all results
      const mockPromiseAll = jest.spyOn(Promise, 'all').mockResolvedValue([
        mockSlotStats,
        mockWaitlistCount,
        mockRevenueStats
      ]);

      // Mock individual queries
      const mockSlotQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockSlotStats)
      };

      const mockWaitlistQuery = {
        where: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockWaitlistCount)
      };

      const mockRevenueQuery = {
        join: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        sum: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockRevenueStats)
      };

      (db as any)
        .mockReturnValueOnce(mockSlotQuery)
        .mockReturnValueOnce(mockWaitlistQuery)
        .mockReturnValueOnce(mockRevenueQuery);

      const result = await serviceRepository.getServiceStats('service-123');

      expect(result).toEqual({
        total_slots: 10,
        booked_slots: 7,
        active_waitlist: 5,
        total_revenue: 350.00
      });

      mockPromiseAll.mockRestore();
    });

    it('should handle null/undefined values in stats', async () => {
      const mockPromiseAll = jest.spyOn(Promise, 'all').mockResolvedValue([
        { total_slots: null, booked_slots: null },
        { count: null },
        { total_revenue: null }
      ]);

      // Mock queries
      (db as any).mockReturnValue({
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        join: jest.fn().mockReturnThis(),
        sum: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue({})
      });

      const result = await serviceRepository.getServiceStats('service-123');

      expect(result).toEqual({
        total_slots: 0,
        booked_slots: 0,
        active_waitlist: 0,
        total_revenue: 0
      });

      mockPromiseAll.mockRestore();
    });
  });

  describe('deactivate', () => {
    it('should deactivate service', async () => {
      const deactivatedService = { ...mockService, active: false };
      
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
            first: jest.fn().mockResolvedValue(deactivatedService)
          })
        })
      });

      const result = await serviceRepository.deactivate('service-123');

      expect(result).toEqual(deactivatedService);
    });
  });

  describe('reactivate', () => {
    it('should reactivate service', async () => {
      const reactivatedService = { ...mockService, active: true };
      
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
            first: jest.fn().mockResolvedValue(reactivatedService)
          })
        })
      });

      const result = await serviceRepository.reactivate('service-123');

      expect(result).toEqual(reactivatedService);
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Database error'))
        })
      });

      await expect(serviceRepository.findActive()).rejects.toThrow('Database error');
    });
  });
});