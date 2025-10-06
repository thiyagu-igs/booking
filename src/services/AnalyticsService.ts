import { AnalyticsRepository, AnalyticsMetrics, TimeToFillData, RevenueData } from '../repositories/AnalyticsRepository';
import { Booking } from '../models';

export interface AnalyticsExportData {
  metrics: AnalyticsMetrics;
  timeToFillData: TimeToFillData[];
  revenueData: RevenueData[];
  dailyAnalytics: Array<{
    date: string;
    total_slots: number;
    filled_slots: number;
    waitlist_bookings: number;
    revenue: number;
    no_shows: number;
  }>;
}

export class AnalyticsService {
  private analyticsRepository: AnalyticsRepository;

  constructor(tenantId: string) {
    this.analyticsRepository = new AnalyticsRepository(tenantId);
  }

  /**
   * Get comprehensive analytics for a date range
   */
  async getAnalytics(startDate: Date, endDate: Date): Promise<AnalyticsMetrics> {
    this.validateDateRange(startDate, endDate);
    return this.analyticsRepository.getAnalyticsMetrics(startDate, endDate);
  }

  /**
   * Get daily analytics for charting
   */
  async getDailyAnalytics(startDate: Date, endDate: Date) {
    this.validateDateRange(startDate, endDate);
    return this.analyticsRepository.getDailyAnalytics(startDate, endDate);
  }

  /**
   * Get detailed time-to-fill analysis
   */
  async getTimeToFillAnalysis(startDate: Date, endDate: Date): Promise<{
    data: TimeToFillData[];
    average: number;
    median: number;
    fastest: number;
    slowest: number;
  }> {
    this.validateDateRange(startDate, endDate);
    const data = await this.analyticsRepository.getTimeToFillData(startDate, endDate);
    
    if (data.length === 0) {
      return {
        data: [],
        average: 0,
        median: 0,
        fastest: 0,
        slowest: 0
      };
    }

    const times = data.map(d => d.time_to_fill_minutes).sort((a, b) => a - b);
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const median = times.length % 2 === 0 
      ? (times[Math.floor(times.length / 2) - 1] + times[Math.floor(times.length / 2)]) / 2
      : times[Math.floor(times.length / 2)];

    return {
      data,
      average: Math.round(average * 100) / 100,
      median,
      fastest: times[0],
      slowest: times[times.length - 1]
    };
  }

  /**
   * Get revenue breakdown analysis
   */
  async getRevenueAnalysis(startDate: Date, endDate: Date): Promise<{
    data: RevenueData[];
    totalRevenue: number;
    waitlistRevenue: number;
    directRevenue: number;
    walkInRevenue: number;
    averageBookingValue: number;
  }> {
    this.validateDateRange(startDate, endDate);
    const data = await this.analyticsRepository.getRevenueData(startDate, endDate);
    
    const totalRevenue = data
      .filter(d => ['confirmed', 'completed'].includes(d.booking_status))
      .reduce((sum, d) => sum + d.service_price, 0);
    
    const waitlistRevenue = data
      .filter(d => d.booking_source === 'waitlist' && ['confirmed', 'completed'].includes(d.booking_status))
      .reduce((sum, d) => sum + d.service_price, 0);
    
    const directRevenue = data
      .filter(d => d.booking_source === 'direct' && ['confirmed', 'completed'].includes(d.booking_status))
      .reduce((sum, d) => sum + d.service_price, 0);
    
    const walkInRevenue = data
      .filter(d => d.booking_source === 'walk_in' && ['confirmed', 'completed'].includes(d.booking_status))
      .reduce((sum, d) => sum + d.service_price, 0);

    const confirmedBookings = data.filter(d => ['confirmed', 'completed'].includes(d.booking_status));
    const averageBookingValue = confirmedBookings.length > 0 
      ? totalRevenue / confirmedBookings.length 
      : 0;

    return {
      data,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      waitlistRevenue: Math.round(waitlistRevenue * 100) / 100,
      directRevenue: Math.round(directRevenue * 100) / 100,
      walkInRevenue: Math.round(walkInRevenue * 100) / 100,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100
    };
  }

  /**
   * Export analytics data for CSV download
   */
  async exportAnalyticsData(startDate: Date, endDate: Date): Promise<AnalyticsExportData> {
    this.validateDateRange(startDate, endDate);
    
    const [metrics, timeToFillData, revenueData, dailyAnalytics] = await Promise.all([
      this.analyticsRepository.getAnalyticsMetrics(startDate, endDate),
      this.analyticsRepository.getTimeToFillData(startDate, endDate),
      this.analyticsRepository.getRevenueData(startDate, endDate),
      this.analyticsRepository.getDailyAnalytics(startDate, endDate)
    ]);

    return {
      metrics,
      timeToFillData,
      revenueData,
      dailyAnalytics
    };
  }

