import { BaseRepository } from './BaseRepository';
import { Tenant } from '../models';

export class TenantRepository extends BaseRepository<Tenant> {
  protected tableName = 'tenants';

  /**
   * Override findAll to not filter by tenant_id since tenants table is the root
   */
  async findAll(conditions: Partial<Tenant> = {}): Promise<Tenant[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where(conditions);
  }

  /**
   * Override findById to not filter by tenant_id
   */
  async findById(id: string): Promise<Tenant | null> {
    const result = await this.db
      .select('*')
      .from(this.tableName)
      .where({ id })
      .first();
    
    return result || null;
  }

  /**
   * Find tenant by name
   */
  async findByName(name: string): Promise<Tenant | null> {
    const result = await this.db
      .select('*')
      .from(this.tableName)
      .where({ name })
      .first();
    
    return result || null;
  }

  /**
   * Check if tenant name is available
   */
  async isNameAvailable(name: string, excludeId?: string): Promise<boolean> {
    const query = this.db(this.tableName).where({ name });
    
    if (excludeId) {
      query.whereNot({ id: excludeId });
    }
    
    const count = await query.count('* as count').first();
    return parseInt(count?.count as string) === 0;
  }

  /**
   * Get tenant statistics
   */
  async getStats(tenantId: string): Promise<{
    staff_count: number;
    services_count: number;
    active_waitlist_entries: number;
    total_bookings: number;
  }> {
    const [staffCount, servicesCount, waitlistCount, bookingsCount] = await Promise.all([
      this.db('staff').where({ tenant_id: tenantId, active: true }).count('* as count').first(),
      this.db('services').where({ tenant_id: tenantId, active: true }).count('* as count').first(),
      this.db('waitlist_entries').where({ tenant_id: tenantId, status: 'active' }).count('* as count').first(),
      this.db('bookings').where({ tenant_id: tenantId }).count('* as count').first()
    ]);

    return {
      staff_count: parseInt(staffCount?.count as string) || 0,
      services_count: parseInt(servicesCount?.count as string) || 0,
      active_waitlist_entries: parseInt(waitlistCount?.count as string) || 0,
      total_bookings: parseInt(bookingsCount?.count as string) || 0
    };
  }
}