import { WaitlistService, CreateWaitlistEntryData } from '../../services/WaitlistService';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { WaitlistEntry, WaitlistStatus, Service, Staff } from '../../models';

// Mock repositories
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');

describe('WaitlistService', () => {
  let waitlistService: WaitlistService;
  let mockWaitlistRepo: jest.Mocked<WaitlistRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;

  const mockTenantId = 'tenant-123';

  beforeEach(() => {
    mockWaitlistRepo = new WaitlistRepository(mockTenantId) as jest.Mocked<WaitlistRepository>;
    mockServiceRepo = new ServiceRepository(mockTenantId) as jest.Mocked<ServiceRepository>;
    mockStaffRepo = new StaffRepository(mockTenantId) as jest.Mocked<StaffRepository>;

    waitlistService = new WaitlistService(mockWaitlistRepo, mockServiceRepo, mockStaffRepo);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createWaitlistEntry', () => {
    const futureDate1 = new Date();
    futureDate1.setHours(futureDate1.getHours() + 2);
    const futureDate2 = new Date();
    futureDate2.setHours(futureDate2.getHours() + 10);

    const validEntryData: CreateWaitlistEntryData = {
      customer_name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      service_id: 'service-123',
      staff_id: 'staff-123',
      earliest_time: futureDate1,
      latest_time: futureDate2,
      vip_status: false
    };

    const mockService: Service = {
      id: 'service-123',
      tenant_id: mockTenantId,
      name: 'Haircut',
      duration_minutes: 60,
      price: 50,
      active: true,
      created_at: new Date(),
    };

    const mockStaff: Staff = {
      id: 'staff-123',
      tenant_id: mockTenantId,
      name: 'Jane Smith',
      role: 'Stylist',
      active: true,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockWaitlistRepo.countActiveByPhone.mockResolvedValue(0);
    });

    it('should create a waitlist entry successfully', async () => {
      const mockCreatedEntry: WaitlistEntry = {
        id: 'entry-123',
        tenant_id: mockTenantId,
        customer_name: validEntryData.customer_name,
        phone: validEntryData.phone,
        email: validEntryData.email,
        service_id: validEntryData.service_id,
        staff_id: validEntryData.staff_id,
        earliest_time: validEntryData.earliest_time,
        latest_time: validEntryData.latest_time,
        priority_score: 55, // Base(20) + Service(15) + Staff(10) + Time(10)
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
      };

      mockWaitlistRepo.create.mockResolvedValue(mockCreatedEntry);

      const result = await waitlistService.createWaitlistEntry(validEntryData);

      expect(result).toEqual(mockCreatedEntry);
      expect(mockServiceRepo.findById).toHaveBeenCalledWith(validEntryData.service_id);
      expect(mockStaffRepo.findById).toHaveBeenCalledWith(validEntryData.staff_id);
      expect(mockWaitlistRepo.countActiveByPhone).toHaveBeenCalledWith(validEntryData.phone);
      expect(mockWaitlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_name: validEntryData.customer_name,
          phone: validEntryData.phone,
          service_id: validEntryData.service_id,
          staff_id: validEntryData.staff_id,
          status: WaitlistStatus.ACTIVE,
          priority_score: expect.any(Number)
        })
      );
    });

    it('should throw error if service not found', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      await expect(waitlistService.createWaitlistEntry(validEntryData))
        .rejects.toThrow('Service not found or inactive');
    });

    it('should throw error if service is inactive', async () => {
      mockServiceRepo.findById.mockResolvedValue({ ...mockService, active: false });

      await expect(waitlistService.createWaitlistEntry(validEntryData))
        .rejects.toThrow('Service not found or inactive');
    });

    it('should throw error if staff not found', async () => {
      mockStaffRepo.findById.mockResolvedValue(null);

      await expect(waitlistService.createWaitlistEntry(validEntryData))
        .rejects.toThrow('Staff member not found or inactive');
    });

    it('should throw error if staff is inactive', async () => {
      mockStaffRepo.findById.mockResolvedValue({ ...mockStaff, active: false });

      await expect(waitlistService.createWaitlistEntry(validEntryData))
        .rejects.toThrow('Staff member not found or inactive');
    });

    it('should throw error if maximum entries exceeded', async () => {
      mockWaitlistRepo.countActiveByPhone.mockResolvedValue(3);

      await expect(waitlistService.createWaitlistEntry(validEntryData))
        .rejects.toThrow('Maximum 3 active waitlist entries allowed per phone number');
    });

    it('should throw error if earliest time is after latest time', async () => {
      const invalidData = {
        ...validEntryData,
        earliest_time: new Date('2024-01-15T18:00:00Z'),
        latest_time: new Date('2024-01-15T10:00:00Z')
      };

      await expect(waitlistService.createWaitlistEntry(invalidData))
        .rejects.toThrow('Earliest time must be before latest time');
    });

    it('should throw error if time window is in the past', async () => {
      const pastDate1 = new Date();
      pastDate1.setHours(pastDate1.getHours() - 2);
      const pastDate2 = new Date();
      pastDate2.setHours(pastDate2.getHours() - 1);

      const invalidData = {
        ...validEntryData,
        earliest_time: pastDate1,
        latest_time: pastDate2
      };

      await expect(waitlistService.createWaitlistEntry(invalidData))
        .rejects.toThrow('Time window must be in the future');
    });

    it('should work without staff preference', async () => {
      const dataWithoutStaff = { ...validEntryData, staff_id: undefined };
      const mockCreatedEntry: WaitlistEntry = {
        id: 'entry-123',
        tenant_id: mockTenantId,
        customer_name: dataWithoutStaff.customer_name,
        phone: dataWithoutStaff.phone,
        email: dataWithoutStaff.email,
        service_id: dataWithoutStaff.service_id,
        staff_id: undefined,
        earliest_time: dataWithoutStaff.earliest_time,
        latest_time: dataWithoutStaff.latest_time,
        priority_score: 45, // Base(20) + Service(15) + Time(10), no staff bonus
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
      };

      mockWaitlistRepo.create.mockResolvedValue(mockCreatedEntry);

      const result = await waitlistService.createWaitlistEntry(dataWithoutStaff);

      expect(result).toEqual(mockCreatedEntry);
      expect(mockStaffRepo.findById).not.toHaveBeenCalled();
    });
  });

  describe('priority scoring', () => {
    const futureDate1 = new Date();
    futureDate1.setHours(futureDate1.getHours() + 2);
    const futureDate2 = new Date();
    futureDate2.setHours(futureDate2.getHours() + 10);

    const baseEntryData: CreateWaitlistEntryData = {
      customer_name: 'John Doe',
      phone: '+1234567890',
      service_id: 'service-123',
      earliest_time: futureDate1,
      latest_time: futureDate2,
    };

    const mockService: Service = {
      id: 'service-123',
      tenant_id: mockTenantId,
      name: 'Haircut',
      duration_minutes: 60,
      active: true,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockWaitlistRepo.countActiveByPhone.mockResolvedValue(0);
    });

    it('should calculate correct priority score for VIP customer', async () => {
      const vipData = { ...baseEntryData, vip_status: true };
      
      mockWaitlistRepo.create.mockImplementation((data) => 
        Promise.resolve({ ...data, id: 'entry-123' } as WaitlistEntry)
      );

      await waitlistService.createWaitlistEntry(vipData);

      expect(mockWaitlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority_score: 60 // Base(20) + VIP(15) + Service(15) + Time(10)
        })
      );
    });

    it('should calculate correct priority score with staff preference', async () => {
      const staffData = { ...baseEntryData, staff_id: 'staff-123' };
      const mockStaff: Staff = {
        id: 'staff-123',
        tenant_id: mockTenantId,
        name: 'Jane Smith',
        active: true,
        created_at: new Date(),
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockWaitlistRepo.create.mockImplementation((data) => 
        Promise.resolve({ ...data, id: 'entry-123' } as WaitlistEntry)
      );

      await waitlistService.createWaitlistEntry(staffData);

      expect(mockWaitlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority_score: 55 // Base(20) + Service(15) + Staff(10) + Time(10)
        })
      );
    });

    it('should calculate correct priority score for VIP with staff preference', async () => {
      const vipStaffData = { ...baseEntryData, vip_status: true, staff_id: 'staff-123' };
      const mockStaff: Staff = {
        id: 'staff-123',
        tenant_id: mockTenantId,
        name: 'Jane Smith',
        active: true,
        created_at: new Date(),
      };

      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockWaitlistRepo.create.mockImplementation((data) => 
        Promise.resolve({ ...data, id: 'entry-123' } as WaitlistEntry)
      );

      await waitlistService.createWaitlistEntry(vipStaffData);

      expect(mockWaitlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority_score: 70 // Base(20) + VIP(15) + Service(15) + Staff(10) + Time(10)
        })
      );
    });

    it('should calculate minimum priority score for basic entry', async () => {
      mockWaitlistRepo.create.mockImplementation((data) => 
        Promise.resolve({ ...data, id: 'entry-123' } as WaitlistEntry)
      );

      await waitlistService.createWaitlistEntry(baseEntryData);

      expect(mockWaitlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          priority_score: 45 // Base(20) + Service(15) + Time(10)
        })
      );
    });
  });

  describe('getWaitlistEntries', () => {
    it('should return paginated waitlist entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          customer_name: 'John Doe',
          priority_score: 70,
          service_name: 'Haircut',
          service_duration: 60,
          created_at: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'entry-2',
          customer_name: 'Jane Smith',
          priority_score: 65,
          service_name: 'Color',
          service_duration: 120,
          created_at: new Date('2024-01-15T11:00:00Z')
        }
      ];

      mockWaitlistRepo.findWithDetails.mockResolvedValue(mockEntries as any);

      const result = await waitlistService.getWaitlistEntries(
        { status: WaitlistStatus.ACTIVE },
        { page: 1, limit: 10 }
      );

      expect(result.entries).toEqual(mockEntries);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total_pages).toBe(1);
    });

    it('should apply pagination correctly', async () => {
      const mockEntries = Array.from({ length: 25 }, (_, i) => ({
        id: `entry-${i}`,
        customer_name: `Customer ${i}`,
        priority_score: 75 - i, // Descending scores so sorting works correctly
        service_name: 'Service',
        service_duration: 60,
        created_at: new Date()
      }));

      mockWaitlistRepo.findWithDetails.mockResolvedValue(mockEntries as any);

      const result = await waitlistService.getWaitlistEntries(
        {},
        { page: 2, limit: 10 }
      );

      expect(result.entries).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.total_pages).toBe(3);
      // Page 2 with limit 10 should start at index 10 (entries 10-19)
      expect(result.entries[0].id).toBe('entry-10');
    });
  });

  describe('removeFromWaitlist', () => {
    const mockEntry: WaitlistEntry = {
      id: 'entry-123',
      tenant_id: mockTenantId,
      customer_name: 'John Doe',
      phone: '+1234567890',
      service_id: 'service-123',
      earliest_time: new Date(),
      latest_time: new Date(),
      priority_score: 50,
      vip_status: false,
      status: WaitlistStatus.ACTIVE,
      created_at: new Date(),
    };

    it('should remove entry from waitlist successfully', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(mockEntry);
      mockWaitlistRepo.updateStatus.mockResolvedValue({ ...mockEntry, status: WaitlistStatus.REMOVED });

      const result = await waitlistService.removeFromWaitlist('entry-123', 'Customer request');

      expect(result?.status).toBe(WaitlistStatus.REMOVED);
      expect(mockWaitlistRepo.updateStatus).toHaveBeenCalledWith('entry-123', WaitlistStatus.REMOVED);
    });

    it('should throw error if entry not found', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(null);

      await expect(waitlistService.removeFromWaitlist('entry-123'))
        .rejects.toThrow('Waitlist entry not found');
    });

    it('should throw error if entry already removed', async () => {
      mockWaitlistRepo.findById.mockResolvedValue({ ...mockEntry, status: WaitlistStatus.REMOVED });

      await expect(waitlistService.removeFromWaitlist('entry-123'))
        .rejects.toThrow('Entry already removed from waitlist');
    });
  });

  describe('updateWaitlistEntry', () => {
    const mockEntry: WaitlistEntry = {
      id: 'entry-123',
      tenant_id: mockTenantId,
      customer_name: 'John Doe',
      phone: '+1234567890',
      service_id: 'service-123',
      earliest_time: new Date('2024-01-15T10:00:00Z'),
      latest_time: new Date('2024-01-15T18:00:00Z'),
      priority_score: 50,
      vip_status: false,
      status: WaitlistStatus.ACTIVE,
      created_at: new Date(),
    };

    const mockService: Service = {
      id: 'service-456',
      tenant_id: mockTenantId,
      name: 'Color',
      duration_minutes: 120,
      active: true,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockWaitlistRepo.findById.mockResolvedValue(mockEntry);
      mockServiceRepo.findById.mockResolvedValue(mockService);
    });

    it('should update entry successfully', async () => {
      const updates = { customer_name: 'John Smith', vip_status: true };
      const updatedEntry = { ...mockEntry, ...updates, priority_score: 60 }; // VIP bonus added (50 + 15 - 5 for no staff)

      mockWaitlistRepo.update.mockResolvedValue(updatedEntry);

      const result = await waitlistService.updateWaitlistEntry('entry-123', updates);

      expect(result).toEqual(updatedEntry);
      expect(mockWaitlistRepo.update).toHaveBeenCalledWith('entry-123', 
        expect.objectContaining({
          customer_name: 'John Smith',
          vip_status: true,
          priority_score: 60,
          updated_at: expect.any(Date)
        })
      );
    });

    it('should throw error if entry not found', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(null);

      await expect(waitlistService.updateWaitlistEntry('entry-123', {}))
        .rejects.toThrow('Waitlist entry not found');
    });

    it('should throw error if entry is not active', async () => {
      mockWaitlistRepo.findById.mockResolvedValue({ ...mockEntry, status: WaitlistStatus.CONFIRMED });

      await expect(waitlistService.updateWaitlistEntry('entry-123', {}))
        .rejects.toThrow('Can only update active waitlist entries');
    });

    it('should validate service when updating service_id', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      await expect(waitlistService.updateWaitlistEntry('entry-123', { service_id: 'invalid-service' }))
        .rejects.toThrow('Service not found or inactive');
    });

    it('should validate time window when updating times', async () => {
      const invalidUpdates = {
        earliest_time: new Date('2024-01-15T18:00:00Z'),
        latest_time: new Date('2024-01-15T10:00:00Z')
      };

      await expect(waitlistService.updateWaitlistEntry('entry-123', invalidUpdates))
        .rejects.toThrow('Earliest time must be before latest time');
    });
  });

  describe('recalculatePriorityScores', () => {
    it('should recalculate priority scores for all active entries', async () => {
      const mockActiveEntries: WaitlistEntry[] = [
        {
          id: 'entry-1',
          tenant_id: mockTenantId,
          customer_name: 'John Doe',
          phone: '+1234567890',
          service_id: 'service-123',
          staff_id: 'staff-123',
          earliest_time: new Date(),
          latest_time: new Date(),
          priority_score: 50,
          vip_status: true,
          status: WaitlistStatus.ACTIVE,
          created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
        },
        {
          id: 'entry-2',
          tenant_id: mockTenantId,
          customer_name: 'Jane Smith',
          phone: '+1234567891',
          service_id: 'service-123',
          earliest_time: new Date(),
          latest_time: new Date(),
          priority_score: 45,
          vip_status: false,
          status: WaitlistStatus.ACTIVE,
          created_at: new Date(),
        }
      ];

      mockWaitlistRepo.findActive.mockResolvedValue(mockActiveEntries);
      mockWaitlistRepo.update.mockResolvedValue({} as WaitlistEntry);

      const result = await waitlistService.recalculatePriorityScores();

      expect(result).toBe(1); // Only entry-1 should be updated (gets recency bonus)
      expect(mockWaitlistRepo.update).toHaveBeenCalledWith('entry-1', 
        expect.objectContaining({
          priority_score: 71 // Base(20) + VIP(15) + Service(15) + Staff(10) + Time(10) + Recency(1)
        })
      );
    });
  });
});