import express from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';
import { AnalyticsService } from '../services/AnalyticsService';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
});

const quickAnalyticsSchema = Joi.object({
  period: Joi.string().valid('today', 'week', 'month', 'quarter').required()
});

const markNoShowSchema = Joi.object({
  bookingId: Joi.string().uuid().required()
});

// Apply authentication and tenant validation to all routes
router.use(authenticate);
router.use(validateTenantAccess);

/**
 * GET /api/analytics/metrics
 * Get comprehensive analytics metrics for a date range
 */
router.get('/metrics', validateRequest(dateRangeSchema, 'query'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const metrics = await analyticsService.getAnalytics(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching analytics metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/quick/:period
 * Get analytics for common time periods
 */
router.get('/quick/:period', async (req, res) => {
  try {
    const { period } = req.params;
    
    if (!['today', 'week', 'month', 'quarter'].includes(period)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid period. Must be one of: today, week, month, quarter'
      });
    }

    const analyticsService = new AnalyticsService(req.tenantId!);
    const metrics = await analyticsService.getQuickAnalytics(period as any);

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching quick analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/daily
 * Get daily analytics for charting
 */
router.get('/daily', validateRequest(dateRangeSchema, 'query'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const dailyData = await analyticsService.getDailyAnalytics(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: dailyData
    });
  } catch (error) {
    console.error('Error fetching daily analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch daily analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/time-to-fill
 * Get detailed time-to-fill analysis
 */
router.get('/time-to-fill', validateRequest(dateRangeSchema, 'query'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const analysis = await analyticsService.getTimeToFillAnalysis(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error fetching time-to-fill analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time-to-fill analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/revenue
 * Get revenue breakdown analysis
 */
router.get('/revenue', validateRequest(dateRangeSchema, 'query'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const analysis = await analyticsService.getRevenueAnalysis(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('Error fetching revenue analysis:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 */
router.get('/export', validateRequest(dateRangeSchema, 'query'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const { format = 'metrics' } = req.query;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const exportData = await analyticsService.exportAnalyticsData(
      new Date(startDate as string),
      new Date(endDate as string)
    );

    const csvData = analyticsService.convertToCSV(exportData);
    
    let csvContent: string;
    let filename: string;

    switch (format) {
      case 'metrics':
        csvContent = csvData.metricsCSV;
        filename = 'analytics-metrics.csv';
        break;
      case 'time-to-fill':
        csvContent = csvData.timeToFillCSV;
        filename = 'time-to-fill-data.csv';
        break;
      case 'revenue':
        csvContent = csvData.revenueCSV;
        filename = 'revenue-data.csv';
        break;
      case 'daily':
        csvContent = csvData.dailyAnalyticsCSV;
        filename = 'daily-analytics.csv';
        break;
      default:
        csvContent = csvData.metricsCSV;
        filename = 'analytics-metrics.csv';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting analytics data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/no-shows/potential
 * Get potential no-shows for manual review
 */
router.get('/no-shows/potential', async (req, res) => {
  try {
    const analyticsService = new AnalyticsService(req.tenantId!);
    const potentialNoShows = await analyticsService.getPotentialNoShows();

    res.json({
      success: true,
      data: potentialNoShows
    });
  } catch (error) {
    console.error('Error fetching potential no-shows:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch potential no-shows',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/no-shows/mark
 * Mark a booking as no-show
 */
router.post('/no-shows/mark', validateRequest(markNoShowSchema), async (req, res) => {
  try {
    const { bookingId } = req.body;
    const analyticsService = new AnalyticsService(req.tenantId!);
    
    const success = await analyticsService.markBookingAsNoShow(bookingId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found or already processed'
      });
    }

    res.json({
      success: true,
      message: 'Booking marked as no-show successfully'
    });
  } catch (error) {
    console.error('Error marking booking as no-show:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark booking as no-show',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;