import { SlotService } from '../../services/SlotService';
import { WaitlistService } from '../../services/WaitlistService';
import { SlotRepository } from '../../repositories/SlotRepository';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { Slot, SlotStatus, WaitlistEntry, WaitlistStatus, Service, Staff } from '../../models';

// Mock repositories
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../services/WaitlistService');

describe('SlotService', () => {
  let slotService: SlotService;
  let mockSlotRepo: jest.Mocked<SlotRepository>;
  let mockWaitlistRepo: jest.Mocked<WaitlistRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockWaitlistService: jest.Mocked<WaitlistService>;

  const mockTenantId = 'tenant-123';
  const mockServiceId = 'service-123';
  const mockStaffId = 'staff-123';
  const mockSlotId = 'slot-123';

  const mockService: Service = {
    id: mockServiceId,
    tenant_id: mockTenantId,
    name: 'Haircut',
    duration_minutes: 60,
    price: 50,
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockStaff: Staff = {
    id: mockStaffId,
    tenant_id: mockTenantId,
    name: 'John Stylist',
    role: 'Senior Stylist',
    active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockSlot: Slot = {
    id: mockSlotId,
    tenant_id: mockTenantId,
    staff_id: mockStaffId,
    service_id: mockServiceId,
    start_time: new Date('2030-01-15T10:00:00Z'),
    end_time: new Date('2030-01-15T11:00:00Z'),
    status: SlotStatus.OPEN,
    created_at: new Date(),
    updated_at: new Date()
  };

  const mockWaitlistEntry: WaitlistEntry = {
    id: 'waitlist-123',
    tenant_id: mockTenantId,
    customer_name: 'Jane Doe',
    phone: '+1234567890',
    email: 'jane@example.com',
    service_id: mockServiceId,
    staff_id: mockStaffId,
    earliest_time: new Date('2024-01-15T09:00:00Z'),
    latest_time: new Date('2024-01-15T12:00:00Z'),
    priority_score: 75,
    vip_status: true,
    status: WaitlistStatus.ACTIVE,
    created_at: new Date('2024-01-14T10:00:00Z'),
    updated_at: new Date('2024-01-14T10:00:00Z')
  };

  const mockSlotCandidate = {
    ...mockWaitlistEntry,
    service_name: 'Haircut',
    staff_name: 'John Stylist',
    match_score: 85
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock instances
    mockSlotRepo = new SlotRepository(mockTenantId) as jest.Mocked<SlotRepository>;
    mockWaitlistRepo = new WaitlistRepository(mockTenantId) as jest.Mocked<WaitlistRepository>;
    mockServiceRepo = new ServiceRepository(mockTenantId) as jest.Mocked<ServiceRepository>;
    mockStaffRepo = new StaffRepository(mockTenantId) as jest.Mocked<StaffRepository>;
    mockWaitlistService = new WaitlistService(mockWaitlistRepo, mockServiceRepo, mockStaffRepo) as jest.Mocked<WaitlistService>;

    // Create service instance
    slotService = new SlotService(
      mockSlotRepo,
      mockWaitlistRepo,
      mockServiceRepo,
      mockStaffRepo,
      mockWaitlistService
    );
  });

  describe('createSlot', () => {
    const createSlotData = {
      staff_id: mockStaffId,
      service_id: mockServiceId,
      start_time: new Date('2030-01-15T10:00:00Z'),
      end_time: new Date('2030-01-15T11:00:00Z')
    };

    it('should create a slot successfully', async () => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockSlotRepo.findConflictingSlots.mockResolvedValue([]);
      mockSlotRepo.create.mockResolvedValue(mockSlot);

      const result = await slotService.createSlot(createSlotData);

      expect(result).toEqual(mockSlot);
      expect(mockServiceRepo.findById).toHaveBeenCalledWith(mockServiceId);
      expect(mockStaffRepo.findById).toHaveBeenCalledWith(mockStaffId);
      expect(mockSlotRepo.findConflictingSlots).toHaveBeenCalledWith(
        mockStaffId,
        createSlotData.start_time,
        createSlotData.end_time
      );
      expect(mockSlotRepo.create).toHaveBeenCalledWith({
        staff_id: mockStaffId,
        service_id: mockServiceId,
        start_time: createSlotData.start_time,
        end_time: createSlotData.end_time,
        status: SlotStatus.OPEN
      });
    });

    it('should throw error if service not found', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      await expect(slotService.createSlot(createSlotData)).rejects.toThrow('Service not found or inactive');
    });

    it('should throw error if service is inactive', async () => {
      mockServiceRepo.findById.mockResolvedValue({ ...mockService, active: false });

      await expect(slotService.createSlot(createSlotData)).rejects.toThrow('Service not found or inactive');
    });

    it('should throw error if staff not found', async () => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(null);

      await expect(slotService.createSlot(createSlotData)).rejects.toThrow('Staff member not found or inactive');
    });

    it('should throw error if staff is inactive', async () => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue({ ...mockStaff, active: false });

      await expect(slotService.createSlot(createSlotData)).rejects.toThrow('Staff member not found or inactive');
    });

    it('should throw error if start time is after end time', async () => {
      const invalidData = {
        ...createSlotData,
        start_time: new Date('2025-01-15T11:00:00Z'),
        end_time: new Date('2025-01-15T10:00:00Z')
      };

      // Mock service and staff validation to pass
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);

      await expect(slotService.createSlot(invalidData)).rejects.toThrow('Start time must be before end time');
    });

    it('should throw error if slot is in the past', async () => {
      const pastData = {
        ...createSlotData,
        start_time: new Date('2020-01-15T10:00:00Z'),
        end_time: new Date('2020-01-15T11:00:00Z')
      };

      // Mock service and staff validation to pass
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);

      await expect(slotService.createSlot(pastData)).rejects.toThrow('Slot must be in the future');
    });

    it('should throw error if slot conflicts with existing booking', async () => {
      const futureData = {
        ...createSlotData,
        start_time: new Date('2030-01-15T10:00:00Z'),
        end_time: new Date('2030-01-15T11:00:00Z')
      };
      
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockSlotRepo.findConflictingSlots.mockResolvedValue([mockSlot]);

      await expect(slotService.createSlot(futureData)).rejects.toThrow('Slot conflicts with existing booking');
    });
  });

  describe('openSlot', () => {
    it('should open a canceled slot and find candidates', async () => {
      const canceledSlot = { ...mockSlot, status: SlotStatus.CANCELED };
      const updatedSlot = { ...mockSlot, status: SlotStatus.OPEN };

      mockSlotRepo.findById.mockResolvedValue(canceledSlot);
      mockSlotRepo.update.mockResolvedValue(updatedSlot);
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([mockWaitlistEntry]);
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockSlotRepo.holdSlot.mockResolvedValue({ ...updatedSlot, status: SlotStatus.HELD });
      mockWaitlistRepo.updateStatus.mockResolvedValue({ ...mockWaitlistEntry, status: WaitlistStatus.NOTIFIED });

      const result = await slotService.openSlot(mockSlotId);

      expect(result.slot).toEqual(updatedSlot);
      expect(result.candidates).toHaveLength(1);
      expect(result.top_candidate).toBeDefined();
      expect(result.notification_sent).toBe(true);
      expect(mockSlotRepo.holdSlot).toHaveBeenCalledWith(mockSlotId, 10);
      expect(mockWaitlistRepo.updateStatus).toHaveBeenCalledWith(mockWaitlistEntry.id, WaitlistStatus.NOTIFIED);
    });

    it('should open slot with no candidates', async () => {
      const canceledSlot = { ...mockSlot, status: SlotStatus.CANCELED };
      const updatedSlot = { ...mockSlot, status: SlotStatus.OPEN };

      mockSlotRepo.findById.mockResolvedValue(canceledSlot);
      mockSlotRepo.update.mockResolvedValue(updatedSlot);
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([]);

      const result = await slotService.openSlot(mockSlotId);

      expect(result.slot).toEqual(updatedSlot);
      expect(result.candidates).toHaveLength(0);
      expect(result.top_candidate).toBeUndefined();
      expect(result.notification_sent).toBe(false);
      expect(mockSlotRepo.holdSlot).not.toHaveBeenCalled();
    });

    it('should throw error if slot not found', async () => {
      mockSlotRepo.findById.mockResolvedValue(null);

      await expect(slotService.openSlot(mockSlotId)).rejects.toThrow('Slot not found');
    });

    it('should throw error if slot is already open', async () => {
      mockSlotRepo.findById.mockResolvedValue(mockSlot);

      await expect(slotService.openSlot(mockSlotId)).rejects.toThrow('Can only open canceled or held slots');
    });
  });

  describe('findCandidatesForSlot', () => {
    it('should find and rank candidates correctly', async () => {
      const candidates = [
        { ...mockWaitlistEntry, priority_score: 75, created_at: new Date('2024-01-14T10:00:00Z') },
        { ...mockWaitlistEntry, id: 'waitlist-456', priority_score: 80, created_at: new Date('2024-01-14T11:00:00Z') },
        { ...mockWaitlistEntry, id: 'waitlist-789', priority_score: 75, created_at: new Date('2024-01-14T09:00:00Z') }
      ];

      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue(candidates);
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);

      const result = await slotService.findCandidatesForSlot(mockSlot);

      expect(result).toHaveLength(3);
      // Should be sorted by priority_score desc, then created_at asc
      expect(result[0].priority_score).toBe(80);
      expect(result[1].id).toBe('waitlist-789'); // Earlier created_at with same priority
      expect(result[2].id).toBe('waitlist-123'); // Later created_at with same priority
    });

    it('should calculate match scores correctly', async () => {
      const candidateWithStaffPreference = { ...mockWaitlistEntry, staff_id: mockStaffId };
      const candidateWithoutStaffPreference = { ...mockWaitlistEntry, id: 'waitlist-456', staff_id: undefined };

      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([
        candidateWithStaffPreference,
        candidateWithoutStaffPreference
      ]);
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);

      const result = await slotService.findCandidatesForSlot(mockSlot);

      expect(result[0].match_score).toBeGreaterThan(result[1].match_score);
    });
  });

  describe('holdSlot', () => {
    it('should hold an open slot successfully', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD, hold_expires_at: new Date() };
      
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      mockSlotRepo.holdSlot.mockResolvedValue(heldSlot);

      const result = await slotService.holdSlot(mockSlotId, 15);

      expect(result).toEqual(heldSlot);
      expect(mockSlotRepo.holdSlot).toHaveBeenCalledWith(mockSlotId, 15);
    });

    it('should throw error if slot not found', async () => {
      mockSlotRepo.findById.mockResolvedValue(null);

      await expect(slotService.holdSlot(mockSlotId)).rejects.toThrow('Slot not found');
    });

    it('should throw error if slot is not open', async () => {
      const bookedSlot = { ...mockSlot, status: SlotStatus.BOOKED };
      mockSlotRepo.findById.mockResolvedValue(bookedSlot);

      await expect(slotService.holdSlot(mockSlotId)).rejects.toThrow('Can only hold open slots');
    });
  });

  describe('bookSlot', () => {
    it('should book an open slot successfully', async () => {
      const bookedSlot = { ...mockSlot, status: SlotStatus.BOOKED };
      
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      mockSlotRepo.bookSlot.mockResolvedValue(bookedSlot);

      const result = await slotService.bookSlot(mockSlotId);

      expect(result).toEqual(bookedSlot);
      expect(mockSlotRepo.bookSlot).toHaveBeenCalledWith(mockSlotId);
    });

    it('should book a held slot successfully', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD };
      const bookedSlot = { ...mockSlot, status: SlotStatus.BOOKED };
      
      mockSlotRepo.findById.mockResolvedValue(heldSlot);
      mockSlotRepo.bookSlot.mockResolvedValue(bookedSlot);

      const result = await slotService.bookSlot(mockSlotId);

      expect(result).toEqual(bookedSlot);
    });

    it('should throw error if slot not found', async () => {
      mockSlotRepo.findById.mockResolvedValue(null);

      await expect(slotService.bookSlot(mockSlotId)).rejects.toThrow('Slot not found');
    });

    it('should throw error if slot is already booked', async () => {
      const bookedSlot = { ...mockSlot, status: SlotStatus.BOOKED };
      mockSlotRepo.findById.mockResolvedValue(bookedSlot);

      await expect(slotService.bookSlot(mockSlotId)).rejects.toThrow('Can only book open or held slots');
    });
  });

  describe('processExpiredHolds', () => {
    it('should process expired holds and trigger cascade notifications', async () => {
      const expiredSlot1 = { ...mockSlot, id: 'slot-1', status: SlotStatus.HELD };
      const expiredSlot2 = { ...mockSlot, id: 'slot-2', status: SlotStatus.HELD };
      const expiredSlots = [expiredSlot1, expiredSlot2];

      mockSlotRepo.findExpiredHolds.mockResolvedValue(expiredSlots);
      mockSlotRepo.releaseHold.mockResolvedValue({ ...expiredSlot1, status: SlotStatus.OPEN });
      
      // Mock the openSlot method to simulate cascade notifications
      const mockOpenSlot = jest.spyOn(slotService, 'openSlot');
      mockOpenSlot.mockResolvedValueOnce({
        slot: { ...expiredSlot1, status: SlotStatus.OPEN },
        candidates: [mockSlotCandidate],
        top_candidate: mockSlotCandidate,
        notification_sent: true
      });
      mockOpenSlot.mockResolvedValueOnce({
        slot: { ...expiredSlot2, status: SlotStatus.OPEN },
        candidates: [],
        notification_sent: false
      });

      const result = await slotService.processExpiredHolds();

      expect(result.released_count).toBe(2);
      expect(result.cascade_notifications).toBe(1);
      expect(mockSlotRepo.releaseHold).toHaveBeenCalledTimes(2);
      expect(mockOpenSlot).toHaveBeenCalledTimes(2);

      mockOpenSlot.mockRestore();
    });
  });

  describe('handleCascadeNotification', () => {
    it('should handle cascade notification successfully', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD };

      mockSlotRepo.findById.mockResolvedValue(heldSlot);
      mockSlotRepo.releaseHold.mockResolvedValue({ ...heldSlot, status: SlotStatus.OPEN });
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([mockWaitlistEntry]);
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockSlotRepo.holdSlot.mockResolvedValue({ ...heldSlot, status: SlotStatus.HELD });
      mockWaitlistRepo.updateStatus.mockResolvedValue({ ...mockWaitlistEntry, status: WaitlistStatus.NOTIFIED });

      const result = await slotService.handleCascadeNotification(mockSlotId);

      expect(result).toBeDefined();
      expect(mockSlotRepo.releaseHold).toHaveBeenCalledWith(mockSlotId);
      expect(mockSlotRepo.holdSlot).toHaveBeenCalledWith(mockSlotId, 10);
      expect(mockWaitlistRepo.updateStatus).toHaveBeenCalledWith(mockWaitlistEntry.id, WaitlistStatus.NOTIFIED);
    });

    it('should return null if no candidates available', async () => {
      const heldSlot = { ...mockSlot, status: SlotStatus.HELD };

      mockSlotRepo.findById.mockResolvedValue(heldSlot);
      mockSlotRepo.releaseHold.mockResolvedValue({ ...heldSlot, status: SlotStatus.OPEN });
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([]);

      const result = await slotService.handleCascadeNotification(mockSlotId);

      expect(result).toBeNull();
      expect(mockSlotRepo.holdSlot).not.toHaveBeenCalled();
    });
  });

  describe('race condition prevention', () => {
    it('should handle concurrent booking attempts', async () => {
      // This test simulates race conditions by having multiple booking attempts
      const openSlot = { ...mockSlot, status: SlotStatus.OPEN };
      const bookedSlot = { ...openSlot, status: SlotStatus.BOOKED };
      
      // First call finds open slot and books it
      mockSlotRepo.findById.mockResolvedValueOnce(openSlot);
      mockSlotRepo.bookSlot.mockResolvedValueOnce(bookedSlot);
      
      // Second call finds already booked slot
      mockSlotRepo.findById.mockResolvedValueOnce(bookedSlot);

      const firstBooking = slotService.bookSlot(mockSlotId);
      
      const firstResult = await firstBooking;
      expect(firstResult?.status).toBe(SlotStatus.BOOKED);

      // Second booking should fail
      await expect(slotService.bookSlot(mockSlotId)).rejects.toThrow('Can only book open or held slots');
    });
  });

  describe('edge cases', () => {
    it('should handle slot with no matching candidates', async () => {
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([]);

      const result = await slotService.findCandidatesForSlot(mockSlot);

      expect(result).toHaveLength(0);
    });

    it('should handle multiple candidates with same priority score', async () => {
      const candidates = [
        { ...mockWaitlistEntry, id: 'waitlist-1', priority_score: 75, created_at: new Date('2024-01-14T10:00:00Z') },
        { ...mockWaitlistEntry, id: 'waitlist-2', priority_score: 75, created_at: new Date('2024-01-14T09:00:00Z') },
        { ...mockWaitlistEntry, id: 'waitlist-3', priority_score: 75, created_at: new Date('2024-01-14T11:00:00Z') }
      ];

      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue(candidates);

      const result = await slotService.findCandidatesForSlot(mockSlot);

      // Should be sorted by created_at asc when priority scores are equal
      expect(result[0].id).toBe('waitlist-2'); // Earliest
      expect(result[1].id).toBe('waitlist-1'); // Middle
      expect(result[2].id).toBe('waitlist-3'); // Latest
    });

    it('should handle slot updates with partial data', async () => {
      const updates = { 
        start_time: new Date('2030-01-15T09:00:00Z'),
        end_time: new Date('2030-01-15T10:00:00Z')
      };
      
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      mockSlotRepo.findConflictingSlots.mockResolvedValue([]);
      mockSlotRepo.update.mockResolvedValue({ ...mockSlot, ...updates });

      const result = await slotService.updateSlot(mockSlotId, updates);

      expect(result?.start_time).toEqual(updates.start_time);
      expect(result?.end_time).toEqual(updates.end_time);
      expect(mockSlotRepo.findConflictingSlots).toHaveBeenCalledWith(
        mockSlot.staff_id,
        updates.start_time,
        updates.end_time,
        mockSlotId
      );
    });
  });
});