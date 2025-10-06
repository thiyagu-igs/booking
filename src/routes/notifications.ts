import express from 'express';
import { NotificationService } from '../services/NotificationService';
import { WaitlistService } from '../services/WaitlistService';
import { SlotService } from '../services/SlotService';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { authenticate } from '../middleware/auth';
import { WaitlistStatus, SlotStatus, BookingSource } from '../models';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * Handle confirmation token (confirm booking)
 */
router.post('/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // We need to decode the token first to get tenant info
    // Since we don't have tenant context yet, we'll use a temporary service
    const tempNotificationService = new NotificationService(req.app.locals.db, '');
    const decoded = tempNotificationService.verifyConfirmToken(token);
    
    if (!decoded) {
      return res.status(400).json({
        error: 'Invalid or expired confirmation token'
      });
    }

    if (decoded.action !== 'confirm') {
      return res.status(400).json({
        error: 'Invalid token action'
      });
    }

    // Now create services with proper tenant context
    const notificationService = new NotificationService(req.app.locals.db, decoded.tenantId);
    
    // Initialize repositories with tenant context
    const waitlistRepo = new WaitlistRepository(decoded.tenantId);
    const slotRepo = new SlotRepository(decoded.tenantId);
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    const staffRepo = new StaffRepository(decoded.tenantId);
    
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    // Get the waitlist entry and slot
    const entry = await waitlistService.getWaitlistEntry(decoded.entryId);
    const slot = await slotService.getSlot(decoded.slotId);

    if (!entry || !slot) {
      return res.status(404).json({
        error: 'Waitlist entry or slot not found'
      });
    }

    // Check if slot is still available and held
    if (slot.status !== SlotStatus.HELD) {
      return res.status(409).json({
        error: 'This slot is no longer available',
        message: 'Sorry, this slot has already been booked by someone else or the hold has expired.'
      });
    }

    // Check if hold has expired
    if (slot.hold_expires_at && new Date() > slot.hold_expires_at) {
      return res.status(409).json({
        error: 'Confirmation window has expired',
        message: 'Sorry, the 10-minute confirmation window has expired. This slot may have been offered to someone else.'
      });
    }

    // Check if waitlist entry is still active
    if (entry.status !== WaitlistStatus.ACTIVE && entry.status !== WaitlistStatus.NOTIFIED) {
      return res.status(409).json({
        error: 'Waitlist entry is no longer active'
      });
    }

    // Start transaction for booking with race condition protection
    let bookingId: string;
    try {
      await req.app.locals.db.transaction(async (trx: any) => {
        // Double-check slot status within transaction to prevent race conditions
        const currentSlot = await trx('slots')
          .where({ id: slot.id, tenant_id: decoded.tenantId })
          .first();

        if (!currentSlot || currentSlot.status !== SlotStatus.HELD) {
          throw new Error('SLOT_NO_LONGER_AVAILABLE');
        }

        // Check if hold is still valid within transaction
        if (currentSlot.hold_expires_at && new Date() > currentSlot.hold_expires_at) {
          throw new Error('HOLD_EXPIRED');
        }

        // Book the slot with optimistic locking
        const updateResult = await trx('slots')
          .where({ 
            id: slot.id, 
            tenant_id: decoded.tenantId,
            status: SlotStatus.HELD // Ensure it's still held
          })
          .update({
            status: SlotStatus.BOOKED,
            hold_expires_at: null,
            updated_at: new Date()
          });

        if (updateResult === 0) {
          throw new Error('SLOT_BOOKING_CONFLICT');
        }

        // Update waitlist entry status
        await trx('waitlist_entries')
          .where({ id: entry.id, tenant_id: decoded.tenantId })
          .update({
            status: WaitlistStatus.CONFIRMED,
            updated_at: new Date()
          });

        // Create booking record
        bookingId = uuidv4();
        await trx('bookings').insert({
          id: bookingId,
          tenant_id: decoded.tenantId,
          slot_id: slot.id,
          waitlist_entry_id: entry.id,
          customer_name: entry.customer_name,
          customer_phone: entry.phone,
          customer_email: entry.email,
          status: 'confirmed',
          booking_source: BookingSource.WAITLIST,
          confirmed_at: new Date(),
          created_at: new Date(),
          updated_at: new Date()
        });

        // Remove customer from other active waitlists for this tenant
        await trx('waitlist_entries')
          .where({ 
            phone: entry.phone, 
            tenant_id: decoded.tenantId,
            status: WaitlistStatus.ACTIVE
          })
          .whereNot({ id: entry.id })
          .update({
            status: WaitlistStatus.REMOVED,
            updated_at: new Date()
          });

        // Create audit log
        await trx('audit_logs').insert({
          id: uuidv4(),
          tenant_id: decoded.tenantId,
          actor_type: 'system',
          action: 'booking_confirmed',
          resource_type: 'booking',
          resource_id: bookingId,
          metadata: {
            slot_id: slot.id,
            waitlist_entry_id: entry.id,
            confirmation_token: token
          },
          created_at: new Date()
        });
      });
    } catch (transactionError: any) {
      if (transactionError.message === 'SLOT_NO_LONGER_AVAILABLE' || 
          transactionError.message === 'SLOT_BOOKING_CONFLICT') {
        return res.status(409).json({
          error: 'This slot is no longer available',
          message: 'Sorry, this slot has already been booked by someone else.'
        });
      }
      
      if (transactionError.message === 'HOLD_EXPIRED') {
        return res.status(409).json({
          error: 'Confirmation window has expired',
          message: 'Sorry, the 10-minute confirmation window has expired. This slot may have been offered to someone else.'
        });
      }
      
      throw transactionError; // Re-throw other errors
    }

    // Return success response with booking details
    const service = await req.app.locals.db('services')
      .where({ id: slot.service_id, tenant_id: decoded.tenantId })
      .first();

    const staff = await req.app.locals.db('staff')
      .where({ id: slot.staff_id, tenant_id: decoded.tenantId })
      .first();

    const tenant = await req.app.locals.db('tenants')
      .where({ id: decoded.tenantId })
      .first();

    res.json({
      success: true,
      message: 'Booking confirmed successfully!',
      booking: {
        customerName: entry.customer_name,
        serviceName: service?.name,
        staffName: staff?.name,
        businessName: tenant?.name,
        slotTime: `${slot.start_time} - ${slot.end_time}`,
        status: 'confirmed'
      }
    });

  } catch (error: any) {
    console.error('Confirmation error:', error);
    res.status(500).json({
      error: 'Failed to process confirmation',
      message: 'An error occurred while confirming your booking. Please contact the business directly.'
    });
  }
});

