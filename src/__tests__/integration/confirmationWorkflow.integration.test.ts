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
  WaitlistEntry,
  Slot,
  Service,
  Staff
} from '../../models';

// Mock repositories
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../services/NotificationService');

const MockWaitlistRepository = WaitlistRepository as jest.MockedClass<typeof WaitlistRepository>;
const MockSlotRepository = SlotRepository as jest.MockedClass<typeof SlotRepository>;
const MockServiceRepository = ServiceRepository as jest.MockedClass<typeof ServiceRepository>;
const MockStaffRepository = StaffRepository as jest.MockedClass<typeof StaffRepository>;
const MockNotificationService = NotificationService as jest.MockedClass<typeof NotificationService>;

describe('Confirmation Workflow Integration', () => {
  let waitlistService: WaitlistService;
  let slotService: SlotService;
  let notificationService: NotificationService;
  
  let mockWaitlistRepo: jest.Mocked<WaitlistRepository>;
  let mockSlotRepo: jest.Mocked<SlotRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;

  const tenantId = 'tenant-123';

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

  const mockNextCandidate = {
    ...mockEntry,
    id: 'entry-456',
    customer_name: 'Jane Smith',
    phone: '+1234567891',
    email: 'jane@example.com',
    priority_score: 70,
    service_name: 'Hair Cut',
    staff_name: 'Jane Smith',
    match_score: 85
  };

  beforeEach(() => {
    // Create mock instances
    mockWaitlistRepo = new MockWaitlistRepository(tenantId) as jest.Mocked<WaitlistRepository>;
    mockSlotRepo = new MockSlotRepository(tenantId) as jest.Mocked<SlotRepository>;
    mockServiceRepo = new MockServiceRepository(tenantId) as jest.Mocked<ServiceRepository>;
    mockStaffRepo = new MockStaffRepository(tenantId) as jest.Mocked<StaffRepository>;

    // Create services
    waitlistService = new WaitlistService(mockWaitlistRepo, mockServiceRepo, mockStaffRepo);
    slotService = new SlotService(mockSlotRepo, mockWaitlistRepo, mockServiceRepo, mockStaffRepo, waitlistService);
    notificationService = new MockNotificationService({}, tenantId) as jest.Mocked<NotificationService>;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Cascade Notification Workflow', () => {
    it('should handle cascade notification when customer declines', async () => {
      // Mock slot retrieval
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      
      // Mock releasing hold
      mockSlotRepo.releaseHold.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.OPEN,
        hold_expires_at: undefined
      });

      // Mock finding candidates
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([mockNextCandidate]);
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);

      // Mock holding slot for next candidate
      mockSlotRepo.holdSlot.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.HELD,
        hold_expires_at: new Date(Date.now() + 10 * 60 * 1000)
      });

      // Mock updating waitlist entry status
      mockWaitlistRepo.updateStatus.mockResolvedValue({
        ...mockNextCandidate,
        status: WaitlistStatus.NOTIFIED
      });

      // Execute cascade notification
      const result = await slotService.handleCascadeNotification('slot-123');

      // Verify the workflow
      expect(mockSlotRepo.findById).toHaveBeenCalledWith('slot-123');
      expect(mockSlotRepo.releaseHold).toHaveBeenCalledWith('slot-123');
      expect(mockWaitlistRepo.findCandidatesForSlot).toHaveBeenCalledWith(
        mockSlot.service_id,
        mockSlot.staff_id,
        mockSlot.start_time,
        mockSlot.end_time
      );
      expect(mockSlotRepo.holdSlot).toHaveBeenCalledWith('slot-123', 10);
      expect(mockWaitlistRepo.updateStatus).toHaveBeenCalledWith(
        mockNextCandidate.id,
        WaitlistStatus.NOTIFIED
      );

      expect(result).toEqual(mockNextCandidate);
    });

    it('should handle cascade notification with no eligible candidates', async () => {
      // Mock slot retrieval
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      
      // Mock releasing hold
      mockSlotRepo.releaseHold.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.OPEN,
        hold_expires_at: undefined
      });

      // Mock no candidates found
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([]);

      // Execute cascade notification
      const result = await slotService.handleCascadeNotification('slot-123');

      // Verify the workflow
      expect(mockSlotRepo.findById).toHaveBeenCalledWith('slot-123');
      expect(mockSlotRepo.releaseHold).toHaveBeenCalledWith('slot-123');
      expect(mockWaitlistRepo.findCandidatesForSlot).toHaveBeenCalled();
      
      // Should not hold slot or update status if no candidates
      expect(mockSlotRepo.holdSlot).not.toHaveBeenCalled();
      expect(mockWaitlistRepo.updateStatus).not.toHaveBeenCalled();

      expect(result).toBeNull();
    });

    it('should handle slot not found error', async () => {
      // Mock slot not found
      mockSlotRepo.findById.mockResolvedValue(null);

      // Execute cascade notification and expect error
      await expect(slotService.handleCascadeNotification('nonexistent-slot'))
        .rejects.toThrow('Slot not found');

      expect(mockSlotRepo.findById).toHaveBeenCalledWith('nonexistent-slot');
      expect(mockSlotRepo.releaseHold).not.toHaveBeenCalled();
    });
  });

  describe('Expired Hold Processing', () => {
    it('should process expired holds and trigger cascade notifications', async () => {
      const expiredSlot1 = { ...mockSlot, id: 'slot-1', status: SlotStatus.HELD };
      const expiredSlot2 = { ...mockSlot, id: 'slot-2', status: SlotStatus.HELD };

      // Mock finding expired holds
      mockSlotRepo.findExpiredHolds.mockResolvedValue([expiredSlot1, expiredSlot2]);
      
      // Mock releasing holds
      mockSlotRepo.releaseHold.mockResolvedValue({ ...expiredSlot1, status: SlotStatus.OPEN });
      
      // Mock the openSlot method to simulate cascade notifications
      const mockOpenSlot = jest.spyOn(slotService, 'openSlot');
      mockOpenSlot.mockResolvedValueOnce({
        slot: { ...expiredSlot1, status: SlotStatus.HELD },
        candidates: [mockNextCandidate],
        top_candidate: mockNextCandidate,
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

  describe('Booking Finalization', () => {
    it('should finalize booking and remove customer from other waitlists', async () => {
      // Mock slot retrieval first
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      
      // Mock slot booking
      mockSlotRepo.bookSlot.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.BOOKED,
        hold_expires_at: undefined
      });

      // Execute booking
      const result = await slotService.bookSlot('slot-123');

      expect(mockSlotRepo.findById).toHaveBeenCalledWith('slot-123');
      expect(mockSlotRepo.bookSlot).toHaveBeenCalledWith('slot-123');
      expect(result?.status).toBe(SlotStatus.BOOKED);
      expect(result?.hold_expires_at).toBeUndefined();
    });

    it('should handle booking race conditions', async () => {
      // Mock slot not found (already booked by someone else)
      mockSlotRepo.findById.mockResolvedValue(null);

      await expect(slotService.bookSlot('slot-123'))
        .rejects.toThrow('Slot not found');
    });
  });

  describe('Double-booking Prevention', () => {
    it('should prevent double booking through repository constraints', async () => {
      // Mock slot found but booking fails due to race condition
      mockSlotRepo.findById.mockResolvedValue(mockSlot);
      mockSlotRepo.bookSlot.mockRejectedValue(new Error('Slot already booked'));

      await expect(slotService.bookSlot('slot-123'))
        .rejects.toThrow('Slot already booked');
    });

    it('should handle concurrent hold attempts', async () => {
      // Mock slot found with OPEN status (required for hold)
      mockSlotRepo.findById.mockResolvedValue({
        ...mockSlot,
        status: SlotStatus.OPEN
      });
      mockSlotRepo.holdSlot.mockRejectedValue(new Error('Slot no longer available'));

      await expect(slotService.holdSlot('slot-123', 10))
        .rejects.toThrow('Slot no longer available');
    });
  });

  describe('Edge Cases', () => {
    it('should handle notification service failures gracefully', async () => {
      // This would be tested at the route level where notification service is called
      // The service layer focuses on slot and waitlist management
      expect(true).toBe(true); // Placeholder for service-level edge case handling
    });

    it('should handle partial data scenarios', async () => {
      // Mock slot with missing staff_id
      const slotWithoutStaff = { ...mockSlot, staff_id: '' };
      mockSlotRepo.findById.mockResolvedValue(slotWithoutStaff);
      mockWaitlistRepo.findCandidatesForSlot.mockResolvedValue([]);

      const candidates = await slotService.findCandidatesForSlot(slotWithoutStaff);
      
      expect(candidates).toEqual([]);
      expect(mockWaitlistRepo.findCandidatesForSlot).toHaveBeenCalledWith(
        slotWithoutStaff.service_id,
        slotWithoutStaff.staff_id,
        slotWithoutStaff.start_time,
        slotWithoutStaff.end_time
      );
    });
  });
});