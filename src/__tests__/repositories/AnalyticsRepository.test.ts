import { AnalyticsRepository } from '../../repositories/AnalyticsRepository';
import { BookingSource, BookingStatus } from '../../models';
import db from '../../database/connection';

// Mock the database connection
jest.mock('../../database/connection');

describe('AnalyticsRepository', () => {
  let analyticsRepository: AnalyticsRepository;
  const mockTenantId = 'test-tenant-id';

  beforeEach(() => {
    analyticsRepository = new AnalyticsRepository(mockTenantId);
    jest.clearAllMocks();
  });

  describe('calculateFillRate', () => {
    it('should calculate fill rate correctly', async () => {
      const mockResult = [[{
        waitlist_filled: '5',
        total_slots: '10'
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const fillRate = await analyticsRepository.calculateFillRate(startDate, endDate);

      expect(fillRate).toBe(50);
      expect(db.raw).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(CASE WHEN s.status = \'booked\' AND b.booking_source = \'waitlist\' THEN 1 END)'),
        [mockTenantId, mockTenantId, startDate, endDate]
      );
    });

    it('should return 0 when no slots exist', async () => {
      const mockResult = [[{
        waitlist_filled: '0',
        total_slots: '0'
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const fillRate = await analyticsRepository.calculateFillRate(startDate, endDate);

      expect(fillRate).toBe(0);
    });
  });

  describe('calculateMedianTimeToFill', () => {
    it('should calculate median time to fill for odd number of entries', async () => {
      const mockResult = [[
        { time_to_fill_minutes: '10' },
        { time_to_fill_minutes: '20' },
        { time_to_fill_minutes: '30' }
      ]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const median = await analyticsRepository.calculateMedianTimeToFill(startDate, endDate);

      expect(median).toBe(20);
    });

    it('should calculate median time to fill for even number of entries', async () => {
      const mockResult = [[
        { time_to_fill_minutes: '10' },
        { time_to_fill_minutes: '20' },
        { time_to_fill_minutes: '30' },
        { time_to_fill_minutes: '40' }
      ]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const median = await analyticsRepository.calculateMedianTimeToFill(startDate, endDate);

      expect(median).toBe(25);
    });

    it('should return 0 when no data exists', async () => {
      const mockResult = [[]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const median = await analyticsRepository.calculateMedianTimeToFill(startDate, endDate);

      expect(median).toBe(0);
    });
  });

  describe('calculateWaitlistRevenue', () => {
    it('should calculate total revenue from waitlist bookings', async () => {
      const mockResult = [[{
        total_revenue: '1500.50'
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const revenue = await analyticsRepository.calculateWaitlistRevenue(startDate, endDate);

      expect(revenue).toBe(1500.50);
      expect(db.raw).toHaveBeenCalledWith(
        expect.stringContaining('COALESCE(SUM(srv.price), 0)'),
        [mockTenantId, startDate, endDate]
      );
    });

    it('should return 0 when no revenue data exists', async () => {
      const mockResult = [[{
        total_revenue: null
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const revenue = await analyticsRepository.calculateWaitlistRevenue(startDate, endDate);

      expect(revenue).toBe(0);
    });
  });

  describe('calculateNoShowRate', () => {
    it('should calculate no-show rate correctly', async () => {
      const mockResult = [[{
        no_shows: '2',
        total_bookings: '10'
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const noShowRate = await analyticsRepository.calculateNoShowRate(startDate, endDate);

      expect(noShowRate).toBe(20);
    });

    it('should return 0 when no bookings exist', async () => {
      const mockResult = [[{
        no_shows: '0',
        total_bookings: '0'
      }]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const noShowRate = await analyticsRepository.calculateNoShowRate(startDate, endDate);

      expect(noShowRate).toBe(0);
    });
  });

  describe('getAnalyticsMetrics', () => {
    it('should return comprehensive analytics metrics', async () => {
      // Mock all the individual method calls
      const mockFillRate = 75;
      const mockMedianTime = 15;
      const mockRevenue = 2500;
      const mockNoShowRate = 10;

      const mockBookingStats = [[{
        total_slots: '20',
        filled_slots: '15',
        waitlist_bookings: '12',
        direct_bookings: '3',
        walk_in_bookings: '0',
        completed_bookings: '14',
        no_show_bookings: '1',
        canceled_bookings: '0'
      }]];

      // Mock the Promise.all results
      jest.spyOn(analyticsRepository, 'calculateFillRate').mockResolvedValue(mockFillRate);
      jest.spyOn(analyticsRepository, 'calculateMedianTimeToFill').mockResolvedValue(mockMedianTime);
      jest.spyOn(analyticsRepository, 'calculateWaitlistRevenue').mockResolvedValue(mockRevenue);
      jest.spyOn(analyticsRepository, 'calculateNoShowRate').mockResolvedValue(mockNoShowRate);

      (db.raw as jest.Mock).mockResolvedValue(mockBookingStats);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const metrics = await analyticsRepository.getAnalyticsMetrics(startDate, endDate);

      expect(metrics).toEqual({
        fillRate: mockFillRate,
        medianTimeToFill: mockMedianTime,
        totalRevenue: mockRevenue,
        noShowRate: mockNoShowRate,
        totalSlots: 20,
        filledSlots: 15,
        waitlistBookings: 12,
        directBookings: 3,
        walkInBookings: 0,
        completedBookings: 14,
        noShowBookings: 1,
        canceledBookings: 0
      });
    });
  });

  describe('markNoShow', () => {
    it('should mark a booking as no-show successfully', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(1);
      const mockWhere = jest.fn().mockReturnValue({ update: mockUpdate });
      (db as any).mockReturnValue({ where: mockWhere });

      const bookingId = 'test-booking-id';
      const result = await analyticsRepository.markNoShow(bookingId);

      expect(result).toBe(true);
      expect(mockWhere).toHaveBeenCalledWith({ id: bookingId, tenant_id: mockTenantId });
      expect(mockUpdate).toHaveBeenCalledWith({
        status: BookingStatus.NO_SHOW,
        updated_at: expect.any(Date)
      });
    });

    it('should return false when booking not found', async () => {
      const mockUpdate = jest.fn().mockResolvedValue(0);
      const mockWhere = jest.fn().mockReturnValue({ update: mockUpdate });
      (db as any).mockReturnValue({ where: mockWhere });

      const bookingId = 'non-existent-booking-id';
      const result = await analyticsRepository.markNoShow(bookingId);

      expect(result).toBe(false);
    });
  });

  describe('getDailyAnalytics', () => {
    it('should return daily analytics data', async () => {
      const mockResult = [[
        {
          date: '2024-01-01',
          total_slots: '5',
          filled_slots: '4',
          waitlist_bookings: '3',
          revenue: '150.00',
          no_shows: '0'
        },
        {
          date: '2024-01-02',
          total_slots: '6',
          filled_slots: '5',
          waitlist_bookings: '4',
          revenue: '200.00',
          no_shows: '1'
        }
      ]];

      (db.raw as jest.Mock).mockResolvedValue(mockResult);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-02');
      const dailyData = await analyticsRepository.getDailyAnalytics(startDate, endDate);

      expect(dailyData).toEqual([
        {
          date: '2024-01-01',
          total_slots: 5,
          filled_slots: 4,
          waitlist_bookings: 3,
          revenue: 150,
          no_shows: 0
        },
        {
          date: '2024-01-02',
          total_slots: 6,
          filled_slots: 5,
          waitlist_bookings: 4,
          revenue: 200,
          no_shows: 1
        }
      ]);
    });
  });
});