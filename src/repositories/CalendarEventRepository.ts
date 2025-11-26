import { BaseRepository } from './BaseRepository';
import { CalendarEvent } from '../models';

export class CalendarEventRepository extends BaseRepository<CalendarEvent> {
  protected tableName = 'calendar_events';

  /**
   * Find calendar event by slot ID
   */
  async findBySlotId(slotId: string): Promise<CalendarEvent | null> {
    return this.findOne({ slot_id: slotId });
  }

  /**
   * Find calendar events by staff ID
   */
  async findByStaffId(staffId: string): Promise<CalendarEvent[]> {
    return this.findAll({ staff_id: staffId });
  }

  /**
   * Find calendar event by Google event ID
   */
  async findByGoogleEventId(googleEventId: string): Promise<CalendarEvent | null> {
    return this.findOne({ google_event_id: googleEventId });
  }

  /**
   * Find calendar events with specific status
   */
  async findByStatus(status: CalendarEvent['status']): Promise<CalendarEvent[]> {
    return this.findAll({ status } as any);
  }

  /**
   * Find calendar events that need cleanup (deleted slots but events still exist)
   */
  async findOrphanedEvents(): Promise<CalendarEvent[]> {
    return this.db
      .select('calendar_events.*')
      .from(this.tableName)
      .leftJoin('slots', 'calendar_events.slot_id', 'slots.id')
      .where('calendar_events.tenant_id', this.tenantId)
      .where('calendar_events.status', '!=', 'deleted')
      .whereNull('slots.id');
  }

  /**
   * Get calendar sync statistics for a tenant
   */
  async getSyncStats(): Promise<{
    total: number;
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const stats = await this.db(this.tableName)
      .where('tenant_id', this.tenantId)
      .select('status')
      .count('* as count')
      .groupBy('status');

    const result = {
      total: 0,
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    };

    stats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      result.total += count;
      
      switch (stat.status) {
        case 'created':
          result.created = count;
          break;
        case 'updated':
          result.updated = count;
          break;
        case 'deleted':
          result.deleted = count;
          break;
        case 'error':
          result.errors = count;
          break;
      }
    });

    return result;
  }

  /**
   * Clean up calendar events for deleted slots
   */
  async cleanupOrphanedEvents(): Promise<number> {
    const orphanedEvents = await this.findOrphanedEvents();
    
    if (orphanedEvents.length === 0) {
      return 0;
    }

    const orphanedIds = orphanedEvents.map(event => event.id);
    
    const deleted = await this.db(this.tableName)
      .whereIn('id', orphanedIds)
      .where('tenant_id', this.tenantId)
      .update({
        status: 'deleted',
        updated_at: new Date()
      });

    return deleted;
  }
}