import { Router, Request, Response } from 'express';
import { SlotService, CreateSlotData, SlotFilters } from '../services/SlotService';
import { WaitlistService } from '../services/WaitlistService';
import { SlotRepository } from '../repositories/SlotRepository';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { slotSchemas } from '../validation/slotSchemas';
import { SlotStatus } from '../models';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * Create a new slot
 */
router.post('/', validateRequest(slotSchemas.createSlot.body), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const slotData: CreateSlotData = {
      staff_id: req.body.staff_id,
      service_id: req.body.service_id,
      start_time: new Date(req.body.start_time),
      end_time: new Date(req.body.end_time)
    };

    const slot = await slotService.createSlot(slotData);

    res.status(201).json({
      success: true,
      data: slot,
      message: 'Slot created successfully'
    });
  } catch (error) {
    console.error('Error creating slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create slot'
    });
  }
});

/**
 * Get slots with filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    // Build filters from query parameters
    const filters: SlotFilters = {};
    
    if (req.query.status) {
      filters.status = req.query.status as SlotStatus;
    }
    if (req.query.staff_id) {
      filters.staff_id = req.query.staff_id as string;
    }
    if (req.query.service_id) {
      filters.service_id = req.query.service_id as string;
    }
    if (req.query.start_date) {
      filters.start_date = new Date(req.query.start_date as string);
    }
    if (req.query.end_date) {
      filters.end_date = new Date(req.query.end_date as string);
    }

    const slots = await slotService.getSlots(filters);

    res.json({
      success: true,
      data: slots,
      count: slots.length
    });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch slots'
    });
  }
});

/**
 * Get slot by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const slotDetails = await slotService.getSlotWithDetails(slotId);
    
    if (slotDetails.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: slotDetails[0]
    });
  } catch (error) {
    console.error('Error fetching slot:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch slot'
    });
  }
});

/**
 * Update slot
 */
router.put('/:id', validateRequest(slotSchemas.updateSlot.body), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const updates: Partial<CreateSlotData> = {};
    
    if (req.body.staff_id) updates.staff_id = req.body.staff_id;
    if (req.body.service_id) updates.service_id = req.body.service_id;
    if (req.body.start_time) updates.start_time = new Date(req.body.start_time);
    if (req.body.end_time) updates.end_time = new Date(req.body.end_time);

    const updatedSlot = await slotService.updateSlot(slotId, updates);

    if (!updatedSlot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: updatedSlot,
      message: 'Slot updated successfully'
    });
  } catch (error) {
    console.error('Error updating slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update slot'
    });
  }
});

/**
 * Mark slot as open and trigger waitlist matching
 */
router.post('/:id/open', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const matchResult = await slotService.openSlot(slotId);

    res.json({
      success: true,
      data: matchResult,
      message: matchResult.candidates.length > 0 
        ? `Slot opened and ${matchResult.candidates.length} candidates found. Top candidate notified.`
        : 'Slot opened but no eligible candidates found.'
    });
  } catch (error) {
    console.error('Error opening slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open slot'
    });
  }
});

/**
 * Hold a slot
 */
router.post('/:id/hold', validateRequest(slotSchemas.holdSlot.body), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    const holdDuration = req.body.hold_duration_minutes || 10;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const heldSlot = await slotService.holdSlot(slotId, holdDuration);

    if (!heldSlot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: heldSlot,
      message: `Slot held for ${holdDuration} minutes`
    });
  } catch (error) {
    console.error('Error holding slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to hold slot'
    });
  }
});

/**
 * Release slot hold
 */
router.post('/:id/release', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const releasedSlot = await slotService.releaseHold(slotId);

    if (!releasedSlot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: releasedSlot,
      message: 'Slot hold released'
    });
  } catch (error) {
    console.error('Error releasing slot hold:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release slot hold'
    });
  }
});

/**
 * Book a slot
 */
router.post('/:id/book', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const bookedSlot = await slotService.bookSlot(slotId);

    if (!bookedSlot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: bookedSlot,
      message: 'Slot booked successfully'
    });
  } catch (error) {
    console.error('Error booking slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to book slot'
    });
  }
});

/**
 * Cancel a slot
 */
router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const canceledSlot = await slotService.cancelSlot(slotId);

    if (!canceledSlot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: canceledSlot,
      message: 'Slot canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling slot:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel slot'
    });
  }
});

/**
 * Get candidates for a slot
 */
router.get('/:id/candidates', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const slotId = req.params.id;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const slot = await slotService.getSlot(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found'
      });
    }

    const candidates = await slotService.findCandidatesForSlot(slot);

    res.json({
      success: true,
      data: candidates,
      count: candidates.length
    });
  } catch (error) {
    console.error('Error fetching slot candidates:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch slot candidates'
    });
  }
});

/**
 * Process expired holds
 */
router.post('/process-expired-holds', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const result = await slotService.processExpiredHolds();

    res.json({
      success: true,
      data: result,
      message: `Processed ${result.released_count} expired holds, sent ${result.cascade_notifications} cascade notifications`
    });
  } catch (error) {
    console.error('Error processing expired holds:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process expired holds'
    });
  }
});

/**
 * Get slot statistics
 */
router.get('/stats/:startDate/:endDate', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.user!;
    const startDate = new Date(req.params.startDate);
    const endDate = new Date(req.params.endDate);
    
    // Initialize repositories with tenant context
    const slotRepo = new SlotRepository(tenantId);
    const waitlistRepo = new WaitlistRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    const stats = await slotService.getSlotStats(startDate, endDate);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching slot stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch slot statistics'
    });
  }
});

export default router;