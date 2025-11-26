import { BaseRepository } from './BaseRepository';
import { Booking, BookingStatus, BookingSource } from '../models';

export interface BookingWithDetails extends Booking {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  service_name: string;
  service_duration: number;
  staff_name: string;
  slot_start_time: Date;
  slot_end_time: Date;
}

export interface BookingStats {
  total_bookings: number;
  today_bookings: number;
  upcoming_bookings: number;
  completed_bookings: number;
  no_show_count: number;
  no_show_rate: number;
  canceled_bookings: number;
  by_source: {
    waitlist: number;
    direct: number;
    walk_in: number;
  };
  by_status: {
    confirmed: number;
    completed: number;
    no_show: number;
    canceled: number;
  };
}

export class BookingRepository extends BaseRepository<Booking> {
  protected tableName = 'bookings';

  /**
   * Find bookings with details (joins with slots, services, and staff)
   */
  async findWithDetails(conditions: Partial<Booking> = {}): Promise<BookingWithDetails[]> {
    return this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        'services.name as service_name',
        'services.duration_minutes as service_duration',
        'staff.name as staff_name',
        'slots.start_time as slot_start_time',
        'slots.end_time as slot_end_time'
      ])
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .join('services', 'slots.service_id', 'services.id')
      .join('staff', 'slots.staff_id', 'staff.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere(conditions)
      .orderBy('slots.start_time', 'desc');
  }

  /**
   * Find booking by ID with full details
   */
  async findByIdWithDetails(bookingId: string): Promise<BookingWithDetails | null> {
    const result = await this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        'services.name as service_name',
        'services.duration_minutes as service_duration',
        'staff.name as staff_name',
        'slots.start_time as slot_start_time',
        'slots.end_time as slot_end_time'
      ])
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .join('services', 'slots.service_id', 'services.id')
      .join('staff', 'slots.staff_id', 'staff.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere(`${this.tableName}.id`, bookingId)
      .first();

    return result || null;
  }

  /**
   * Find bookings by slot ID
   */
  async findBySlotId(slotId: string): Promise<Booking[]> {
    return this.findAll({ slot_id: slotId } as Partial<Booking>);
  }

  /**
   * Find bookings by customer phone
   */
  async findByCustomerPhone(phone: string): Promise<Booking[]> {
    return this.findAll({ customer_phone: phone } as Partial<Booking>);
  }

  /**
   * Find bookings by date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]> {
    return this.db(this.tableName)
      .select(`${this.tableName}.*`)
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere('slots.start_time', '>=', startDate)
      .andWhere('slots.start_time', '<=', endDate)
      .orderBy('slots.start_time', 'asc');
  }

  /**
   * Find today's bookings
   */
  async findToday(): Promise<Booking[]> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.findByDateRange(startOfDay, endOfDay);
  }

  /**
   * Find upcoming bookings (next N days)
   */
  async findUpcoming(days: number = 7): Promise<Booking[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.findByDateRange(now, futureDate);
  }

  /**
   * Get booking statistics for dashboard
   */
  async getBookingStats(startDate: Date, endDate: Date): Promise<BookingStats> {
    // Get counts by status and source
    const stats = await this.db(this.tableName)
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere('slots.start_time', '>=', startDate)
      .andWhere('slots.start_time', '<=', endDate)
      .select([
        this.db.raw('COUNT(*) as total_bookings'),
        this.db.raw('COUNT(CASE WHEN status = "confirmed" THEN 1 END) as confirmed'),
        this.db.raw('COUNT(CASE WHEN status = "completed" THEN 1 END) as completed'),
        this.db.raw('COUNT(CASE WHEN status = "no_show" THEN 1 END) as no_show'),
        this.db.raw('COUNT(CASE WHEN status = "canceled" THEN 1 END) as canceled'),
        this.db.raw('COUNT(CASE WHEN booking_source = "waitlist" THEN 1 END) as source_waitlist'),
        this.db.raw('COUNT(CASE WHEN booking_source = "direct" THEN 1 END) as source_direct'),
        this.db.raw('COUNT(CASE WHEN booking_source = "walk_in" THEN 1 END) as source_walk_in')
      ])
      .first();

    // Get today's bookings count
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayStats = await this.db(this.tableName)
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere('slots.start_time', '>=', startOfDay)
      .andWhere('slots.start_time', '<=', endOfDay)
      .count('* as count')
      .first();

    // Get upcoming bookings count (next 7 days)
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const upcomingStats = await this.db(this.tableName)
      .join('slots', `${this.tableName}.slot_id`, 'slots.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere('slots.start_time', '>=', now)
      .andWhere('slots.start_time', '<=', futureDate)
      .count('* as count')
      .first();

    const totalBookings = parseInt(stats?.total_bookings as string) || 0;
    const completedBookings = parseInt(stats?.completed as string) || 0;
    const noShowCount = parseInt(stats?.no_show as string) || 0;
    
    // Calculate no-show rate (no-shows / (completed + no-shows))
    const totalCompleted = completedBookings + noShowCount;
    const noShowRate = totalCompleted > 0 ? (noShowCount / totalCompleted) * 100 : 0;

    return {
      total_bookings: totalBookings,
      today_bookings: parseInt(todayStats?.count as string) || 0,
      upcoming_bookings: parseInt(upcomingStats?.count as string) || 0,
      completed_bookings: completedBookings,
      no_show_count: noShowCount,
      no_show_rate: parseFloat(noShowRate.toFixed(2)),
      canceled_bookings: parseInt(stats?.canceled as string) || 0,
      by_source: {
        waitlist: parseInt(stats?.source_waitlist as string) || 0,
        direct: parseInt(stats?.source_direct as string) || 0,
        walk_in: parseInt(stats?.source_walk_in as string) || 0
      },
      by_status: {
        confirmed: parseInt(stats?.confirmed as string) || 0,
        completed: completedBookings,
        no_show: noShowCount,
        canceled: parseInt(stats?.canceled as string) || 0
      }
    };
  }

  /**
   * Count bookings by status
   */
  async countByStatus(status: BookingStatus): Promise<number> {
    return this.count({ status } as Partial<Booking>);
  }

  /**
   * Count bookings by source
   */
  async countBySource(source: BookingSource): Promise<number> {
    return this.count({ booking_source: source } as Partial<Booking>);
  }
}
