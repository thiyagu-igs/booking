import { BookingRepository, BookingWithDetails, BookingStats } from '../repositories/BookingRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { SlotService } from './SlotService';
import { CalendarService } from './CalendarService';
import { AuditService } from './AuditService';
import { Booking, BookingStatus, BookingSource, SlotStatus } from '../models';
import { logger } from '../config/logger';

export interface CreateManualBookingData {
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  booking_source: BookingSource;
  actor_id?: string;
}

export interface BookingFilters {
  search?: string;
  start_date?: Date;
  end_date?: Date;
  service_id?: string;
  staff_id?: string;
  status?: BookingStatus;
  source?: BookingSource;
}

export class BookingService {
  private bookingRepo: BookingRepository;
  private slotRepo: SlotRepository;
  private serviceRepo: ServiceRepository;
  private staffRepo: StaffRepository;
  private slotService: SlotService;
  private calendarService: CalendarService;
  private tenantId: string;

  constructor(
    bookingRepo: BookingRepository,
    slotRepo: SlotRepository,
    serviceRepo: ServiceRepository,
    staffRepo: StaffRepository,
    slotService: SlotService,
    tenantId: string
  ) {
    this.bookingRepo = bookingRepo;
    this.slotRepo = slotRepo;
    this.serviceRepo = serviceRepo;
    this.staffRepo = staffRepo;
    this.slotService = slotService;
    this.tenantId = tenantId;
    this.calendarService = new CalendarService(tenantId);
  }

