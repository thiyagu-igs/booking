import { BaseRepository } from './BaseRepository';
import { Booking, BookingSource, BookingStatus } from '../models';

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
}

export interface TimeToFillData {
  slot_id: string;
  slot_created_at: Date;
  booking_created_at: Date;
  time_to_fill_minutes: number;
}

export interface RevenueData {
  booking_id: string;
  service_price: number;
  booking_source: BookingSource;
  booking_status: BookingStatus;
  booking_date: Date;
}

export class AnalyticsRepository extends BaseRepository {
  protected tableName = 'bookings'; // Primary table, but we'll join across multiple

  /**
   * Calculate fill rate - percentage of open slots that were booked through waitlist
   */
  async calculateFillRate(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.db.raw(`
      SELECT 
        COUNT(CASE WHEN s.status = 'booked' AND b.booking_source = 'waitlist' THEN 1 END) as waitlist_filled,
        COUNT(CASE WHEN s.status IN ('open', 'booked', 'canceled') THEN 1 END) as total_slots
      FROM slots s
      LEFT JOIN bookings b ON s.id = b.slot_id AND b.tenant_id = ?
      WHERE s.tenant_id = ? 
        AND s.start_time >= ? 
        AND s.start_time <= ?
    `, [this.tenantId, this.tenantId, startDate, endDate]);

    const data = result[0][0];
    const waitlistFilled = parseInt(data.waitlist_filled) || 0;
    const totalSlots = parseInt(data.total_slots) || 0;

    return totalSlots > 0 ? (waitlistFilled / totalSlots) * 100 : 0;
  }

  /**
   * Calculate median time to fill slots (in minutes)
   */
  async calculateMedianTimeToFill(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.db.raw(`
      SELECT 
        TIMESTAMPDIFF(MINUTE, s.created_at, b.created_at) as time_to_fill_minutes
      FROM slots s
      INNER JOIN bookings b ON s.id = b.slot_id
      WHERE s.tenant_id = ? 
        AND b.tenant_id = ?
        AND b.booking_source = 'waitlist'
        AND s.start_time >= ? 
        AND s.start_time <= ?
        AND b.status IN ('confirmed', 'completed')
      ORDER BY time_to_fill_minutes
    `, [this.tenantId, this.tenantId, startDate, endDate]);

    const times = result[0].map((row: any) => parseInt(row.time_to_fill_minutes));
    
    if (times.length === 0) return 0;
    
    const middle = Math.floor(times.length / 2);
    return times.length % 2 === 0 
      ? (times[middle - 1] + times[middle]) / 2 
      : times[middle];
  }

  /**
   * Calculate total revenue from waitlist bookings
   */
  async calculateWaitlistRevenue(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.db.raw(`
      SELECT 
        COALESCE(SUM(srv.price), 0) as total_revenue
      FROM bookings b
      INNER JOIN slots s ON b.slot_id = s.id
      INNER JOIN services srv ON s.service_id = srv.id
      WHERE b.tenant_id = ? 
        AND b.booking_source = 'waitlist'
        AND b.status IN ('confirmed', 'completed')
        AND s.start_time >= ? 
        AND s.start_time <= ?
    `, [this.tenantId, startDate, endDate]);

    return parseFloat(result[0][0].total_revenue) || 0;
  }

  /**
   * Calculate no-show rate for waitlist bookings
   */
  async calculateNoShowRate(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.db.raw(`
      SELECT 
        COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_shows,
        COUNT(*) as total_bookings
      FROM bookings b
      INNER JOIN slots s ON b.slot_id = s.id
      WHERE b.tenant_id = ? 
        AND b.booking_source = 'waitlist'
        AND s.start_time >= ? 
        AND s.start_time <= ?
        AND b.status IN ('completed', 'no_show')
    `, [this.tenantId, startDate, endDate]);

    const data = result[0][0];
    const noShows = parseInt(data.no_shows) || 0;
    const totalBookings = parseInt(data.total_bookings) || 0;

    return totalBookings > 0 ? (noShows / totalBookings) * 100 : 0;
  }

  /**
   * Get comprehensive analytics metrics for a date range
   */
  async getAnalyticsMetrics(startDate: Date, endDate: Date): Promise<AnalyticsMetrics> {
    const [fillRate, medianTimeToFill, totalRevenue, noShowRate] = await Promise.all([
      this.calculateFillRate(startDate, endDate),
      this.calculateMedianTimeToFill(startDate, endDate),
      this.calculateWaitlistRevenue(startDate, endDate),
      this.calculateNoShowRate(startDate, endDate)
    ]);

    // Get booking breakdown
    const bookingStats = await this.db.raw(`
      SELECT 
        COUNT(CASE WHEN s.status IN ('open', 'booked', 'canceled') THEN 1 END) as total_slots,
        COUNT(CASE WHEN s.status = 'booked' THEN 1 END) as filled_slots,
        COUNT(CASE WHEN b.booking_source = 'waitlist' THEN 1 END) as waitlist_bookings,
        COUNT(CASE WHEN b.booking_source = 'direct' THEN 1 END) as direct_bookings,
        COUNT(CASE WHEN b.booking_source = 'walk_in' THEN 1 END) as walk_in_bookings,
        COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed_bookings,
        COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_show_bookings,
        COUNT(CASE WHEN b.status = 'canceled' THEN 1 END) as canceled_bookings
      FROM slots s
      LEFT JOIN bookings b ON s.id = b.slot_id AND b.tenant_id = ?
      WHERE s.tenant_id = ? 
        AND s.start_time >= ? 
        AND s.start_time <= ?
    `, [this.tenantId, this.tenantId, startDate, endDate]);

    const stats = bookingStats[0][0];

    return {
      fillRate,
      medianTimeToFill,
      totalRevenue,
      noShowRate,
      totalSlots: parseInt(stats.total_slots) || 0,
      filledSlots: parseInt(stats.filled_slots) || 0,
      waitlistBookings: parseInt(stats.waitlist_bookings) || 0,
      directBookings: parseInt(stats.direct_bookings) || 0,
      walkInBookings: parseInt(stats.walk_in_bookings) || 0,
      completedBookings: parseInt(stats.completed_bookings) || 0,
      noShowBookings: parseInt(stats.no_show_bookings) || 0,
      canceledBookings: parseInt(stats.canceled_bookings) || 0
    };
  }

