import request from 'supertest';
import express from 'express';
import analyticsRoutes from '../../routes/analytics';
import { AnalyticsService } from '../../services/AnalyticsService';

// Mock the AnalyticsService
jest.mock('../../services/AnalyticsService');

// Mock middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

jest.mock('../../middleware/tenant', () => ({
  validateTenant: (req: any, res: any, next: any) => {
    req.tenantId = 'test-tenant-id';
    next();
  }
}));

jest.mock('../../middleware/validation', () => ({
  validateRequest: () => (req: any, res: any, next: any) => next()
}));

describe('Analytics Routes', () => {
  let app: express.Application;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/analytics', analyticsRoutes);

    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instance
    mockAnalyticsService = {
      getAnalytics: jest.fn(),
      getQuickAnalytics: jest.fn(),
      getDailyAnalytics: jest.fn(),
      getTimeToFillAnalysis: jest.fn(),
      getRevenueAnalysis: jest.fn(),
      exportAnalyticsData: jest.fn(),
      convertToCSV: jest.fn(),
      markBookingAsNoShow: jest.fn(),
      getPotentialNoShows: jest.fn()
    } as any;

    (AnalyticsService as jest.Mock).mockImplementation(() => mockAnalyticsService);
  });

  describe('GET /api/analytics/metrics', () => {
    it('should return analytics metrics successfully', async () => {
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

      mockAnalyticsService.getAnalytics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockMetrics
      });
      expect(mockAnalyticsService.getAnalytics).toHaveBeenCalledWith(
        new Date('2024-01-01'),
        new Date('2024-01-31')
      );
    });

    it('should handle service errors', async () => {
      mockAnalyticsService.getAnalytics.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/analytics/metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch analytics metrics',
        message: 'Database error'
      });
    });
  });

  describe('GET /api/analytics/quick/:period', () => {
    it('should return quick analytics for valid period', async () => {
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

      mockAnalyticsService.getQuickAnalytics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/analytics/quick/week');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockMetrics
      });
      expect(mockAnalyticsService.getQuickAnalytics).toHaveBeenCalledWith('week');
    });

    it('should return 400 for invalid period', async () => {
      const response = await request(app)
        .get('/api/analytics/quick/invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: 'Invalid period. Must be one of: today, week, month, quarter'
      });
    });
  });

  describe('GET /api/analytics/daily', () => {
    it('should return daily analytics data', async () => {
      const mockDailyData = [
        {
          date: '2024-01-01',
          total_slots: 5,
          filled_slots: 4,
          waitlist_bookings: 3,
          revenue: 150,
          no_shows: 0
        }
      ];

      mockAnalyticsService.getDailyAnalytics.mockResolvedValue(mockDailyData);

      const response = await request(app)
        .get('/api/analytics/daily')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockDailyData
      });
    });
  });

  describe('GET /api/analytics/time-to-fill', () => {
    it('should return time-to-fill analysis', async () => {
      const mockAnalysis = {
        data: [
          {
            slot_id: 'slot-1',
            slot_created_at: '2024-01-01T10:00:00Z',
            booking_created_at: '2024-01-01T10:15:00Z',
            time_to_fill_minutes: 15
          }
        ],
        average: 15,
        median: 15,
        fastest: 15,
        slowest: 15
      };

      mockAnalyticsService.getTimeToFillAnalysis.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/api/analytics/time-to-fill')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockAnalysis
      });
    });
  });

  describe('GET /api/analytics/revenue', () => {
    it('should return revenue analysis', async () => {
      const mockAnalysis = {
        data: [],
        totalRevenue: 1000,
        waitlistRevenue: 800,
        directRevenue: 200,
        walkInRevenue: 0,
        averageBookingValue: 100
      };

      mockAnalyticsService.getRevenueAnalysis.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/api/analytics/revenue')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockAnalysis
      });
    });
  });

  describe('GET /api/analytics/export', () => {
    it('should export analytics data as CSV', async () => {
      const mockExportData = {
        metrics: {} as any,
        timeToFillData: [],
        revenueData: [],
        dailyAnalytics: []
      };

      const mockCSVData = {
        metricsCSV: 'Fill Rate (%),75.00',
        timeToFillCSV: 'Slot ID,slot-1',
        revenueCSV: 'Booking ID,booking-1',
        dailyAnalyticsCSV: 'Date,2024-01-01'
      };

      mockAnalyticsService.exportAnalyticsData.mockResolvedValue(mockExportData);
      mockAnalyticsService.convertToCSV.mockReturnValue(mockCSVData);

      const response = await request(app)
        .get('/api/analytics/export')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          format: 'metrics'
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toBe('attachment; filename="analytics-metrics.csv"');
      expect(response.text).toBe(mockCSVData.metricsCSV);
    });
  });

  describe('GET /api/analytics/no-shows/potential', () => {
    it('should return potential no-shows', async () => {
      const mockNoShows = [
        {
          id: 'booking-1',
          customer_name: 'John Doe',
          customer_phone: '+1234567890',
          service_name: 'Haircut',
          staff_name: 'Jane Smith',
          slot_start_time: '2024-01-01T10:00:00Z',
          status: 'confirmed'
        }
      ];

      mockAnalyticsService.getPotentialNoShows.mockResolvedValue(mockNoShows);

      const response = await request(app)
        .get('/api/analytics/no-shows/potential');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockNoShows
      });
    });
  });

  describe('POST /api/analytics/no-shows/mark', () => {
    it('should mark booking as no-show successfully', async () => {
      mockAnalyticsService.markBookingAsNoShow.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/analytics/no-shows/mark')
        .send({ bookingId: 'test-booking-id' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Booking marked as no-show successfully'
      });
      expect(mockAnalyticsService.markBookingAsNoShow).toHaveBeenCalledWith('test-booking-id');
    });

    it('should return 404 when booking not found', async () => {
      mockAnalyticsService.markBookingAsNoShow.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/analytics/no-shows/mark')
        .send({ bookingId: 'non-existent-booking-id' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: 'Booking not found or already processed'
      });
    });
  });
});