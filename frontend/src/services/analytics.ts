import { api } from './api';

export interface AnalyticsMetrics {
  fillRate: number;
  medianTimeToFill: number;
  totalRevenue: number;
  noShowRate: number;
  totalSlots: number;
  filledSlots: number;
  waitlistBookings: number;
  directBookings: number;
  walkInBookings: number;
  completedBookings: number;
  noShowBookings: number;
  canceledBookings: number;
  waitlistRevenue?: number;
  directRevenue?: number;
  walkInRevenue?: number;
  avgResponseTime?: number;
  activeWaitlistEntries?: number;
}

export interface DailyAnalytics {
  date: string;
  total_slots: number;
  filled_slots: number;
  waitlist_bookings: number;
  revenue: number;
  no_shows: number;
  total_bookings?: number;
  notifications_sent?: number;
}

export interface TimeToFillAnalysis {
  data: Array<{
    slot_id: string;
    slot_created_at: string;
    booking_created_at: string;
    time_to_fill_minutes: number;
  }>;
  average: number;
  median: number;
  fastest: number;
  slowest: number;
}

export interface RevenueAnalysis {
  data: Array<{
    booking_id: string;
    service_price: number;
    booking_source: string;
    booking_status: string;
    booking_date: string;
  }>;
  totalRevenue: number;
  waitlistRevenue: number;
  directRevenue: number;
  walkInRevenue: number;
  averageBookingValue: number;
}

export interface PotentialNoShow {
  id: string;
  customer_name: string;
  customer_phone: string;
  service_name: string;
  staff_name: string;
  slot_start_time: string;
  status: string;
}

export const analyticsService = {
  // Get comprehensive analytics metrics
  async getMetrics(startDate: string, endDate: string): Promise<AnalyticsMetrics> {
    const response = await api.get('/analytics/metrics', {
      params: { startDate, endDate }
    });
    return response.data.data;
  },

  // Get quick analytics for common periods
  async getQuickAnalytics(period: 'today' | 'week' | 'month' | 'quarter'): Promise<AnalyticsMetrics> {
    const response = await api.get(`/analytics/quick/${period}`);
    return response.data.data;
  },

  // Get daily analytics for charting
  async getDailyAnalytics(startDate: string, endDate: string): Promise<DailyAnalytics[]> {
    const response = await api.get('/analytics/daily', {
      params: { startDate, endDate }
    });
    return response.data.data;
  },

  // Get time-to-fill analysis
  async getTimeToFillAnalysis(startDate: string, endDate: string): Promise<TimeToFillAnalysis> {
    const response = await api.get('/analytics/time-to-fill', {
      params: { startDate, endDate }
    });
    return response.data.data;
  },

  // Get revenue analysis
  async getRevenueAnalysis(startDate: string, endDate: string): Promise<RevenueAnalysis> {
    const response = await api.get('/analytics/revenue', {
      params: { startDate, endDate }
    });
    return response.data.data;
  },

  // Export analytics data as CSV
  async exportData(
    startDate: string, 
    endDate: string, 
    format: 'metrics' | 'time-to-fill' | 'revenue' | 'daily' = 'metrics'
  ): Promise<Blob> {
    const response = await api.get('/analytics/export', {
      params: { startDate, endDate, format },
      responseType: 'blob'
    });
    return response.data;
  },

  // Get potential no-shows
  async getPotentialNoShows(): Promise<PotentialNoShow[]> {
    const response = await api.get('/analytics/no-shows/potential');
    return response.data.data;
  },

  // Mark booking as no-show
  async markNoShow(bookingId: string): Promise<void> {
    await api.post('/analytics/no-shows/mark', { bookingId });
  }
};