/**
 * Handle decline token (decline booking)
 */
router.post('/decline/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Decode token to get tenant info
    const tempNotificationService = new NotificationService(req.app.locals.db, '');
    const decoded = tempNotificationService.verifyConfirmToken(token);
    
    if (!decoded) {
      return res.status(400).json({
        error: 'Invalid or expired decline token'
      });
    }

    if (decoded.action !== 'decline') {
      return res.status(400).json({
        error: 'Invalid token action'
      });
    }

    // Create services with proper tenant context
    const notificationService = new NotificationService(req.app.locals.db, decoded.tenantId);
    
    // Initialize repositories with tenant context
    const waitlistRepo = new WaitlistRepository(decoded.tenantId);
    const slotRepo = new SlotRepository(decoded.tenantId);
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    const staffRepo = new StaffRepository(decoded.tenantId);
    
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);

    // Get the waitlist entry and slot
    const entry = await waitlistService.getWaitlistEntry(decoded.entryId);
    const slot = await slotService.getSlot(decoded.slotId);

    if (!entry || !slot) {
      return res.status(404).json({
        error: 'Waitlist entry or slot not found'
      });
    }

    // Start transaction for decline processing
    await req.app.locals.db.transaction(async (trx: any) => {
      // Release the slot hold
      await trx('slots')
        .where({ id: slot.id, tenant_id: decoded.tenantId })
        .update({
          status: SlotStatus.OPEN,
          hold_expires_at: null,
          updated_at: new Date()
        });

      // Keep waitlist entry active (customer stays on waitlist)
      // No need to update entry status as they remain on waitlist

      // Create audit log
      await trx('audit_logs').insert({
        id: uuidv4(),
        tenant_id: decoded.tenantId,
        actor_type: 'system',
        action: 'booking_declined',
        resource_type: 'slot',
        resource_id: slot.id,
        metadata: {
          waitlist_entry_id: entry.id,
          decline_token: token
        },
        created_at: new Date()
      });
    });

    // Trigger cascade notification to next candidate
    try {
      const nextCandidate = await slotService.handleCascadeNotification(slot.id);
      
      if (nextCandidate) {
        // Get additional data needed for notification
        const service = await req.app.locals.db('services')
          .where({ id: slot.service_id, tenant_id: decoded.tenantId })
          .first();
        
        const staff = await req.app.locals.db('staff')
          .where({ id: slot.staff_id, tenant_id: decoded.tenantId })
          .first();
        
        const tenant = await req.app.locals.db('tenants')
          .where({ id: decoded.tenantId })
          .first();

        if (service && staff && tenant && nextCandidate.email) {
          // Send notification to next candidate
          const notificationResult = await notificationService.sendNotification(
            nextCandidate,
            slot,
            service,
            staff,
            tenant.name
          );

          res.json({
            success: true,
            message: 'Booking declined. You remain on the waitlist and will be notified of future openings.',
            customerName: entry.customer_name,
            cascade: {
              next_candidate_notified: notificationResult.success,
              next_candidate_name: nextCandidate.customer_name
            }
          });
        } else {
          res.json({
            success: true,
            message: 'Booking declined. You remain on the waitlist and will be notified of future openings.',
            customerName: entry.customer_name,
            cascade: {
              next_candidate_notified: false,
              reason: 'Missing required data for notification'
            }
          });
        }
      } else {
        res.json({
          success: true,
          message: 'Booking declined. You remain on the waitlist and will be notified of future openings.',
          customerName: entry.customer_name,
          cascade: {
            next_candidate_notified: false,
            reason: 'No other eligible candidates found'
          }
        });
      }
    } catch (cascadeError: any) {
      console.error('Cascade notification error:', cascadeError);
      // Still return success for the decline, but log the cascade failure
      res.json({
        success: true,
        message: 'Booking declined. You remain on the waitlist and will be notified of future openings.',
        customerName: entry.customer_name,
        cascade: {
          next_candidate_notified: false,
          reason: 'Cascade notification failed'
        }
      });
    }

  } catch (error: any) {
    console.error('Decline error:', error);
    res.status(500).json({
      error: 'Failed to process decline',
      message: 'An error occurred while processing your decline. Please contact the business directly.'
    });
  }
});

