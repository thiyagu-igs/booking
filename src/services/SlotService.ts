import { SlotRepository } from '../repositories/SlotRepository';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { Slot, SlotStatus, WaitlistEntry, WaitlistStatus } from '../models';
import { WaitlistService } from './WaitlistService';
import { CalendarService } from './CalendarService';
import { logger } from '../config/logger';

export interface CreateSlotData {
  staff_id: string;
  service_id: string;
  start_time: Date;
  end_time: Date;
}

export interface SlotFilters {
  status?: SlotStatus;
  staff_id?: string;
  service_id?: string;
  start_date?: Date;
  end_date?: Date;
}

export interface SlotCandidate extends WaitlistEntry {
  service_name: string;
  staff_name?: string;
  match_score: number;
}

export interface SlotMatchResult {
  slot: Slot;
  candidates: SlotCandidate[];
  top_candidate?: SlotCandidate;
  notification_sent: boolean;
}

export class SlotService {
  private slotRepo: SlotRepository;
  private waitlistRepo: WaitlistRepository;
  private serviceRepo: ServiceRepository;
  private staffRepo: StaffRepository;
  private waitlistService: WaitlistService;
  private calendarService: CalendarService;
  private tenantId: string;

  constructor(
    slotRepo: SlotRepository,
    waitlistRepo: WaitlistRepository,
    serviceRepo: ServiceRepository,
    staffRepo: StaffRepository,
    waitlistService: WaitlistService,
    tenantId: string
  ) {
    this.slotRepo = slotRepo;
    this.waitlistRepo = waitlistRepo;
    this.serviceRepo = serviceRepo;
    this.staffRepo = staffRepo;
    this.waitlistService = waitlistService;
    this.tenantId = tenantId;
    this.calendarService = new CalendarService(tenantId);
  }

  /**
   * Create a new slot with validation
   */
  async createSlot(data: CreateSlotData): Promise<Slot> {
    // Validate service exists and is active
    const service = await this.serviceRepo.findById(data.service_id);
    if (!service || !service.active) {
      throw new Error('Service not found or inactive');
    }

    // Validate staff exists and is active
    const staff = await this.staffRepo.findById(data.staff_id);
    if (!staff || !staff.active) {
      throw new Error('Staff member not found or inactive');
    }

    // Validate time window
    if (data.start_time >= data.end_time) {
      throw new Error('Start time must be before end time');
    }

    // Validate slot is in the future
    const now = new Date();
    if (data.start_time <= now) {
      throw new Error('Slot must be in the future');
    }

    // Check for conflicting slots
    const conflictingSlots = await this.slotRepo.findConflictingSlots(
      data.staff_id,
      data.start_time,
      data.end_time
    );

    if (conflictingSlots.length > 0) {
      throw new Error('Slot conflicts with existing booking');
    }

    // Create slot
    const slotData = {
      staff_id: data.staff_id,
      service_id: data.service_id,
      start_time: data.start_time,
      end_time: data.end_time,
      status: SlotStatus.OPEN
    };

    return await this.slotRepo.create(slotData);
  }

  /**
   * Update slot details
   */
  async updateSlot(slotId: string, updates: Partial<CreateSlotData>): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Can only update open slots
    if (slot.status !== SlotStatus.OPEN) {
      throw new Error('Can only update open slots');
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
    if (updates.start_time || updates.end_time) {
      const startTime = updates.start_time || slot.start_time;
      const endTime = updates.end_time || slot.end_time;
      
      if (startTime >= endTime) {
        throw new Error('Start time must be before end time');
      }

      const now = new Date();
      if (startTime <= now) {
        throw new Error('Slot must be in the future');
      }

      // Check for conflicts with the new time
      const staffId = updates.staff_id || slot.staff_id;
      const conflictingSlots = await this.slotRepo.findConflictingSlots(
        staffId,
        startTime,
        endTime,
        slotId // Exclude current slot from conflict check
      );

      if (conflictingSlots.length > 0) {
        throw new Error('Updated slot would conflict with existing booking');
      }
    }

    return await this.slotRepo.update(slotId, updates);
  }

  /**
   * Mark slot as open and trigger automated waitlist matching
   */
  async openSlot(slotId: string): Promise<SlotMatchResult> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Can only open canceled or held slots
    if (slot.status !== SlotStatus.CANCELED && slot.status !== SlotStatus.HELD) {
      throw new Error('Can only open canceled or held slots');
    }

    // Update slot status to open
    const updatedSlot = await this.slotRepo.update(slotId, {
      status: SlotStatus.OPEN,
      hold_expires_at: undefined
    });

    if (!updatedSlot) {
      throw new Error('Failed to update slot status');
    }

