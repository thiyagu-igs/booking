import { Router, Request, Response } from 'express';
import { WaitlistService } from '../services/WaitlistService';
import { OTPService } from '../services/OTPService';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { waitlistEntrySchema, updateWaitlistEntrySchema, paginationSchema } from '../validation/schemas';
import { WaitlistStatus } from '../models';
import Joi from 'joi';

const router = Router();
const otpService = new OTPService();

// Validation schemas for waitlist-specific endpoints
const phoneVerificationSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
});

const otpVerificationSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  code: Joi.string().length(6).pattern(/^\d{6}$/).required()
});

const waitlistFiltersSchema = Joi.object({
  status: Joi.string().valid('active', 'notified', 'confirmed', 'removed').optional(),
  service_id: Joi.string().uuid().optional(),
  staff_id: Joi.string().uuid().optional(),
  vip_status: Joi.boolean().optional(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional()
});

const removeReasonSchema = Joi.object({
  reason: Joi.string().max(500).optional()
});

/**
 * POST /api/waitlist/verify-phone
 * Send OTP for phone verification
 */
router.post('/verify-phone', validateRequest(phoneVerificationSchema), async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;

    const result = await otpService.generateOTP(phone);

    if (!result.success) {
      return res.status(429).json({
        error: 'RATE_LIMITED',
        message: result.message
      });
    }

    res.json({
      message: result.message,
      // Only include OTP in test environment
      ...(process.env.NODE_ENV === 'test' && { otp: result.otp })
    });
  } catch (error) {
    console.error('Phone verification error:', error);
    res.status(500).json({
      error: 'VERIFICATION_FAILED',
      message: 'Failed to send verification code'
    });
  }
});

/**
 * POST /api/waitlist/verify-otp
 * Verify OTP code
 */
router.post('/verify-otp', validateRequest(otpVerificationSchema), async (req: Request, res: Response) => {
  try {
    const { phone, code } = req.body;

    const result = await otpService.verifyOTP(phone, code);

    if (!result.success) {
      return res.status(400).json({
        error: 'VERIFICATION_FAILED',
        message: result.message,
        ...(result.remaining_attempts !== undefined && { remaining_attempts: result.remaining_attempts })
      });
    }

    res.json({
      message: result.message
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({
      error: 'VERIFICATION_FAILED',
      message: 'Failed to verify code'
    });
  }
});

/**
 * POST /api/waitlist
 * Create new waitlist entry
 */
router.post('/', authenticate, validateRequest(waitlistEntrySchema), async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const {
      customer_name,
      phone,
      email,
      service_id,
      staff_id,
      earliest_time,
      latest_time,
      vip_status,
      notification_channels,
      preferred_channel
    } = req.body;

    // Check if phone is verified for new phone numbers
    const existingEntries = await req.repositories.waitlist.findByPhone(phone);
    if (existingEntries.length === 0) {
      const isVerified = await otpService.isPhoneVerified(phone);
      if (!isVerified) {
        return res.status(400).json({
          error: 'PHONE_NOT_VERIFIED',
          message: 'Phone number must be verified before joining waitlist'
        });
      }
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const entry = await waitlistService.createWaitlistEntry({
      customer_name,
      phone,
      email,
      service_id,
      staff_id,
      earliest_time: new Date(earliest_time),
      latest_time: new Date(latest_time),
      vip_status,
      notification_channels,
      preferred_channel
    });

    res.status(201).json({
      message: 'Successfully added to waitlist',
      data: entry
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create waitlist entry';
    
    if (message.includes('Maximum 3 active')) {
      return res.status(400).json({
        error: 'WAITLIST_LIMIT_EXCEEDED',
        message
      });
    }

    if (message.includes('not found') || message.includes('inactive')) {
      return res.status(400).json({
        error: 'INVALID_REFERENCE',
        message
      });
    }

    if (message.includes('time')) {
      return res.status(400).json({
        error: 'INVALID_TIME_WINDOW',
        message
      });
    }

    console.error('Waitlist creation error:', error);
    res.status(500).json({
      error: 'CREATION_FAILED',
      message: 'Failed to create waitlist entry'
    });
  }
});

/**
 * GET /api/waitlist
 * Get waitlist entries with filtering and pagination
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Validate query parameters
    const filtersValidation = waitlistFiltersSchema.validate(req.query);
    if (filtersValidation.error) {
      return res.status(400).json({
        error: 'INVALID_FILTERS',
        message: filtersValidation.error.details.map(d => d.message).join(', ')
      });
    }

    const paginationValidation = paginationSchema.validate(req.query);
    if (paginationValidation.error) {
      return res.status(400).json({
        error: 'INVALID_PAGINATION',
        message: paginationValidation.error.details.map(d => d.message).join(', ')
      });
    }

    const filters = filtersValidation.value;
    const pagination = paginationValidation.value;

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const result = await waitlistService.getWaitlistEntries(filters, pagination);

    res.json({
      message: 'Waitlist entries retrieved successfully',
      data: result
    });
  } catch (error) {
    console.error('Waitlist retrieval error:', error);
    res.status(500).json({
      error: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve waitlist entries'
    });
  }
});

/**
 * GET /api/waitlist/stats
 * Get waitlist statistics
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const stats = await waitlistService.getWaitlistStats();

    res.json({
      message: 'Waitlist statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    console.error('Waitlist stats error:', error);
    res.status(500).json({
      error: 'STATS_FAILED',
      message: 'Failed to retrieve waitlist statistics'
    });
  }
});

/**
 * GET /api/waitlist/:id
 * Get specific waitlist entry
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid waitlist entry ID format'
      });
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const entry = await waitlistService.getWaitlistEntry(id);

    if (!entry) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message: 'Waitlist entry not found'
      });
    }

    res.json({
      message: 'Waitlist entry retrieved successfully',
      data: entry
    });
  } catch (error) {
    console.error('Waitlist entry retrieval error:', error);
    res.status(500).json({
      error: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve waitlist entry'
    });
  }
});

/**
 * PUT /api/waitlist/:id
 * Update waitlist entry
 */
router.put('/:id', authenticate, validateRequest(updateWaitlistEntrySchema), async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid waitlist entry ID format'
      });
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const updates = req.body;
    
    // Convert date strings to Date objects if present
    if (updates.earliest_time) {
      updates.earliest_time = new Date(updates.earliest_time);
    }
    if (updates.latest_time) {
      updates.latest_time = new Date(updates.latest_time);
    }

    const updatedEntry = await waitlistService.updateWaitlistEntry(id, updates);

    if (!updatedEntry) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message: 'Waitlist entry not found'
      });
    }

    res.json({
      message: 'Waitlist entry updated successfully',
      data: updatedEntry
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update waitlist entry';
    
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message
      });
    }

    if (message.includes('Can only update active')) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message
      });
    }

    if (message.includes('inactive') || message.includes('not found')) {
      return res.status(400).json({
        error: 'INVALID_REFERENCE',
        message
      });
    }

    if (message.includes('time')) {
      return res.status(400).json({
        error: 'INVALID_TIME_WINDOW',
        message
      });
    }

    console.error('Waitlist update error:', error);
    res.status(500).json({
      error: 'UPDATE_FAILED',
      message: 'Failed to update waitlist entry'
    });
  }
});