/**
 * Get notification history (authenticated endpoint)
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { entryId, limit = 50, offset = 0 } = req.query;

    const notificationService = new NotificationService(req.app.locals.db, tenantId);

    let notifications;
    if (entryId) {
      notifications = await notificationService.getNotificationsForEntry(entryId as string);
    } else {
      // Get all notifications for tenant
      notifications = await req.app.locals.db('notifications')
        .where({ tenant_id: tenantId })
        .orderBy('created_at', 'desc')
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));
    }

    res.json({
      notifications,
      total: notifications.length
    });

  } catch (error: any) {
    console.error('Get notification history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve notification history'
    });
  }
});

/**
 * Get notification statistics (authenticated endpoint)
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    const notificationService = new NotificationService(req.app.locals.db, tenantId);
    const stats = await notificationService.getNotificationStats(start, end);

    res.json({
      period: {
        startDate: start,
        endDate: end
      },
      stats
    });

  } catch (error: any) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve notification statistics'
    });
  }
});

/**
 * Handle expired confirmation tokens and trigger cascade notifications
 */
router.post('/handle-expired/:slotId', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { slotId } = req.params;

    // Initialize repositories with tenant context
    const waitlistRepo = new WaitlistRepository(tenantId);
    const slotRepo = new SlotRepository(tenantId);
    const serviceRepo = new ServiceRepository(tenantId);
    const staffRepo = new StaffRepository(tenantId);
    
    const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
    const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService);
    const notificationService = new NotificationService(req.app.locals.db, tenantId);

    // Get the slot to verify it exists and is held
    const slot = await slotService.getSlot(slotId);
    if (!slot) {
      return res.status(404).json({
        error: 'Slot not found'
      });
    }

    if (slot.status !== SlotStatus.HELD) {
      return res.status(400).json({
        error: 'Slot is not in held status'
      });
    }

    // Check if hold has actually expired
    if (slot.hold_expires_at && new Date() <= slot.hold_expires_at) {
      return res.status(400).json({
        error: 'Hold has not expired yet'
      });
    }

    // Handle cascade notification
    const nextCandidate = await slotService.handleCascadeNotification(slotId);
    
    if (nextCandidate) {
      // Get additional data needed for notification
      const service = await req.app.locals.db('services')
        .where({ id: slot.service_id, tenant_id: tenantId })
        .first();
      
      const staff = await req.app.locals.db('staff')
        .where({ id: slot.staff_id, tenant_id: tenantId })
        .first();
      
      const tenant = await req.app.locals.db('tenants')
        .where({ id: tenantId })
        .first();

      if (service && staff && tenant && nextCandidate.email) {
        // Send notification to next candidate
        const notificationResult = await notificationService.sendNotification(
          nextCandidate,
          slot,
          service,
          staff,
          tenant.name
        );

        // Create audit log for expired hold handling
        await req.app.locals.db('audit_logs').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          actor_type: 'system',
          action: 'expired_hold_processed',
          resource_type: 'slot',
          resource_id: slotId,
          metadata: {
            next_candidate_id: nextCandidate.id,
            notification_sent: notificationResult.success
          },
          created_at: new Date()
        });

        res.json({
          success: true,
          message: 'Expired hold processed and next candidate notified',
          next_candidate: {
            id: nextCandidate.id,
            name: nextCandidate.customer_name,
            notification_sent: notificationResult.success
          }
        });
      } else {
        res.json({
          success: true,
          message: 'Expired hold processed but notification failed due to missing data',
          next_candidate: {
            id: nextCandidate.id,
            name: nextCandidate.customer_name,
            notification_sent: false
          }
        });
      }
    } else {
      // No more candidates, just release the slot
      await slotRepo.releaseHold(slotId);
      
      // Create audit log
      await req.app.locals.db('audit_logs').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        actor_type: 'system',
        action: 'expired_hold_released',
        resource_type: 'slot',
        resource_id: slotId,
        metadata: {
          reason: 'No eligible candidates found'
        },
        created_at: new Date()
      });

      res.json({
        success: true,
        message: 'Expired hold processed, slot released (no eligible candidates)',
        next_candidate: null
      });
    }

  } catch (error: any) {
    console.error('Handle expired confirmation error:', error);
    res.status(500).json({
      error: 'Failed to handle expired confirmation',
      message: 'An error occurred while processing the expired confirmation.'
    });
  }
});

/**
 * Retry failed notification (authenticated endpoint)
 */
router.post('/retry/:notificationId', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user!;
    const { notificationId } = req.params;

    const notificationService = new NotificationService(req.app.locals.db, tenantId);
    const result = await notificationService.retryFailedNotification(notificationId);

    if (result.success) {
      res.json({
        success: true,
        message: 'Notification retry successful',
        messageId: result.messageId
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error: any) {
    console.error('Retry notification error:', error);
    res.status(500).json({
      error: 'Failed to retry notification'
    });
  }
});

export default router;