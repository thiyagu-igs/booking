import { BaseRepository } from './BaseRepository';
import { WaitlistEntry, WaitlistStatus } from '../models';

export class WaitlistRepository extends BaseRepository<WaitlistEntry> {
  protected tableName = 'waitlist_entries';

  /**
   * Find active waitlist entries
   */
  async findActive(): Promise<WaitlistEntry[]> {
    return this.findAll({ status: WaitlistStatus.ACTIVE } as Partial<WaitlistEntry>);
  }

  /**
   * Find waitlist entries by phone number
   */
  async findByPhone(phone: string): Promise<WaitlistEntry[]> {
    return this.findAll({ phone } as Partial<WaitlistEntry>);
  }

  /**
   * Find active waitlist entries by phone number
   */
  async findActiveByPhone(phone: string): Promise<WaitlistEntry[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where({
        tenant_id: this.tenantId,
        phone,
        status: WaitlistStatus.ACTIVE
      });
  }

  /**
   * Count active entries for a phone number (for validation)
   */
  async countActiveByPhone(phone: string): Promise<number> {
    const result = await this.db(this.tableName)
      .where({
        tenant_id: this.tenantId,
        phone,
        status: WaitlistStatus.ACTIVE
      })
      .count('* as count')
      .first();

    return parseInt(result?.count as string) || 0;
  }

  /**
   * Find waitlist entries by service
   */
  async findByService(serviceId: string): Promise<WaitlistEntry[]> {
    return this.findAll({ service_id: serviceId } as Partial<WaitlistEntry>);
  }

  /**
   * Find waitlist entries by staff preference
   */
  async findByStaff(staffId: string): Promise<WaitlistEntry[]> {
    return this.findAll({ staff_id: staffId } as Partial<WaitlistEntry>);
  }

  /**
   * Find candidates for a slot based on service, staff, and time window
   */
  async findCandidatesForSlot(
    serviceId: string,
    staffId: string,
    slotStartTime: Date,
    slotEndTime: Date
  ): Promise<WaitlistEntry[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where({
        tenant_id: this.tenantId,
        service_id: serviceId,
        status: WaitlistStatus.ACTIVE
      })
      .andWhere(function() {
        // Either no staff preference or matches the slot's staff
        this.whereNull('staff_id').orWhere('staff_id', staffId);
      })
      .andWhere('earliest_time', '<=', slotStartTime)
      .andWhere('latest_time', '>=', slotEndTime)
      .orderBy('priority_score', 'desc')
      .orderBy('created_at', 'asc');
  }

  /**
   * Find waitlist entries with customer and service details
   */
  async findWithDetails(conditions: Partial<WaitlistEntry> = {}): Promise<Array<WaitlistEntry & {
    service_name: string;
    service_duration: number;
    staff_name?: string;
  }>> {
    return this.db(this.tableName)
      .select([
        `${this.tableName}.*`,
        'services.name as service_name',
        'services.duration_minutes as service_duration',
        'staff.name as staff_name'
      ])
      .join('services', `${this.tableName}.service_id`, 'services.id')
      .leftJoin('staff', `${this.tableName}.staff_id`, 'staff.id')
      .where(`${this.tableName}.tenant_id`, this.tenantId)
      .andWhere(conditions)
      .orderBy(`${this.tableName}.priority_score`, 'desc')
      .orderBy(`${this.tableName}.created_at`, 'asc');
  }

  /**
   * Calculate and update priority score for an entry
   */
  async updatePriorityScore(id: string): Promise<WaitlistEntry | null> {
    const entry = await this.findById(id);
    if (!entry) return null;

    const priorityScore = this.calculatePriorityScore(entry);
    return this.update(id, { priority_score: priorityScore });
  }

  /**
   * Calculate priority score based on business rules
   */
  private calculatePriorityScore(entry: WaitlistEntry): number {
    let score = 20; // Base score

    // VIP status bonus
    if (entry.vip_status) {
      score += 15;
    }

    // Service match bonus (always applies since we filter by service)
    score += 15;

    // Staff preference bonus (handled in query, but we can add logic here if needed)
    if (entry.staff_id) {
      score += 10;
    }

    // Time window compatibility bonus (handled in query)
    score += 10;

    // Recency bonus - 1 point per week on waitlist (capped at 20)
    const weeksOnWaitlist = Math.floor(
      (Date.now() - entry.created_at.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    score += Math.min(weeksOnWaitlist, 20);

    return score;
  }

  /**
   * Update entry status
   */
  async updateStatus(id: string, status: WaitlistStatus): Promise<WaitlistEntry | null> {
    return this.update(id, { status });
  }

  /**
   * Remove entry from waitlist with reason
   */
  async removeFromWaitlist(id: string, reason?: string): Promise<WaitlistEntry | null> {
    // In a full implementation, we might want to log the reason
    return this.updateStatus(id, WaitlistStatus.REMOVED);
  }

  /**
   * Find entries that need priority score recalculation
   */
  async findStaleEntries(olderThanHours: number = 24): Promise<WaitlistEntry[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

    return this.db
      .select('*')
      .from(this.tableName)
      .where({
        tenant_id: this.tenantId,
        status: WaitlistStatus.ACTIVE
      })
      .andWhere('updated_at', '<', cutoffTime);
  }

  /**
   * Get waitlist statistics
   */
  async getWaitlistStats(): Promise<{
    total_active: number;
    total_notified: number;
    total_confirmed: number;
    total_removed: number;
    avg_priority_score: number;
    vip_count: number;
  }> {
    const stats = await this.db(this.tableName)
      .where('tenant_id', this.tenantId)
      .select([
        this.db.raw('COUNT(CASE WHEN status = "active" THEN 1 END) as total_active'),
        this.db.raw('COUNT(CASE WHEN status = "notified" THEN 1 END) as total_notified'),
        this.db.raw('COUNT(CASE WHEN status = "confirmed" THEN 1 END) as total_confirmed'),
        this.db.raw('COUNT(CASE WHEN status = "removed" THEN 1 END) as total_removed'),
        this.db.raw('AVG(CASE WHEN status = "active" THEN priority_score END) as avg_priority_score'),
        this.db.raw('COUNT(CASE WHEN vip_status = true AND status = "active" THEN 1 END) as vip_count')
      ])
      .first();

    return {
      total_active: parseInt(stats?.total_active as string) || 0,
      total_notified: parseInt(stats?.total_notified as string) || 0,
      total_confirmed: parseInt(stats?.total_confirmed as string) || 0,
      total_removed: parseInt(stats?.total_removed as string) || 0,
      avg_priority_score: parseFloat(stats?.avg_priority_score as string) || 0,
      vip_count: parseInt(stats?.vip_count as string) || 0
    };
  }

  /**
   * Find entries by time window overlap
   */
  async findByTimeWindow(startTime: Date, endTime: Date): Promise<WaitlistEntry[]> {
    return this.db
      .select('*')
      .from(this.tableName)
      .where('tenant_id', this.tenantId)
      .andWhere('status', WaitlistStatus.ACTIVE)
      .andWhere('earliest_time', '<=', endTime)
      .andWhere('latest_time', '>=', startTime)
      .orderBy('priority_score', 'desc')
      .orderBy('created_at', 'asc');
  }
}