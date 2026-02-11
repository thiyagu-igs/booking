import { Router, Request, Response } from 'express';
import { BookingService, BookingFilters, CreateManualBookingData } from '../services/BookingService';
import { SlotService } from '../services/SlotService';
import { WaitlistService } from '../services/WaitlistService';
import { BookingRepository } from '../repositories/BookingRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { paginationSchema } from '../validation/schemas';
import { BookingStatus, BookingSource } from '../models';
import Joi from 'joi';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Validation schemas for booking-specific endpoints
const createManualBookingSchema = Joi.object({
  slot_id: Joi.string().uuid({ version: 'uuidv4' }).required(),
  customer_name: Joi.string().min(2).max(100).required(),
  customer_phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  customer_email: Joi.string().email().optional(),
  booking_source: Joi.string().valid('direct', 'walk_in', 'manual').required()
});

const updateBookingStatusSchema = Joi.object({
  status: Joi.string().valid('confirmed', 'completed', 'no_show', 'canceled').required()
});

const bookingFiltersSchema = Joi.object({
  search: Joi.string().max(255).optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
  service_id: Joi.string().uuid().optional(),
  staff_id: Joi.string().uuid().optional(),
  status: Joi.string().valid('confirmed', 'completed', 'no_show', 'canceled').optional(),
  source: Joi.string().valid('waitlist', 'direct', 'walk_in').optional()
});

/**
 * GET /api/bookings/stats
 * Get booking statistics for dashboard
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    // Parse date range query parameters
    const startDate = req.query.start_date 
      ? new Date(req.query.start_date as string) 
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1); // Default to start of current month
    
    const endDate = req.query.end_date 
      ? new Date(req.query.end_date as string) 
      : new Date(); // Default to now

    // Initialize repositories with tenant context
    const bookingRepo = new BookingRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
    const bookingService = new BookingService(bookingRepo, slotRepo, serviceRepo, staffRepo, slotService, tenantId);

    const stats = await bookingService.getBookingStats(startDate, endDate);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching booking stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch booking statistics'
    });
  }
});

/**
 * GET /api/bookings
 * Get bookings with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;

    // Validate query parameters
    const filtersValidation = bookingFiltersSchema.validate(req.query);
    if (filtersValidation.error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid filters',
        details: filtersValidation.error.details.map(d => d.message).join(', ')
      });
    }

    const paginationValidation = paginationSchema.validate(req.query);
    if (paginationValidation.error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination',
        details: paginationValidation.error.details.map(d => d.message).join(', ')
      });
    }

    // Initialize repositories with tenant context
    const bookingRepo = new BookingRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
    const bookingService = new BookingService(bookingRepo, slotRepo, serviceRepo, staffRepo, slotService, tenantId);

    // Build filters from query parameters
    const filters: BookingFilters = {};
    
    if (filtersValidation.value.search) {
      filters.search = filtersValidation.value.search;
    }
    if (filtersValidation.value.start_date) {
      filters.start_date = new Date(filtersValidation.value.start_date);
    }
    if (filtersValidation.value.end_date) {
      filters.end_date = new Date(filtersValidation.value.end_date);
    }
    if (filtersValidation.value.service_id) {
      filters.service_id = filtersValidation.value.service_id;
    }
    if (filtersValidation.value.staff_id) {
      filters.staff_id = filtersValidation.value.staff_id;
    }
    if (filtersValidation.value.status) {
      filters.status = filtersValidation.value.status as BookingStatus;
    }
    if (filtersValidation.value.source) {
      filters.source = filtersValidation.value.source as BookingSource;
    }

    // Get bookings with filters
    const bookings = await bookingService.getBookings(filters);

    // Apply pagination
    const page = paginationValidation.value.page || 1;
    const limit = paginationValidation.value.limit || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedBookings = bookings.slice(startIndex, endIndex);

    res.json({
      success: true,
      bookings: paginatedBookings,
      pagination: {
        page,
        limit,
        total: bookings.length,
        totalPages: Math.ceil(bookings.length / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch bookings'
    });
  }
});

/**
 * POST /api/bookings
 * Create a new manual booking
 */
router.post('/', validateRequest(createManualBookingSchema), async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;

    // Initialize repositories with tenant context
    const bookingRepo = new BookingRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
    const bookingService = new BookingService(bookingRepo, slotRepo, serviceRepo, staffRepo, slotService, tenantId);

    const bookingData: CreateManualBookingData = {
      slot_id: req.body.slot_id,
      customer_name: req.body.customer_name,
      customer_phone: req.body.customer_phone,
      customer_email: req.body.customer_email,
      booking_source: req.body.booking_source as BookingSource,
      actor_id: userId
    };

    const booking = await bookingService.createManualBooking(bookingData);

    res.status(201).json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create booking';
    
    // Handle specific error cases
    if (message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    if (message.includes('not available') || message.includes('already booked')) {
      return res.status(409).json({
        success: false,
        error: 'Slot is no longer available',
        message: 'This slot has been booked by another customer'
      });
    }

    if (message.includes('past') || message.includes('validation') || message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: message
      });
    }

    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/bookings/:id
 * Get specific booking with detailed information
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const { id } = req.params;

    // Validate booking ID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
      });
    }

    // Initialize repositories with tenant context
    const bookingRepo = new BookingRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
    const bookingService = new BookingService(bookingRepo, slotRepo, serviceRepo, staffRepo, slotService, tenantId);

    const booking = await bookingService.getBookingById(id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch booking'
    });
  }
});

/**
 * PATCH /api/bookings/:id
 * Update booking status
 */
router.patch('/:id', validateRequest(updateBookingStatusSchema), async (req: Request, res: Response) => {
  try {
    const { tenantId, userId } = req.user!;
    const { id } = req.params;
    const { status } = req.body;

    // Validate booking ID format
    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking ID format'
      });
    }

    // Initialize repositories with tenant context
    const bookingRepo = new BookingRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
    const bookingService = new BookingService(bookingRepo, slotRepo, serviceRepo, staffRepo, slotService, tenantId);

    // Call appropriate BookingService method based on status
    let updatedBooking;
    
    if (status === BookingStatus.COMPLETED) {
      updatedBooking = await bookingService.markAsCompleted(id, userId);
    } else if (status === BookingStatus.NO_SHOW) {
      updatedBooking = await bookingService.markAsNoShow(id, userId);
    } else if (status === BookingStatus.CANCELED) {
      updatedBooking = await bookingService.cancelBooking(id, userId);
    } else {
      updatedBooking = await bookingService.updateBookingStatus(id, status as BookingStatus, userId);
    }

    res.json({
      success: true,
      booking: updatedBooking,
      message: 'Booking status updated successfully'
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update booking';
    
    // Handle specific error cases
    if (message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (message.includes('Invalid status transition')) {
      return res.status(409).json({
        success: false,
        error: 'Invalid status transition',
        message
      });
    }

    if (message.includes('validation') || message.includes('Invalid')) {
      return res.status(400).json({
        success: false,
        error: message
      });
    }

    console.error('Error updating booking status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update booking status'
    });
  }
});

export default router;
