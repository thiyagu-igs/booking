import { CalendarEventRepository } from '../../repositories/CalendarEventRepository';
import { CalendarEvent } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');
const mockDb = db as jest.Mocked<typeof db>;

describe('CalendarEventRepository', () => {
  let repository: CalendarEventRepository;
  const tenantId = 'test-tenant-id';

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new CalendarEventRepository(tenantId);
  });

  describe('findBySlotId', () => {
    it('should find calendar event by slot ID', async () => {
      const mockEvent: CalendarEvent = {
        id: 'event-123',
        tenant_id: tenantId,
        slot_id: 'slot-123',
        staff_id: 'staff-123',
        google_event_id: 'google-event-123',
        google_calendar_id: 'calendar-123',
        status: 'created',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockEvent)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findBySlotId('slot-123');

      expect(mockDb.select).toHaveBeenCalledWith('*');
      expect(mockQuery.from).toHaveBeenCalledWith('calendar_events');
      expect(mockQuery.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        slot_id: 'slot-123'
      });
      expect(result).toEqual(mockEvent);
    });

    it('should return null when no event found', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(undefined)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findBySlotId('nonexistent-slot');

      expect(result).toBeNull();
    });
  });

  describe('findByStaffId', () => {
    it('should find calendar events by staff ID', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-123',
          tenant_id: tenantId,
          slot_id: 'slot-123',
          staff_id: 'staff-123',
          google_event_id: 'google-event-123',
          google_calendar_id: 'calendar-123',
          status: 'created',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockEvents)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findByStaffId('staff-123');

      expect(mockDb.select).toHaveBeenCalledWith('*');
      expect(mockQuery.from).toHaveBeenCalledWith('calendar_events');
      expect(mockQuery.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        staff_id: 'staff-123'
      });
      expect(result).toEqual(mockEvents);
    });
  });

  describe('findByGoogleEventId', () => {
    it('should find calendar event by Google event ID', async () => {
      const mockEvent: CalendarEvent = {
        id: 'event-123',
        tenant_id: tenantId,
        slot_id: 'slot-123',
        staff_id: 'staff-123',
        google_event_id: 'google-event-123',
        google_calendar_id: 'calendar-123',
        status: 'created',
        created_at: new Date(),
        updated_at: new Date()
      };

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(mockEvent)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findByGoogleEventId('google-event-123');

      expect(mockQuery.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        google_event_id: 'google-event-123'
      });
      expect(result).toEqual(mockEvent);
    });
  });

  describe('findByStatus', () => {
    it('should find calendar events by status', async () => {
      const mockEvents: CalendarEvent[] = [
        {
          id: 'event-123',
          tenant_id: tenantId,
          slot_id: 'slot-123',
          staff_id: 'staff-123',
          google_event_id: 'google-event-123',
          google_calendar_id: 'calendar-123',
          status: 'created',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue(mockEvents)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findByStatus('created');

      expect(mockQuery.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        status: 'created'
      });
      expect(result).toEqual(mockEvents);
    });
  });

  describe('findOrphanedEvents', () => {
    it('should find calendar events with deleted slots', async () => {
      const mockOrphanedEvents: CalendarEvent[] = [
        {
          id: 'event-123',
          tenant_id: tenantId,
          slot_id: 'deleted-slot-123',
          staff_id: 'staff-123',
          google_event_id: 'google-event-123',
          google_calendar_id: 'calendar-123',
          status: 'created',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockResolvedValue(mockOrphanedEvents)
      };

      mockDb.select = jest.fn().mockReturnValue(mockQuery);

      const result = await repository.findOrphanedEvents();

      expect(mockQuery.select).toHaveBeenCalledWith('calendar_events.*');
      expect(mockQuery.from).toHaveBeenCalledWith('calendar_events');
      expect(mockQuery.leftJoin).toHaveBeenCalledWith('slots', 'calendar_events.slot_id', 'slots.id');
      expect(mockQuery.where).toHaveBeenCalledWith('calendar_events.tenant_id', tenantId);
      expect(mockQuery.where).toHaveBeenCalledWith('calendar_events.status', '!=', 'deleted');
      expect(mockQuery.whereNull).toHaveBeenCalledWith('slots.id');
      expect(result).toEqual(mockOrphanedEvents);
    });
  });

  describe('getSyncStats', () => {
    it('should return calendar sync statistics', async () => {
      const mockStats = [
        { status: 'created', count: '5' },
        { status: 'updated', count: '2' },
        { status: 'deleted', count: '1' },
        { status: 'error', count: '1' }
      ];

      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue(mockStats)
      };

      mockDb.mockImplementation(() => mockQuery as any);

      const result = await repository.getSyncStats();

      expect(mockQuery.where).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockQuery.select).toHaveBeenCalledWith('status');
      expect(mockQuery.count).toHaveBeenCalledWith('* as count');
      expect(mockQuery.groupBy).toHaveBeenCalledWith('status');
      
      expect(result).toEqual({
        total: 9,
        created: 5,
        updated: 2,
        deleted: 1,
        errors: 1
      });
    });

    it('should return zero stats when no events exist', async () => {
      const mockQuery = {
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        count: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue([])
      };

      mockDb.mockImplementation(() => mockQuery as any);

      const result = await repository.getSyncStats();

      expect(result).toEqual({
        total: 0,
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 0
      });
    });
  });

  describe('cleanupOrphanedEvents', () => {
    it('should cleanup orphaned calendar events', async () => {
      const mockOrphanedEvents: CalendarEvent[] = [
        {
          id: 'event-123',
          tenant_id: tenantId,
          slot_id: 'deleted-slot-123',
          staff_id: 'staff-123',
          google_event_id: 'google-event-123',
          google_calendar_id: 'calendar-123',
          status: 'created',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'event-456',
          tenant_id: tenantId,
          slot_id: 'deleted-slot-456',
          staff_id: 'staff-123',
          google_event_id: 'google-event-456',
          google_calendar_id: 'calendar-123',
          status: 'created',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Mock findOrphanedEvents
      repository.findOrphanedEvents = jest.fn().mockResolvedValue(mockOrphanedEvents);

      const mockUpdateQuery = {
        whereIn: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        update: jest.fn().mockResolvedValue(2)
      };

      mockDb.mockImplementation(() => mockUpdateQuery as any);

      const result = await repository.cleanupOrphanedEvents();

      expect(repository.findOrphanedEvents).toHaveBeenCalled();
      expect(mockUpdateQuery.whereIn).toHaveBeenCalledWith('id', ['event-123', 'event-456']);
      expect(mockUpdateQuery.where).toHaveBeenCalledWith('tenant_id', tenantId);
      expect(mockUpdateQuery.update).toHaveBeenCalledWith({
        status: 'deleted',
        updated_at: expect.any(Date)
      });
      expect(result).toBe(2);
    });

    it('should return 0 when no orphaned events exist', async () => {
      repository.findOrphanedEvents = jest.fn().mockResolvedValue([]);

      const result = await repository.cleanupOrphanedEvents();

      expect(repository.findOrphanedEvents).toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });
});