  /**
   * Get bookings with filtering support
   */
  async getBookings(filters: BookingFilters = {}): Promise<BookingWithDetails[]> {
    let bookings = await this.bookingRepo.findWithDetails();

    // Apply filters
    if (filters.status) {
      bookings = bookings.filter(b => b.status === filters.status);
    }

    if (filters.source) {
      bookings = bookings.filter(b => b.booking_source === filters.source);
    }

    if (filters.service_id) {
      bookings = bookings.filter(b => {
        // Need to join through slot to get service_id
        return true; // Will be filtered by repository query
      });
    }

    if (filters.staff_id) {
      bookings = bookings.filter(b => {
        // Need to join through slot to get staff_id
        return true; // Will be filtered by repository query
      });
    }

    if (filters.start_date) {
      bookings = bookings.filter(b => b.slot_start_time >= filters.start_date!);
    }

    if (filters.end_date) {
      bookings = bookings.filter(b => b.slot_start_time <= filters.end_date!);
    }

    // Apply search filter (customer name, phone, or email)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      bookings = bookings.filter(b => 
        b.customer_name.toLowerCase().includes(searchLower) ||
        b.customer_phone.includes(filters.search!) ||
        (b.customer_email && b.customer_email.toLowerCase().includes(searchLower))
      );
    }

    return bookings;
  }

  /**
   * Get booking by ID with full details
   */
  async getBookingById(bookingId: string): Promise<BookingWithDetails | null> {
    return await this.bookingRepo.findByIdWithDetails(bookingId);
  }

  /**
   * Get booking statistics for dashboard
   */
  async getBookingStats(startDate: Date, endDate: Date): Promise<BookingStats> {
    return await this.bookingRepo.getBookingStats(startDate, endDate);
  }

  /**
   * Create manual booking with validation
   */
  async createManualBooking(data: CreateManualBookingData): Promise<Booking> {
    // Validate slot exists and is available
    const slot = await this.slotRepo.findById(data.slot_id);
    if (!slot) {
      throw new Error('Slot not found');
    }

    // Validate slot status
    if (slot.status !== SlotStatus.OPEN && slot.status !== SlotStatus.HELD) {
      throw new Error('Slot is not available for booking');
    }

    // Validate slot is in the future
    const now = new Date();
    if (slot.start_time <= now) {
      throw new Error('Cannot book slots in the past');
    }

    // Validate customer information
    if (!data.customer_name || data.customer_name.trim().length < 2) {
      throw new Error('Customer name must be at least 2 characters');
    }

    if (data.customer_name.length > 100) {
      throw new Error('Customer name must not exceed 100 characters');
    }

    if (!data.customer_phone || data.customer_phone.trim().length === 0) {
      throw new Error('Customer phone is required');
    }

    // Validate email format if provided
    if (data.customer_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.customer_email)) {
        throw new Error('Invalid email format');
      }
    }

    // Validate booking source
    const validSources = [BookingSource.DIRECT, BookingSource.WALK_IN, BookingSource.WAITLIST];
    if (!validSources.includes(data.booking_source)) {
      throw new Error('Invalid booking source');
    }

    try {
      // Use SlotService.bookSlot to mark slot as booked (handles race conditions)
      const bookedSlot = await this.slotService.bookSlot(data.slot_id);
      if (!bookedSlot) {
        throw new Error('Failed to book slot');
      }

      // Create booking record
      const bookingData = {
        slot_id: data.slot_id,
        customer_name: data.customer_name.trim(),
        customer_phone: data.customer_phone.trim(),
        customer_email: data.customer_email?.trim(),
        status: BookingStatus.CONFIRMED,
        booking_source: data.booking_source,
        confirmed_at: new Date()
      };

      const booking = await this.bookingRepo.create(bookingData);

      // Integrate with CalendarService for event creation (non-blocking)
      try {
        const service = await this.serviceRepo.findById(slot.service_id);
        if (service) {
          const calendarResult = await this.calendarService.createEventForSlot({
            slotId: slot.id,
            staffId: slot.staff_id,
            customerName: data.customer_name,
            customerEmail: data.customer_email,
            serviceName: service.name,
            startTime: slot.start_time,
            endTime: slot.end_time
          });

          if (calendarResult.success) {
            logger.info(`Calendar event created for booking ${booking.id}`, {
              bookingId: booking.id,
              slotId: slot.id,
              eventId: calendarResult.eventId
            });
          } else {
            logger.warn(`Calendar event creation failed for booking ${booking.id}`, {
              bookingId: booking.id,
              error: calendarResult.error
            });
          }
        }
      } catch (error) {
        // Log calendar error but don't fail the booking
        logger.error('Calendar integration error during booking creation', {
          bookingId: booking.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Add audit log entry for booking creation
      await AuditService.log({
        tenantId: this.tenantId,
        actorType: data.actor_id ? 'user' : 'system',
        actorId: data.actor_id,
        action: 'CREATE_BOOKING',
        resourceType: 'booking',
        resourceId: booking.id,
        newValues: {
          slot_id: data.slot_id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          customer_email: data.customer_email,
          booking_source: data.booking_source,
          status: BookingStatus.CONFIRMED
        },
        metadata: {
          slot_start_time: slot.start_time,
          slot_end_time: slot.end_time
        },
        severity: 'low'
      });

      logger.info(`Manual booking created successfully`, {
        bookingId: booking.id,
        slotId: data.slot_id,
        customerName: data.customer_name,
        bookingSource: data.booking_source
      });

      return booking;
    } catch (error) {
      logger.error('Failed to create manual booking', {
        slotId: data.slot_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update booking status with validation
   */
  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    actorId?: string
  ): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Validate status transition
    if (!this.validateStatusTransition(booking.status as BookingStatus, status)) {
      throw new Error(`Invalid status transition from ${booking.status} to ${status}`);
    }

    const oldStatus = booking.status;
    const updates: Partial<Booking> = { status };

    // Set completion timestamp for completed status
    if (status === BookingStatus.COMPLETED) {
      updates.completed_at = new Date();
    }

    // Update booking
    const updatedBooking = await this.bookingRepo.update(bookingId, updates);
    if (!updatedBooking) {
      throw new Error('Failed to update booking status');
    }

    // Add audit log entry
    await AuditService.log({
      tenantId: this.tenantId,
      actorType: actorId ? 'user' : 'system',
      actorId,
      action: 'UPDATE_BOOKING_STATUS',
      resourceType: 'booking',
      resourceId: bookingId,
      oldValues: { status: oldStatus },
      newValues: { status },
      severity: 'low'
    });

    logger.info(`Booking status updated`, {
      bookingId,
      oldStatus,
      newStatus: status
    });

    return updatedBooking;
  }

  /**
   * Mark booking as completed
   */
  async markAsCompleted(bookingId: string, actorId?: string): Promise<Booking> {
    return await this.updateBookingStatus(bookingId, BookingStatus.COMPLETED, actorId);
  }

  /**
   * Mark booking as no-show and release slot
   */
  async markAsNoShow(bookingId: string, actorId?: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    const updatedBooking = await this.updateBookingStatus(bookingId, BookingStatus.NO_SHOW, actorId);

    // Release the slot back to open status
    try {
      await this.slotRepo.update(booking.slot_id, {
        status: SlotStatus.OPEN
      });

      logger.info(`Slot released after no-show`, {
        bookingId,
        slotId: booking.slot_id
      });
    } catch (error) {
      logger.error('Failed to release slot after no-show', {
        bookingId,
        slotId: booking.slot_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return updatedBooking;
  }

  /**
   * Cancel booking and release slot with calendar deletion
   */
  async cancelBooking(bookingId: string, actorId?: string): Promise<Booking> {
    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    const updatedBooking = await this.updateBookingStatus(bookingId, BookingStatus.CANCELED, actorId);

    // Release the slot back to open status
    try {
      await this.slotRepo.update(booking.slot_id, {
        status: SlotStatus.OPEN
      });

      logger.info(`Slot released after cancellation`, {
        bookingId,
        slotId: booking.slot_id
      });
    } catch (error) {
      logger.error('Failed to release slot after cancellation', {
        bookingId,
        slotId: booking.slot_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Delete calendar event if it exists (non-blocking)
    try {
      const calendarResult = await this.calendarService.deleteEventForSlot(booking.slot_id);
      
      if (calendarResult.success) {
        logger.info(`Calendar event deleted for canceled booking ${bookingId}`, {
          bookingId,
          slotId: booking.slot_id,
          eventId: calendarResult.eventId
        });
      } else {
        logger.warn(`Calendar event deletion failed for booking ${bookingId}`, {
          bookingId,
          error: calendarResult.error
        });
      }
    } catch (error) {
      // Log calendar error but don't fail the cancellation
      logger.error('Calendar integration error during booking cancellation', {
        bookingId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return updatedBooking;
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus
  ): boolean {
    // Define valid transitions
    const validTransitions: { [key: string]: BookingStatus[] } = {
      'confirmed': [
        BookingStatus.COMPLETED,
        BookingStatus.NO_SHOW,
        BookingStatus.CANCELED
      ],
      'completed': [], // No transitions from completed
      'no_show': [], // No transitions from no-show
      'canceled': [] // No transitions from canceled
    };

    const allowedTransitions = validTransitions[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }
}
