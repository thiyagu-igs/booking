import { BaseRepository } from './BaseRepository';
import { Slot, SlotStatus } from '../models';

export class SlotRepository extends BaseRepository<Slot> {
  protected tableName = 'slots';

  /**
   * Find slots by status
   */
  async findByStatus(status: SlotStatus): Promise<Slot[]> {
    return this.findAll({ status } as Partial<Slot>);
  }

  /**
   * Find open slots
   */
  async findOpen(): Promise<Slot[]> {
    return this.findByStatus(SlotStatus.OPEN);
  }

  /**
   * Find slots by staff member
   */
  async findByStaff(staffId: string): Promise<Slot[]> {
    return this.findAll({ staff_id: staffId } as Partial<Slot>);
  }

  /**
   * Find slots by service
   */
  async findByService(serviceId: string): Promise<Slot[]> {
    return this.findAll({ service_id: serviceId } as Partial<Slot>);
  }

  /**
   * Find slots within a date range
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Slot[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('start_time', '>=', startDate)
      .andWhere('start_time', '<=', endDate)
      .orderBy('start_time', 'asc');
  }

  /**
   * Find slots with staff and service details
   */
  async findWithDetails(conditions: Partial<Slot> = {}): Promise<Array<Slot & {
    staff_name: string;
    service_name: string;
    service_duration: number;
  }>> {
    return this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        'staff.name as staff_name',
        'services.name as service_name',
        'services.duration_minutes as service_duration'
      ])
      .join('staff', `${this.tableName}.staff_id`, 'staff.id')
      .join('services', `${this.tableName}.service_id`, 'services.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere(conditions)
      .orderBy(`${this.tableName}.start_time`, 'asc');
  }

  /**
   * Find conflicting slots for a staff member in a time range
   */
  async findConflictingSlots(staffId: string, startTime: Date, endTime: Date, excludeId?: string): Promise<Slot[]> {
    const query = this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('staff_id', staffId)
      .andWhere(function() {
        this.where(function() {
          // Slot starts during the new time range
          this.where('start_time', '>=', startTime)
            .andWhere('start_time', '<', endTime);
        })
        .orWhere(function() {
          // Slot ends during the new time range
          this.where('end_time', '>', startTime)
            .andWhere('end_time', '<=', endTime);
        })
        .orWhere(function() {
          // Slot completely encompasses the new time range
          this.where('start_time', '<=', startTime)
            .andWhere('end_time', '>=', endTime);
        });
      })
      .andWhereNot('status', SlotStatus.CANCELED);

    if (excludeId) {
      query.whereNot('id', excludeId);
    }

    return query;
  }

  /**
   * Hold a slot for a specific duration
   */
  async holdSlot(id: string, holdDurationMinutes: number = 10): Promise<Slot | null> {
    const holdExpiresAt = new Date();
    holdExpiresAt.setMinutes(holdExpiresAt.getMinutes() + holdDurationMinutes);

    return this.update(id, {
      status: SlotStatus.HELD,
      hold_expires_at: holdExpiresAt
    });
  }

  /**
   * Release held slot back to open status
   */
  async releaseHold(id: string): Promise<Slot | null> {
    return this.update(id, {
      status: SlotStatus.OPEN,
      hold_expires_at: undefined
    });
  }

  /**
   * Book a slot
   */
  async bookSlot(id: string): Promise<Slot | null> {
    return this.update(id, {
      status: SlotStatus.BOOKED,
      hold_expires_at: undefined
    });
  }

  /**
   * Cancel a slot
   */
  async cancelSlot(id: string): Promise<Slot | null> {
    return this.update(id, {
      status: SlotStatus.CANCELED,
      hold_expires_at: undefined
    });
  }

  /**
   * Find expired held slots
   */
  async findExpiredHolds(): Promise<Slot[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('status', SlotStatus.HELD)
      .andWhere('hold_expires_at', '<', new Date());
  }

  /**
   * Release all expired holds for the tenant
   */
  async releaseExpiredHolds(): Promise<number> {
    const updated = await this.db(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('status', SlotStatus.HELD)
      .andWhere('hold_expires_at', '<', new Date())
      .update({
        status: SlotStatus.OPEN,
        hold_expires_at: null,
        updated_at: new Date()
      });

    return updated;
  }

  /**
   * Get slot statistics for a date range
   */
  async getSlotStats(startDate: Date, endDate: Date): Promise<{
    total_slots: number;
    open_slots: number;
    held_slots: number;
    booked_slots: number;
    canceled_slots: number;
  }> {
    const stats = await this.db(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('start_time', '>=', startDate)
      .andWhere('start_time', '<=', endDate)
      .select([
        this.db.raw('COUNT(*) as total_slots'),
        this.db.raw('COUNT(CASE WHEN status = "open" THEN 1 END) as open_slots'),
        this.db.raw('COUNT(CASE WHEN status = "held" THEN 1 END) as held_slots'),
        this.db.raw('COUNT(CASE WHEN status = "booked" THEN 1 END) as booked_slots'),
        this.db.raw('COUNT(CASE WHEN status = "canceled" THEN 1 END) as canceled_slots')
      ])
      .first();

    return {
      total_slots: parseInt(stats?.total_slots as string) || 0,
      open_slots: parseInt(stats?.open_slots as string) || 0,
      held_slots: parseInt(stats?.held_slots as string) || 0,
      booked_slots: parseInt(stats?.booked_slots as string) || 0,
      canceled_slots: parseInt(stats?.canceled_slots as string) || 0
    };
  }
}