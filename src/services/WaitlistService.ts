import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { WaitlistEntry, WaitlistStatus, NotificationType } from '../models';

/**
 * Type guard to check if a string is a valid NotificationType
 */
function isValidNotificationType(value: string): value is NotificationType {
  return Object.values(NotificationType).includes(value as NotificationType);
}

/**
 * Validates and converts string array to NotificationType array
 * Filters out invalid notification types
 */
function validateNotificationChannels(channels: string[]): NotificationType[] {
  return channels.filter(isValidNotificationType);
}

export interface CreateWaitlistEntryData {
  customer_name: string;
  phone: string;
  email?: string;
  service_id: string;
  staff_id?: string;
  earliest_time: Date;
  latest_time: Date;
  vip_status?: boolean;
  notification_channels?: string[];
  preferred_channel?: string;
}

export interface WaitlistFilters {
  status?: WaitlistStatus;
  service_id?: string;
  staff_id?: string;
  vip_status?: boolean;
  phone?: string;
  start_date?: Date;
  end_date?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface PriorityWeights {
  base_score: number;
  vip_bonus: number;
  service_match_bonus: number;
  staff_preference_bonus: number;
  time_window_bonus: number;
  recency_bonus_per_week: number;
  max_recency_bonus: number;
}

export interface WaitlistStats {
  total_active: number;
  total_notified: number;
  total_confirmed: number;
  total_removed: number;
  avg_priority_score: number;
  vip_count: number;
}

export class WaitlistService {
  private waitlistRepo: WaitlistRepository;
  private serviceRepo: ServiceRepository;
  private staffRepo: StaffRepository;
  
  // Default priority weights - can be made configurable per tenant
  private defaultWeights: PriorityWeights = {
    base_score: 20,
    vip_bonus: 15,
    service_match_bonus: 15,
    staff_preference_bonus: 10,
    time_window_bonus: 10,
    recency_bonus_per_week: 1,
    max_recency_bonus: 20
  };

  constructor(
    waitlistRepo: WaitlistRepository,
    serviceRepo: ServiceRepository,
    staffRepo: StaffRepository
  ) {
    this.waitlistRepo = waitlistRepo;
    this.serviceRepo = serviceRepo;
    this.staffRepo = staffRepo;
  }

  /**
   * Create a new waitlist entry with validation
   */
  async createWaitlistEntry(data: CreateWaitlistEntryData): Promise<WaitlistEntry> {
    // Validate service exists and is active
    const service = await this.serviceRepo.findById(data.service_id);
    if (!service || !service.active) {
      throw new Error('Service not found or inactive');
    }

    // Validate staff exists and is active (if specified)
    if (data.staff_id) {
      const staff = await this.staffRepo.findById(data.staff_id);
      if (!staff || !staff.active) {
        throw new Error('Staff member not found or inactive');
      }
    }

    // Check maximum 3 active entries per phone per tenant
    const activeCount = await this.waitlistRepo.countActiveByPhone(data.phone);
    if (activeCount >= 3) {
      throw new Error('Maximum 3 active waitlist entries allowed per phone number');
    }

    // Validate time window
    if (data.earliest_time >= data.latest_time) {
      throw new Error('Earliest time must be before latest time');
    }

    // Validate time window is in the future
    const now = new Date();
    if (data.latest_time <= now) {
      throw new Error('Time window must be in the future');
    }

    // Calculate initial priority score
    const priorityScore = this.calculatePriorityScore({
      vip_status: data.vip_status || false,
      staff_id: data.staff_id,
      created_at: now
    });

    // Validate and convert notification channels
    let notificationChannels: NotificationType[] = [];
    
    if (data.notification_channels && data.notification_channels.length > 0) {
      // Validate and filter the provided channels
      notificationChannels = validateNotificationChannels(data.notification_channels);
    }
    
    // Default notification channels based on available contact info if none provided or all invalid
    if (notificationChannels.length === 0) {
      if (data.email) notificationChannels.push(NotificationType.EMAIL);
      if (data.phone) {
        notificationChannels.push(NotificationType.SMS);
        notificationChannels.push(NotificationType.WHATSAPP);
      }
    }

    // Validate and convert preferred channel
    let preferredChannel: NotificationType = NotificationType.EMAIL;
    if (data.preferred_channel && isValidNotificationType(data.preferred_channel)) {
      preferredChannel = data.preferred_channel as NotificationType;
    }

    // Ensure preferred channel is in notification channels
    if (!notificationChannels.includes(preferredChannel)) {
      if (notificationChannels.length > 0) {
        preferredChannel = notificationChannels[0];
      }
    }

    // Create waitlist entry
    const entryData = {
      customer_name: data.customer_name,
      phone: data.phone,
      email: data.email,
      service_id: data.service_id,
      staff_id: data.staff_id,
      earliest_time: data.earliest_time,
      latest_time: data.latest_time,
      priority_score: priorityScore,
      vip_status: data.vip_status || false,
      status: WaitlistStatus.ACTIVE,
      notification_channels: notificationChannels,
      preferred_channel: preferredChannel
    };

    return await this.waitlistRepo.create(entryData);
  }

