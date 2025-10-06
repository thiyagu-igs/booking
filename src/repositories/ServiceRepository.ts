import { BaseRepository } from './BaseRepository';
import { Service } from '../models';
import db from '../database/connection';

export class ServiceRepository extends BaseRepository<Service> {
  protected tableName = 'services';

  /**
   * Find all active services for the current tenant
   */
  async findActive(): Promise<Service[]> {
    return this.findAll({ active: true } as Partial<Service>);
  }

  /**
   * Find service by name
   */
  async findByName(name: string): Promise<Service | null> {
    return this.findOne({ name } as Partial<Service>);
  }

  /**
   * Check if service name is available within the tenant
   */
  async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    const query = this.db(this.tableName)
      .where({ tenant_id: this.tenantId, name });
    
    if (excludeId) {
      query.whereNot({ id: excludeId });
    }
    
    const count = await query.count('* as count').first();
    return parseInt(count?.count as string) === 0;
  }

  /**
   * Deactivate service (soft delete)
   */
  async deactivate(id: string): Promise<Service | null> {
    return this.update(id, { active: false });
  }

  /**
   * Reactivate service
   */
  async reactivate(id: string): Promise<Service | null> {
    return this.update(id, { active: true });
  }

  /**
   * Find services by duration range
   */
  async findByDurationRange(minDuration: number, maxDuration: number): Promise<Service[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('duration_minutes', '>=', minDuration)
      .andWhere('duration_minutes', '<=', maxDuration)
      .andWhere('active', true);
  }

  /**
   * Find services by price range
   */
  async findByPriceRange(minPrice: number, maxPrice: number): Promise<Service[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('price', '>=', minPrice)
      .andWhere('price', '<=', maxPrice)
      .andWhere('active', true);
  }

  /**
   * Get services with their waitlist entry counts
   */
  async findWithWaitlistCounts(): Promise<Array<Service & { waitlist_entries: number }>> {
    return this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        this.db.raw('COUNT(waitlist_entries.id) as waitlist_entries')
      ])
      .leftJoin('waitlist_entries', function() {
        this.on('services.id', '=', 'waitlist_entries.service_id')
          .andOn('waitlist_entries.tenant_id', '=', 'services.tenant_id')
          .andOn('waitlist_entries.status', '=', db.raw('?', ['active']));
      })
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .groupBy(`${this.tableName}.id`);
  }

  /**
   * Get service statistics
   */
  async getServiceStats(serviceId: string): Promise<{
    total_slots: number;
    booked_slots: number;
    active_waitlist: number;
    total_revenue: number;
  }> {
    const [slotStats, waitlistCount, revenueStats] = await Promise.all([
      this.db('slots')
        .where({ tenant_id: this.tenantId, service_id: serviceId })
        .select([
          this.db.raw('COUNT(*) as total_slots'),
          this.db.raw('COUNT(CASE WHEN status = "booked" THEN 1 END) as booked_slots')
        ])
        .first(),
      
      this.db('waitlist_entries')
        .where({ tenant_id: this.tenantId, service_id: serviceId, status: 'active' })
        .count('* as count')
        .first(),
      
      this.db('bookings')
        .join('slots', 'bookings.slot_id', 'slots.id')
        .join('services', 'slots.service_id', 'services.id')
        .where({
          'bookings.tenant_id': this.tenantId,
          'services.id': serviceId,
          'bookings.status': 'completed'
        })
        .sum('services.price as total_revenue')
        .first()
    ]);

    return {
      total_slots: parseInt(slotStats?.total_slots as string) || 0,
      booked_slots: parseInt(slotStats?.booked_slots as string) || 0,
      active_waitlist: parseInt(waitlistCount?.count as string) || 0,
      total_revenue: parseFloat(revenueStats?.total_revenue as string) || 0
    };
  }
}