    // Find and rank candidates
    const candidates = await this.findCandidatesForSlot(updatedSlot);
    
    let notificationSent = false;
    let topCandidate: SlotCandidate | undefined;

    // If we have candidates, notify the top one
    if (candidates.length > 0) {
      topCandidate = candidates[0];
      
      // Hold the slot for the top candidate (directly through repository to avoid validation)
      await this.slotRepo.holdSlot(slotId, 10); // 10 minute hold
      
      // Update waitlist entry status to notified
      await this.waitlistRepo.updateStatus(topCandidate.id, WaitlistStatus.NOTIFIED);
      
      // TODO: Send notification (will be implemented in notification service)
      // For now, we'll just mark as sent
      notificationSent = true;
    }

    return {
      slot: updatedSlot,
      candidates,
      top_candidate: topCandidate,
      notification_sent: notificationSent
    };
  }

  /**
   * Find eligible candidates for a slot and rank them by priority
   */
  async findCandidatesForSlot(slot: Slot): Promise<SlotCandidate[]> {
    // Find waitlist entries that match the slot criteria
    const candidates = await this.waitlistRepo.findCandidatesForSlot(
      slot.service_id,
      slot.staff_id,
      slot.start_time,
      slot.end_time
    );

    // Get service and staff details for the candidates
    const service = await this.serviceRepo.findById(slot.service_id);
    const staff = await this.staffRepo.findById(slot.staff_id);

    // Calculate match scores and sort by priority
    const rankedCandidates: SlotCandidate[] = candidates.map(candidate => {
      const matchScore = this.calculateMatchScore(candidate, slot);
      return {
        ...candidate,
        service_name: service?.name || 'Unknown Service',
        staff_name: staff?.name,
        match_score: matchScore
      } as SlotCandidate;
    });

    // Sort by priority score (desc) then by created_at (asc) as tiebreaker
    rankedCandidates.sort((a, b) => {
      if (a.priority_score !== b.priority_score) {
        return b.priority_score - a.priority_score;
      }
      return a.created_at.getTime() - b.created_at.getTime();
    });

    return rankedCandidates;
  }

  /**
   * Hold a slot for a specific duration
   */
  async holdSlot(slotId: string, holdDurationMinutes: number = 10): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    if (slot.status !== SlotStatus.OPEN) {
      throw new Error('Can only hold open slots');
    }

    return await this.slotRepo.holdSlot(slotId, holdDurationMinutes);
  }

  /**
   * Release a held slot back to open status
   */
  async releaseHold(slotId: string): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    if (slot.status !== SlotStatus.HELD) {
      throw new Error('Can only release held slots');
    }

    return await this.slotRepo.releaseHold(slotId);
  }

  /**
   * Book a slot (finalize the booking)
   */
  async bookSlot(slotId: string): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Can book open or held slots
    if (slot.status !== SlotStatus.OPEN && slot.status !== SlotStatus.HELD) {
      throw new Error('Can only book open or held slots');
    }

    // Use database transaction to prevent race conditions
    return await this.slotRepo.bookSlot(slotId);
  }

  /**
   * Book a slot with customer information and calendar integration
   */
  async bookSlotWithCustomer(
    slotId: string, 
    customerName: string, 
    customerEmail?: string
  ): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Can book open or held slots
    if (slot.status !== SlotStatus.OPEN && slot.status !== SlotStatus.HELD) {
      throw new Error('Can only book open or held slots');
    }

    // Book the slot first
    const bookedSlot = await this.slotRepo.bookSlot(slotId);
    if (!bookedSlot) {
      throw new Error('Failed to book slot');
    }

    // Try to create calendar event (non-blocking - fallback to internal management)
    try {
      const service = await this.serviceRepo.findById(bookedSlot.service_id);
      if (service) {
        const calendarResult = await this.calendarService.createEventForSlot({
          slotId: bookedSlot.id,
          staffId: bookedSlot.staff_id,
          customerName,
          customerEmail,
          serviceName: service.name,
          startTime: bookedSlot.start_time,
          endTime: bookedSlot.end_time
        });

        if (calendarResult.success) {
          logger.info(`Calendar event created for booked slot ${slotId}`, {
            slotId,
            eventId: calendarResult.eventId
          });
        } else {
          logger.warn(`Calendar event creation failed for slot ${slotId}`, {
            slotId,
            error: calendarResult.error
          });
        }
      }
    } catch (error) {
      // Log calendar error but don't fail the booking
      logger.error('Calendar integration error during booking', {
        slotId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return bookedSlot;
  }

  /**
   * Cancel a slot
   */
  async cancelSlot(slotId: string): Promise<Slot | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    if (slot.status === SlotStatus.CANCELED) {
      throw new Error('Slot is already canceled');
    }

    // Cancel the slot first
    const canceledSlot = await this.slotRepo.cancelSlot(slotId);
    if (!canceledSlot) {
      throw new Error('Failed to cancel slot');
    }

    // Try to delete calendar event if it exists (non-blocking)
    try {
      const calendarResult = await this.calendarService.deleteEventForSlot(slotId);
      
      if (calendarResult.success) {
        logger.info(`Calendar event deleted for canceled slot ${slotId}`, {
          slotId,
          eventId: calendarResult.eventId
        });
      } else {
        logger.warn(`Calendar event deletion failed for slot ${slotId}`, {
          slotId,
          error: calendarResult.error
        });
      }
    } catch (error) {
      // Log calendar error but don't fail the cancellation
      logger.error('Calendar integration error during cancellation', {
        slotId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return canceledSlot;
  }

  /**
   * Get slots with filtering
   */
  async getSlots(filters: SlotFilters = {}): Promise<Array<Slot & {
    staff_name: string;
    service_name: string;
    service_duration: number;
  }>> {
    const conditions: Partial<Slot> = {};
    
    if (filters.status) {
      conditions.status = filters.status;
    }
    if (filters.staff_id) {
      conditions.staff_id = filters.staff_id;
    }
    if (filters.service_id) {
      conditions.service_id = filters.service_id;
    }

    let slots = await this.slotRepo.findWithDetails(conditions);

    // Apply date filtering if specified
    if (filters.start_date || filters.end_date) {
      slots = slots.filter(slot => {
        if (filters.start_date && slot.start_time < filters.start_date) {
          return false;
        }
        if (filters.end_date && slot.start_time > filters.end_date) {
          return false;
        }
        return true;
      });
    }

    return slots;
  }

  /**
   * Get slot by ID
   */
  async getSlot(slotId: string): Promise<Slot | null> {
    return await this.slotRepo.findById(slotId);
  }

  /**
   * Get slot with details by ID
   */
  async getSlotWithDetails(slotId: string): Promise<Array<Slot & {
    staff_name: string;
    service_name: string;
    service_duration: number;
  }>> {
    return await this.slotRepo.findWithDetails({ id: slotId } as Partial<Slot>);
  }

  /**
   * Process expired holds and release them
   */
  async processExpiredHolds(): Promise<{
    released_count: number;
    cascade_notifications: number;
  }> {
    const expiredSlots = await this.slotRepo.findExpiredHolds();
    let cascadeNotifications = 0;

    for (const slot of expiredSlots) {
      // Release the hold
      await this.slotRepo.releaseHold(slot.id);
      
      // Find the next candidate and notify them
      const matchResult = await this.openSlot(slot.id);
      if (matchResult.notification_sent) {
        cascadeNotifications++;
      }
    }

    return {
      released_count: expiredSlots.length,
      cascade_notifications: cascadeNotifications
    };
  }

  /**
   * Get slot statistics
   */
  async getSlotStats(startDate: Date, endDate: Date): Promise<{
    total_slots: number;
    open_slots: number;
    held_slots: number;
    booked_slots: number;
    canceled_slots: number;
  }> {
    return await this.slotRepo.getSlotStats(startDate, endDate);
  }

  /**
   * Calculate match score for a candidate and slot
   */
  private calculateMatchScore(candidate: WaitlistEntry, slot: Slot): number {
    let score = candidate.priority_score;

    // Staff preference match bonus
    if (candidate.staff_id && candidate.staff_id === slot.staff_id) {
      score += 10;
    }

    // Time window compatibility (already filtered, but add bonus for perfect fit)
    const slotDuration = slot.end_time.getTime() - slot.start_time.getTime();
    const preferredDuration = candidate.latest_time.getTime() - candidate.earliest_time.getTime();
    
    // Bonus for slots that fit well within preferred time window
    if (slotDuration <= preferredDuration) {
      score += 5;
    }

    return score;
  }

  /**
   * Handle cascade notification when a customer declines or hold expires
   */
  async handleCascadeNotification(slotId: string): Promise<SlotCandidate | null> {
    const slot = await this.slotRepo.findById(slotId);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Release current hold and find next candidate
    await this.slotRepo.releaseHold(slotId);
    
    const candidates = await this.findCandidatesForSlot(slot);
    
    if (candidates.length > 0) {
      const nextCandidate = candidates[0];
      
      // Hold the slot for the next candidate (directly through repository)
      await this.slotRepo.holdSlot(slotId, 10);
      
      // Update waitlist entry status
      await this.waitlistRepo.updateStatus(nextCandidate.id, WaitlistStatus.NOTIFIED);
      
      return nextCandidate;
    }

    return null;
  }
}