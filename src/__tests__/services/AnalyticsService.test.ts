import { AnalyticsService } from '../../services/AnalyticsService';
import { AnalyticsRepository } from '../../repositories/AnalyticsRepository';

// Mock the AnalyticsRepository
jest.mock('../../repositories/AnalyticsRepository');

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let mockAnalyticsRepository: jest.Mocked<AnalyticsRepository>;
  const mockTenantId = 'test-tenant-id';

  beforeEach(() => {
    analyticsService = new AnalyticsService(mockTenantId);
    mockAnalyticsRepository = analyticsService['analyticsRepository'] as jest.Mocked<AnalyticsRepository>;
    jest.clearAllMocks();
  });

  describe('getAnalytics', () => {
    it('should return analytics metrics for valid date range', async () => {
      const mockMetrics = {
        fillRate: 75,
        medianTimeToFill: 15,
        totalRevenue: 2500,
        noShowRate: 10,
        totalSlots: 20,
        filledSlots: 15,
        waitlistBookings: 12,
        directBookings: 3,
        walkInBookings: 0,
        completedBookings: 14,
        noShowBookings: 1,
        canceledBookings: 0
      };

      mockAnalyticsRepository.getAnalyticsMetrics.mockResolvedValue(mockMetrics);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await analyticsService.getAnalytics(startDate, endDate);

      expect(result).toEqual(mockMetrics);
      expect(mockAnalyticsRepository.getAnalyticsMetrics).toHaveBeenCalledWith(startDate, endDate);
    });

    it('should throw error for invalid date range', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01');

      await expect(analyticsService.getAnalytics(startDate, endDate))
        .rejects.toThrow('Start date cannot be after end date');
    });

    it('should throw error for date range exceeding 1 year', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2024-12-31');

      await expect(analyticsService.getAnalytics(startDate, endDate))
        .rejects.toThrow('Date range cannot exceed 1 year');
    });
  });

  describe('getTimeToFillAnalysis', () => {
    it('should return time-to-fill analysis with statistics', async () => {
      const mockData = [
        {
          slot_id: 'slot-1',
          slot_created_at: new Date('2024-01-01T10:00:00Z'),
          booking_created_at: new Date('2024-01-01T10:15:00Z'),
          time_to_fill_minutes: 15
        },
        {
          slot_id: 'slot-2',
          slot_created_at: new Date('2024-01-01T11:00:00Z'),
          booking_created_at: new Date('2024-01-01T11:30:00Z'),
          time_to_fill_minutes: 30
        },
        {
          slot_id: 'slot-3',
          slot_created_at: new Date('2024-01-01T12:00:00Z'),
          booking_created_at: new Date('2024-01-01T12:10:00Z'),
          time_to_fill_minutes: 10
        }
      ];

      mockAnalyticsRepository.getTimeToFillData.mockResolvedValue(mockData);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await analyticsService.getTimeToFillAnalysis(startDate, endDate);

      expect(result).toEqual({
        data: mockData,
        average: 18.33,
        median: 15,
        fastest: 10,
        slowest: 30
      });
    });

    it('should handle empty data set', async () => {
      mockAnalyticsRepository.getTimeToFillData.mockResolvedValue([]);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await analyticsService.getTimeToFillAnalysis(startDate, endDate);

      expect(result).toEqual({
        data: [],
        average: 0,
        median: 0,
        fastest: 0,
        slowest: 0
      });
    });
  });

  describe('getRevenueAnalysis', () => {
    it('should return revenue analysis with breakdown', async () => {
      const mockData = [
        {
          booking_id: 'booking-1',
          service_price: 100,
          booking_source: 'waitlist' as const,
          booking_status: 'completed' as const,
          booking_date: new Date('2024-01-01')
        },
        {
          booking_id: 'booking-2',
          service_price: 150,
          booking_source: 'direct' as const,
          booking_status: 'confirmed' as const,
          booking_date: new Date('2024-01-02')
        },
        {
          booking_id: 'booking-3',
          service_price: 75,
          booking_source: 'waitlist' as const,
          booking_status: 'canceled' as const,
          booking_date: new Date('2024-01-03')
        }
      ];

      mockAnalyticsRepository.getRevenueData.mockResolvedValue(mockData);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const result = await analyticsService.getRevenueAnalysis(startDate, endDate);

      expect(result).toEqual({
        data: mockData,
        totalRevenue: 250,
        waitlistRevenue: 100,
        directRevenue: 150,
        walkInRevenue: 0,
        averageBookingValue: 125
      });
    });
  });

  describe('getQuickAnalytics', () => {
    it('should return analytics for today', async () => {
      const mockMetrics = {
        fillRate: 80,
        medianTimeToFill: 12,
        totalRevenue: 500,
        noShowRate: 5,
        totalSlots: 10,
        filledSlots: 8,
        waitlistBookings: 6,
        directBookings: 2,
        walkInBookings: 0,
        completedBookings: 7,
        noShowBookings: 1,
        canceledBookings: 0
      };

      mockAnalyticsRepository.getAnalyticsMetrics.mockResolvedValue(mockMetrics);

      const result = await analyticsService.getQuickAnalytics('today');

      expect(result).toEqual(mockMetrics);
      expect(mockAnalyticsRepository.getAnalyticsMetrics).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date)
      );
    });

    it('should throw error for invalid period', async () => {
      await expect(analyticsService.getQuickAnalytics('invalid' as any))
        .rejects.toThrow('Invalid period specified');
    });
  });

  describe('convertToCSV', () => {
    it('should convert analytics data to CSV format', () => {
      const mockExportData = {
        metrics: {
          fillRate: 75,
          medianTimeToFill: 15,
          totalRevenue: 2500,
          noShowRate: 10,
          totalSlots: 20,
          filledSlots: 15,
          waitlistBookings: 12,
          directBookings: 3,
          walkInBookings: 0,
          completedBookings: 14,
          noShowBookings: 1,
          canceledBookings: 0
        },
        timeToFillData: [
          {
            slot_id: 'slot-1',
            slot_created_at: new Date('2024-01-01T10:00:00Z'),
            booking_created_at: new Date('2024-01-01T10:15:00Z'),
            time_to_fill_minutes: 15
          }
        ],
        revenueData: [
          {
            booking_id: 'booking-1',
            service_price: 100,
            booking_source: 'waitlist' as const,
            booking_status: 'completed' as const,
            booking_date: new Date('2024-01-01')
          }
        ],
        dailyAnalytics: [
          {
            date: '2024-01-01',
            total_slots: 5,
            filled_slots: 4,
            waitlist_bookings: 3,
            revenue: 150,
            no_shows: 0
          }
        ]
      };

      const result = analyticsService.convertToCSV(mockExportData);

      expect(result.metricsCSV).toContain('Fill Rate (%)');
      expect(result.metricsCSV).toContain('75.00');
      expect(result.timeToFillCSV).toContain('Slot ID');
      expect(result.timeToFillCSV).toContain('slot-1');
      expect(result.revenueCSV).toContain('Booking ID');
      expect(result.revenueCSV).toContain('booking-1');
      expect(result.dailyAnalyticsCSV).toContain('Date');
      expect(result.dailyAnalyticsCSV).toContain('2024-01-01');
    });
  });

  describe('markBookingAsNoShow', () => {
    it('should mark booking as no-show successfully', async () => {
      mockAnalyticsRepository.markNoShow.mockResolvedValue(true);

      const bookingId = 'test-booking-id';
      const result = await analyticsService.markBookingAsNoShow(bookingId);

      expect(result).toBe(true);
      expect(mockAnalyticsRepository.markNoShow).toHaveBeenCalledWith(bookingId);
    });

    it('should return false when booking not found', async () => {
      mockAnalyticsRepository.markNoShow.mockResolvedValue(false);

      const bookingId = 'non-existent-booking-id';
      const result = await analyticsService.markBookingAsNoShow(bookingId);

      expect(result).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    it('should throw error for invalid date objects', async () => {
      await expect(analyticsService.getAnalytics('invalid' as any, new Date()))
        .rejects.toThrow('Start date and end date must be valid Date objects');
    });

    it('should throw error when start date is after end date', async () => {
      const startDate = new Date('2024-01-31');
      const endDate = new Date('2024-01-01');

      await expect(analyticsService.getAnalytics(startDate, endDate))
        .rejects.toThrow('Start date cannot be after end date');
    });

    it('should throw error for date range exceeding 1 year', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2024-12-31');

      await expect(analyticsService.getAnalytics(startDate, endDate))
        .rejects.toThrow('Date range cannot exceed 1 year');
    });
  });
});