  /**
   * Get waitlist entries with filtering and pagination
   */
  async getWaitlistEntries(
    filters: WaitlistFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{
    entries: Array<WaitlistEntry & {
      service_name: string;
      service_duration: number;
      staff_name?: string;
    }>;
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }> {
    // Build filter conditions
    const conditions: Partial<WaitlistEntry> = {};
    
    if (filters.status) {
      conditions.status = filters.status;
    }
    if (filters.service_id) {
      conditions.service_id = filters.service_id;
    }
    if (filters.staff_id) {
      conditions.staff_id = filters.staff_id;
    }
    if (filters.vip_status !== undefined) {
      conditions.vip_status = filters.vip_status;
    }
    if (filters.phone) {
      conditions.phone = filters.phone;
    }

    // Get entries with details
    const entries = await this.waitlistRepo.findWithDetails(conditions);
    
    // Apply date filtering if specified
    let filteredEntries = entries;
    if (filters.start_date || filters.end_date) {
      filteredEntries = entries.filter(entry => {
        if (filters.start_date && entry.created_at < filters.start_date) {
          return false;
        }
        if (filters.end_date && entry.created_at > filters.end_date) {
          return false;
        }
        return true;
      });
    }

    // Apply sorting
    const sortBy = pagination.sort_by || 'priority_score';
    const sortOrder = pagination.sort_order || 'desc';
    
    filteredEntries.sort((a, b) => {
      let aValue: any = (a as any)[sortBy];
      let bValue: any = (b as any)[sortBy];
      
      // Handle date sorting
      if (aValue instanceof Date) {
        aValue = aValue.getTime();
        bValue = bValue.getTime();
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const total = filteredEntries.length;
    const totalPages = Math.ceil(total / pagination.limit);
    const offset = (pagination.page - 1) * pagination.limit;
    const paginatedEntries = filteredEntries.slice(offset, offset + pagination.limit);

    return {
      entries: paginatedEntries,
      total,
      page: pagination.page,
      limit: pagination.limit,
      total_pages: totalPages
    };
  }

  /**
   * Remove entry from waitlist with reason tracking
   */
  async removeFromWaitlist(entryId: string, reason?: string): Promise<WaitlistEntry | null> {
    const entry = await this.waitlistRepo.findById(entryId);
    if (!entry) {
      throw new Error('Waitlist entry not found');
    }

    if (entry.status === WaitlistStatus.REMOVED) {
      throw new Error('Entry already removed from waitlist');
    }

    // Update status to removed
    const updatedEntry = await this.waitlistRepo.updateStatus(entryId, WaitlistStatus.REMOVED);
    
    // TODO: In a full implementation, we would log the reason in an audit table
    // For now, we'll just return the updated entry
    
    return updatedEntry;
  }

  /**
   * Update waitlist entry
   */
  async updateWaitlistEntry(
    entryId: string, 
    updates: Partial<CreateWaitlistEntryData>
  ): Promise<WaitlistEntry | null> {
    const entry = await this.waitlistRepo.findById(entryId);
    if (!entry) {
      throw new Error('Waitlist entry not found');
    }

    if (entry.status !== WaitlistStatus.ACTIVE) {
      throw new Error('Can only update active waitlist entries');
    }

    // Validate service if being updated
    if (updates.service_id) {
      const service = await this.serviceRepo.findById(updates.service_id);
      if (!service || !service.active) {
        throw new Error('Service not found or inactive');
      }
    }

    // Validate staff if being updated
    if (updates.staff_id) {
      const staff = await this.staffRepo.findById(updates.staff_id);
      if (!staff || !staff.active) {
        throw new Error('Staff member not found or inactive');
      }
    }

    // Validate time window if being updated
    if (updates.earliest_time || updates.latest_time) {
      const earliestTime = updates.earliest_time || entry.earliest_time;
      const latestTime = updates.latest_time || entry.latest_time;
      
      if (earliestTime >= latestTime) {
        throw new Error('Earliest time must be before latest time');
      }

      const now = new Date();
      if (latestTime <= now) {
        throw new Error('Time window must be in the future');
      }
    }

    // Recalculate priority score if relevant fields changed
    let newPriorityScore = entry.priority_score;
    if (updates.vip_status !== undefined || updates.staff_id !== undefined) {
      newPriorityScore = this.calculatePriorityScore({
        vip_status: updates.vip_status !== undefined ? updates.vip_status : entry.vip_status,
        staff_id: updates.staff_id !== undefined ? updates.staff_id : entry.staff_id,
        created_at: entry.created_at
      });
    }

    // Prepare update data - exclude notification fields that need conversion
    const { notification_channels, preferred_channel, ...otherUpdates } = updates;
    
    const updateData: Partial<WaitlistEntry> = {
      ...otherUpdates,
      priority_score: newPriorityScore,
      updated_at: new Date()
    };

    // Validate and convert notification channels if being updated
    if (notification_channels) {
      updateData.notification_channels = validateNotificationChannels(notification_channels);
    }

    // Validate and convert preferred channel if being updated
    if (preferred_channel) {
      if (isValidNotificationType(preferred_channel)) {
        updateData.preferred_channel = preferred_channel as NotificationType;
      }
      // If invalid, we simply don't update it (keep existing value)
    }

    return await this.waitlistRepo.update(entryId, updateData);
  }

  /**
   * Get waitlist entry by ID
   */
  async getWaitlistEntry(entryId: string): Promise<WaitlistEntry | null> {
    return await this.waitlistRepo.findById(entryId);
  }

  /**
   * Get waitlist statistics
   */
  async getWaitlistStats(): Promise<WaitlistStats> {
    return await this.waitlistRepo.getWaitlistStats();
  }

  /**
   * Find candidates for a slot
   */
  async findCandidatesForSlot(
    serviceId: string,
    staffId: string,
    slotStartTime: Date,
    slotEndTime: Date
  ): Promise<WaitlistEntry[]> {
    return await this.waitlistRepo.findCandidatesForSlot(
      serviceId,
      staffId,
      slotStartTime,
      slotEndTime
    );
  }

  /**
   * Calculate priority score based on business rules
   */
  private calculatePriorityScore(entry: {
    vip_status: boolean;
    staff_id?: string;
    created_at: Date;
  }, weights: PriorityWeights = this.defaultWeights): number {
    let score = weights.base_score;

    // VIP status bonus
    if (entry.vip_status) {
      score += weights.vip_bonus;
    }

    // Service match bonus (always applies since we filter by service)
    score += weights.service_match_bonus;

    // Staff preference bonus
    if (entry.staff_id) {
      score += weights.staff_preference_bonus;
    }

    // Time window compatibility bonus (handled in query, but we add it here)
    score += weights.time_window_bonus;

    // Recency bonus - 1 point per week on waitlist (capped at max)
    const weeksOnWaitlist = Math.floor(
      (Date.now() - entry.created_at.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const recencyBonus = Math.min(
      weeksOnWaitlist * weights.recency_bonus_per_week,
      weights.max_recency_bonus
    );
    score += recencyBonus;

    return score;
  }

  /**
   * Recalculate priority scores for all active entries
   */
  async recalculatePriorityScores(): Promise<number> {
    const activeEntries = await this.waitlistRepo.findActive();
    let updatedCount = 0;

    for (const entry of activeEntries) {
      const newScore = this.calculatePriorityScore(entry);
      if (newScore !== entry.priority_score) {
        await this.waitlistRepo.update(entry.id, { priority_score: newScore });
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Get entries by phone number
   */
  async getEntriesByPhone(phone: string): Promise<WaitlistEntry[]> {
    return await this.waitlistRepo.findByPhone(phone);
  }

  /**
   * Get active entries by phone number
   */
  async getActiveEntriesByPhone(phone: string): Promise<WaitlistEntry[]> {
    return await this.waitlistRepo.findActiveByPhone(phone);
  }
}