  /**
   * Convert analytics data to CSV format
   */
  convertToCSV(data: AnalyticsExportData): {
    metricsCSV: string;
    timeToFillCSV: string;
    revenueCSV: string;
    dailyAnalyticsCSV: string;
  } {
    // Metrics CSV
    const metricsHeaders = [
      'Fill Rate (%)',
      'Median Time to Fill (minutes)',
      'Total Revenue',
      'No Show Rate (%)',
      'Total Slots',
      'Filled Slots',
      'Waitlist Bookings',
      'Direct Bookings',
      'Walk-in Bookings',
      'Completed Bookings',
      'No Show Bookings',
      'Canceled Bookings'
    ];
    
    const metricsRow = [
      data.metrics.fillRate.toFixed(2),
      data.metrics.medianTimeToFill.toString(),
      data.metrics.totalRevenue.toFixed(2),
      data.metrics.noShowRate.toFixed(2),
      data.metrics.totalSlots.toString(),
      data.metrics.filledSlots.toString(),
      data.metrics.waitlistBookings.toString(),
      data.metrics.directBookings.toString(),
      data.metrics.walkInBookings.toString(),
      data.metrics.completedBookings.toString(),
      data.metrics.noShowBookings.toString(),
      data.metrics.canceledBookings.toString()
    ];

    const metricsCSV = [metricsHeaders.join(','), metricsRow.join(',')].join('\n');

    // Time to Fill CSV
    const timeToFillHeaders = ['Slot ID', 'Slot Created', 'Booking Created', 'Time to Fill (minutes)'];
    const timeToFillRows = data.timeToFillData.map(row => [
      row.slot_id,
      row.slot_created_at.toISOString(),
      row.booking_created_at.toISOString(),
      row.time_to_fill_minutes.toString()
    ]);
    const timeToFillCSV = [timeToFillHeaders.join(','), ...timeToFillRows.map(row => row.join(','))].join('\n');

    // Revenue CSV
    const revenueHeaders = ['Booking ID', 'Service Price', 'Booking Source', 'Booking Status', 'Booking Date'];
    const revenueRows = data.revenueData.map(row => [
      row.booking_id,
      row.service_price.toFixed(2),
      row.booking_source,
      row.booking_status,
      row.booking_date.toISOString()
    ]);
    const revenueCSV = [revenueHeaders.join(','), ...revenueRows.map(row => row.join(','))].join('\n');

    // Daily Analytics CSV
    const dailyHeaders = ['Date', 'Total Slots', 'Filled Slots', 'Waitlist Bookings', 'Revenue', 'No Shows'];
    const dailyRows = data.dailyAnalytics.map(row => [
      row.date,
      row.total_slots.toString(),
      row.filled_slots.toString(),
      row.waitlist_bookings.toString(),
      row.revenue.toFixed(2),
      row.no_shows.toString()
    ]);
    const dailyAnalyticsCSV = [dailyHeaders.join(','), ...dailyRows.map(row => row.join(','))].join('\n');

    return {
      metricsCSV,
      timeToFillCSV,
      revenueCSV,
      dailyAnalyticsCSV
    };
  }

  /**
   * Mark a booking as no-show
   */
  async markBookingAsNoShow(bookingId: string): Promise<boolean> {
    return this.analyticsRepository.markNoShow(bookingId);
  }

  /**
   * Get potential no-shows for manual review
   */
  async getPotentialNoShows(): Promise<Array<Booking & {
    service_name: string;
    staff_name: string;
    slot_start_time: Date;
  }>> {
    return this.analyticsRepository.getPotentialNoShows();
  }

  /**
   * Get analytics for common time periods
   */
  async getQuickAnalytics(period: 'today' | 'week' | 'month' | 'quarter'): Promise<AnalyticsMetrics> {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now);

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      default:
        throw new Error('Invalid period specified');
    }

    return this.getAnalytics(startDate, endDate);
  }

  /**
   * Validate date range inputs
   */
  private validateDateRange(startDate: Date, endDate: Date): void {
    if (!(startDate instanceof Date) || !(endDate instanceof Date)) {
      throw new Error('Start date and end date must be valid Date objects');
    }

    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date');
    }

    const maxRangeMs = 365 * 24 * 60 * 60 * 1000; // 1 year
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      throw new Error('Date range cannot exceed 1 year');
    }
  }
}