/**
 * DELETE /api/waitlist/:id
 * Remove entry from waitlist
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { id } = req.params;

    if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Invalid waitlist entry ID format'
      });
    }

    // Validate reason if provided
    const reasonValidation = removeReasonSchema.validate(req.body);
    if (reasonValidation.error) {
      return res.status(400).json({
        error: 'INVALID_REASON',
        message: reasonValidation.error.details.map(d => d.message).join(', ')
      });
    }

    const { reason } = reasonValidation.value;

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const removedEntry = await waitlistService.removeFromWaitlist(id, reason);

    if (!removedEntry) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message: 'Waitlist entry not found'
      });
    }

    res.json({
      message: 'Entry removed from waitlist successfully',
      data: removedEntry
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove waitlist entry';
    
    if (message.includes('not found')) {
      return res.status(404).json({
        error: 'ENTRY_NOT_FOUND',
        message
      });
    }

    if (message.includes('already removed')) {
      return res.status(400).json({
        error: 'ALREADY_REMOVED',
        message
      });
    }

    console.error('Waitlist removal error:', error);
    res.status(500).json({
      error: 'REMOVAL_FAILED',
      message: 'Failed to remove waitlist entry'
    });
  }
});

/**
 * GET /api/waitlist/phone/:phone
 * Get waitlist entries for a specific phone number
 */
router.get('/phone/:phone', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const { phone } = req.params;

    // Validate phone format
    const phoneValidation = phoneVerificationSchema.validate({ phone });
    if (phoneValidation.error) {
      return res.status(400).json({
        error: 'INVALID_PHONE',
        message: 'Invalid phone number format'
      });
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const entries = await waitlistService.getEntriesByPhone(phone);

    res.json({
      message: 'Waitlist entries retrieved successfully',
      data: entries
    });
  } catch (error) {
    console.error('Phone entries retrieval error:', error);
    res.status(500).json({
      error: 'RETRIEVAL_FAILED',
      message: 'Failed to retrieve waitlist entries for phone number'
    });
  }
});

/**
 * POST /api/waitlist/recalculate-priorities
 * Recalculate priority scores for all active entries
 */
router.post('/recalculate-priorities', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const waitlistService = new WaitlistService(
      req.repositories.waitlist,
      req.repositories.service,
      req.repositories.staff
    );

    const updatedCount = await waitlistService.recalculatePriorityScores();

    res.json({
      message: 'Priority scores recalculated successfully',
      data: {
        updated_count: updatedCount
      }
    });
  } catch (error) {
    console.error('Priority recalculation error:', error);
    res.status(500).json({
      error: 'RECALCULATION_FAILED',
      message: 'Failed to recalculate priority scores'
    });
  }
});

export default router;