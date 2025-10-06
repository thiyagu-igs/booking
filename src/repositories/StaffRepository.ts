import { BaseRepository } from './BaseRepository';
import { Staff } from '../models';
import db from '../database/connection';

export class StaffRepository extends BaseRepository<Staff> {
  protected tableName = 'staff';

  /**
   * Find all active staff members for the current tenant
   */
  async findActive(): Promise<Staff[]> {
    return this.findAll({ active: true } as Partial<Staff>);
  }

  /**
   * Find staff by name
   */
  async findByName(name: string): Promise<Staff | null> {
    return this.findOne({ name } as Partial<Staff>);
  }

  /**
   * Check if staff name is available within the tenant
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
   * Deactivate staff member (soft delete)
   */
  async deactivate(id: string): Promise<Staff | null> {
    return this.update(id, { active: false });
  }

  /**
   * Reactivate staff member
   */
  async reactivate(id: string): Promise<Staff | null> {
    return this.update(id, { active: true });
  }

  /**
   * Get staff with their upcoming slots count
   */
  async findWithSlotCounts(startDate?: Date, endDate?: Date): Promise<Array<Staff & { upcoming_slots: number }>> {
    const query = this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        this.db.raw('COUNT(slots.id) as upcoming_slots')
      ])
      .leftJoin('slots', function() {
        this.on('staff.id', '=', 'slots.staff_id')
          .andOn('slots.tenant_id', '=', 'staff.tenant_id')
          .andOn('slots.status', '=', db.raw('?', ['open']));
      })
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .groupBy(`${this.tableName}.id`);

    if (startDate) {
      query.andWhere('slots.start_time', '>=', startDate);
    }
    if (endDate) {
      query.andWhere('slots.start_time', '<=', endDate);
    }

    return query;
  }
}