  /**
   * Get time-to-fill data for detailed analysis
   */
  async getTimeToFillData(startDate: Date, endDate: Date): Promise<TimeToFillData[]> {
    const result = await this.db.raw(`
      SELECT 
        s.id as slot_id,
        s.created_at as slot_created_at,
        b.created_at as booking_created_at,
        TIMESTAMPDIFF(MINUTE, s.created_at, b.created_at) as time_to_fill_minutes
      FROM slots s
      INNER JOIN bookings b ON s.id = b.slot_id
      WHERE s.tenant_id = ? 
        AND b.tenant_id = ?
        AND b.booking_source = 'waitlist'
        AND s.start_time >= ? 
        AND s.start_time <= ?
        AND b.status IN ('confirmed', 'completed')
      ORDER BY s.created_at
    `, [this.tenantId, this.tenantId, startDate, endDate]);

    return result[0].map((row: any) => ({
      slot_id: row.slot_id,
      slot_created_at: new Date(row.slot_created_at),
      booking_created_at: new Date(row.booking_created_at),
      time_to_fill_minutes: parseInt(row.time_to_fill_minutes)
    }));
  }

  /**
   * Get revenue breakdown data
   */
  async getRevenueData(startDate: Date, endDate: Date): Promise<RevenueData[]> {
    const result = await this.db.raw(`
      SELECT 
        b.id as booking_id,
        COALESCE(srv.price, 0) as service_price,
        b.booking_source,
        b.status as booking_status,
        s.start_time as booking_date
      FROM bookings b
      INNER JOIN slots s ON b.slot_id = s.id
      INNER JOIN services srv ON s.service_id = srv.id
      WHERE b.tenant_id = ? 
        AND s.start_time >= ? 
        AND s.start_time <= ?
      ORDER BY s.start_time
    `, [this.tenantId, startDate, endDate]);

    return result[0].map((row: any) => ({
      booking_id: row.booking_id,
      service_price: parseFloat(row.service_price) || 0,
      booking_source: row.booking_source as BookingSource,
      booking_status: row.booking_status as BookingStatus,
      booking_date: new Date(row.booking_date)
    }));
  }

  /**
   * Get daily analytics summary for charting
   */
  async getDailyAnalytics(startDate: Date, endDate: Date): Promise<Array<{
    date: string;
    total_slots: number;
    filled_slots: number;
    waitlist_bookings: number;
    revenue: number;
    no_shows: number;
  }>> {
    const result = await this.db.raw(`
      SELECT 
        DATE(s.start_time) as date,
        COUNT(CASE WHEN s.status IN ('open', 'booked', 'canceled') THEN 1 END) as total_slots,
        COUNT(CASE WHEN s.status = 'booked' THEN 1 END) as filled_slots,
        COUNT(CASE WHEN b.booking_source = 'waitlist' THEN 1 END) as waitlist_bookings,
        COALESCE(SUM(CASE WHEN b.booking_source = 'waitlist' AND b.status IN ('confirmed', 'completed') THEN srv.price END), 0) as revenue,
        COUNT(CASE WHEN b.status = 'no_show' THEN 1 END) as no_shows
      FROM slots s
      LEFT JOIN bookings b ON s.id = b.slot_id AND b.tenant_id = ?
      LEFT JOIN services srv ON s.service_id = srv.id
      WHERE s.tenant_id = ? 
        AND s.start_time >= ? 
        AND s.start_time <= ?
      GROUP BY DATE(s.start_time)
      ORDER BY date
    `, [this.tenantId, this.tenantId, startDate, endDate]);

    return result[0].map((row: any) => ({
      date: row.date,
      total_slots: parseInt(row.total_slots) || 0,
      filled_slots: parseInt(row.filled_slots) || 0,
      waitlist_bookings: parseInt(row.waitlist_bookings) || 0,
      revenue: parseFloat(row.revenue) || 0,
      no_shows: parseInt(row.no_shows) || 0
    }));
  }

  /**
   * Mark a booking as no-show
   */
  async markNoShow(bookingId: string): Promise<boolean> {
    const updated = await this.db('bookings')
      .where({ id: bookingId, tenant_id: this.tenantId })
      .update({ 
        status: BookingStatus.NO_SHOW,
        updated_at: new Date()
      });

    return updated > 0;
  }

  /**
   * Get bookings that might be no-shows (past appointment time, still confirmed)
   */
  async getPotentialNoShows(): Promise<Array<Booking & {
    service_name: string;
    staff_name: string;
    slot_start_time: Date;
  }>> {
    const result = await this.db('bookings as b')
      .select([
        'b.*',
        'srv.name as service_name',
        'st.name as staff_name',
        's.start_time as slot_start_time'
      ])
      .join('slots as s', 'b.slot_id', 's.id')
      .join('services as srv', 's.service_id', 'srv.id')
      .join('staff as st', 's.staff_id', 'st.id')
      .where('b.tenant_id', this.tenantId)
      .andWhere('b.status', BookingStatus.CONFIRMED)
      .andWhere('s.start_time', '<', new Date())
      .orderBy('s.start_time', 'desc');

    return result;
  }
}