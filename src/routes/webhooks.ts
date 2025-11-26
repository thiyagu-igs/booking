import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { NotificationService } from '../services/NotificationService';
import { WaitlistService } from '../services/WaitlistService';
import { SlotService } from '../services/SlotService';
import { AuditService } from '../services/AuditService';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { logger } from '../config/logger';

const router = express.Router();

/**
 * Twilio SMS webhook endpoint for processing "YES"/"NO" responses
 */
router.post('/twilio/sms', [
  body('From').notEmpty().withMessage('From phone number is required'),
  body('Body').notEmpty().withMessage('Message body is required'),
  body('MessageSid').notEmpty().withMessage('Message SID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Invalid Twilio SMS webhook payload', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { From: fromPhone, Body: messageBody, MessageSid: messageSid } = req.body;
    
    // Normalize phone number (remove whatsapp: prefix if present)
    const phoneNumber = fromPhone.replace('whatsapp:', '');
    
    // Parse response (YES/NO)
    const response = messageBody.trim().toLowerCase();
    const isConfirm = ['yes', 'y', 'confirm', '1', 'ok'].includes(response);
    const isDecline = ['no', 'n', 'decline', '0', 'cancel'].includes(response);
    
    if (!isConfirm && !isDecline) {
      // Send help message for unrecognized responses
      await sendHelpMessage(phoneNumber, messageSid);
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Find the most recent active notification for this phone number
    const notification = await findRecentNotificationByPhone(phoneNumber);
    
    if (!notification) {
      logger.warn('No recent notification found for SMS response', { 
        phone: phoneNumber, 
        response: messageBody 
      });
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Process the confirmation/decline
    const action = isConfirm ? 'confirm' : 'decline';
    await processSMSResponse(notification, action, messageSid);
    
    logger.info('SMS response processed successfully', {
      phone: phoneNumber,
      action,
      notificationId: notification.id
    });

    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    
  } catch (error: any) {
    logger.error('Error processing Twilio SMS webhook', { 
      error: error.message,
      stack: error.stack,
      body: req.body 
    });
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * Twilio WhatsApp webhook endpoint for processing responses
 */
router.post('/twilio/whatsapp', [
  body('From').notEmpty().withMessage('From phone number is required'),
  body('Body').notEmpty().withMessage('Message body is required'),
  body('MessageSid').notEmpty().withMessage('Message SID is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Invalid Twilio WhatsApp webhook payload', { errors: errors.array() });
      return res.status(400).json({ errors: errors.array() });
    }

    const { From: fromPhone, Body: messageBody, MessageSid: messageSid } = req.body;
    
    // Normalize phone number (remove whatsapp: prefix)
    const phoneNumber = fromPhone.replace('whatsapp:', '');
    
    // Parse response (YES/NO)
    const response = messageBody.trim().toLowerCase();
    const isConfirm = ['yes', 'y', 'confirm', '1', 'ok'].includes(response);
    const isDecline = ['no', 'n', 'decline', '0', 'cancel'].includes(response);
    
    if (!isConfirm && !isDecline) {
      // Send help message for unrecognized responses
      await sendWhatsAppHelpMessage(phoneNumber, messageSid);
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Find the most recent active notification for this phone number
    const notification = await findRecentNotificationByPhone(phoneNumber);
    
    if (!notification) {
      logger.warn('No recent notification found for WhatsApp response', { 
        phone: phoneNumber, 
        response: messageBody 
      });
      return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    }

    // Process the confirmation/decline
    const action = isConfirm ? 'confirm' : 'decline';
    await processSMSResponse(notification, action, messageSid);
    
    logger.info('WhatsApp response processed successfully', {
      phone: phoneNumber,
      action,
      notificationId: notification.id
    });

    res.status(200).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    
  } catch (error: any) {
    logger.error('Error processing Twilio WhatsApp webhook', { 
      error: error.message,
      stack: error.stack,
      body: req.body 
    });
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  }
});

/**
 * SendGrid webhook endpoint for email delivery tracking
 */
router.post('/sendgrid/events', express.json(), async (req: Request, res: Response) => {
  try {
    const events = req.body;
    
    if (!Array.isArray(events)) {
      return res.status(400).json({ error: 'Expected array of events' });
    }

    for (const event of events) {
      await processSendGridEvent(event);
    }
    
    res.status(200).json({ message: 'Events processed' });
    
  } catch (error: any) {
    logger.error('Error processing SendGrid webhook', { 
      error: error.message,
      stack: error.stack,
      body: req.body 
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Helper function to find recent notification by phone number
 */
async function findRecentNotificationByPhone(phoneNumber: string) {
  const db = require('../config/database').default;
  
  // Find the most recent notification sent to this phone number in the last 15 minutes
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const notification = await db('notifications')
    .join('waitlist_entries', 'notifications.waitlist_entry_id', 'waitlist_entries.id')
    .join('slots', 'notifications.slot_id', 'slots.id')
    .where('waitlist_entries.phone', phoneNumber)
    .where('notifications.status', 'sent')
    .where('notifications.created_at', '>=', fifteenMinutesAgo)
    .whereIn('notifications.type', ['sms', 'whatsapp'])
    .where('slots.status', 'held') // Only process if slot is still held
    .orderBy('notifications.created_at', 'desc')
    .select(
      'notifications.*',
      'waitlist_entries.tenant_id',
      'waitlist_entries.customer_name',
      'slots.hold_expires_at'
    )
    .first();

  return notification;
}

/**
 * Process SMS/WhatsApp response (confirm or decline)
 */
async function processSMSResponse(notification: any, action: 'confirm' | 'decline', messageSid: string) {
  const db = require('../config/database').default;
  
  // Check if hold is still valid
  if (notification.hold_expires_at && new Date() > new Date(notification.hold_expires_at)) {
    logger.warn('SMS response received after hold expired', {
      notificationId: notification.id,
      holdExpiredAt: notification.hold_expires_at
    });
    return;
  }

  // Initialize repositories with tenant context
  const waitlistRepo = new WaitlistRepository(notification.tenant_id);
  const serviceRepo = new ServiceRepository(notification.tenant_id);
  const staffRepo = new StaffRepository(notification.tenant_id);
  const slotRepo = new SlotRepository(notification.tenant_id);
  
  // Initialize services with proper dependencies
  const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
  const slotService = new SlotService(
    slotRepo,
    waitlistRepo,
    serviceRepo,
    staffRepo,
    waitlistService,
    notification.tenant_id
  );

  try {
    if (action === 'confirm') {
      // Confirm the booking using bookSlot
      await slotService.bookSlot(notification.slot_id);
      
      // Log the confirmation
      await AuditService.log({
        tenantId: notification.tenant_id,
        actorType: 'system',
        action: 'confirm_booking_sms',
        resourceType: 'slot',
        resourceId: notification.slot_id,
        metadata: { 
          confirmed_via: 'sms',
          message_sid: messageSid,
          customer_name: notification.customer_name,
          waitlist_entry_id: notification.waitlist_entry_id
        }
      });
      
      logger.info('Booking confirmed via SMS', {
        slotId: notification.slot_id,
        entryId: notification.waitlist_entry_id,
        messageSid
      });
      
    } else {
      // Decline the booking: release hold and open slot for cascade
      await slotService.releaseHold(notification.slot_id);
      await slotService.openSlot(notification.slot_id);
      
      // Log the decline
      await AuditService.log({
        tenantId: notification.tenant_id,
        actorType: 'system',
        action: 'decline_booking_sms',
        resourceType: 'slot',
        resourceId: notification.slot_id,
        metadata: { 
          declined_via: 'sms',
          message_sid: messageSid,
          customer_name: notification.customer_name,
          waitlist_entry_id: notification.waitlist_entry_id
        }
      });
      
      logger.info('Booking declined via SMS', {
        slotId: notification.slot_id,
        entryId: notification.waitlist_entry_id,
        messageSid
      });
    }
    
  } catch (error: any) {
    logger.error('Error processing SMS response', {
      error: error.message,
      notificationId: notification.id,
      action,
      messageSid
    });
    throw error;
  }
}

/**
 * Send help message for unrecognized SMS responses
 */
async function sendHelpMessage(phoneNumber: string, originalMessageSid: string) {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!twilioAccountSid || !twilioAuthToken) {
      logger.warn('Twilio not configured, cannot send help message');
      return;
    }

    const { Twilio } = require('twilio');
    const client = new Twilio(twilioAccountSid, twilioAuthToken);
    
    const helpMessage = `I didn't understand your response. Please reply:
• "YES" to confirm your booking
• "NO" to decline

Or use the links in the original message.`;

    await client.messages.create({
      body: helpMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    logger.info('Help message sent via SMS', { phoneNumber, originalMessageSid });
    
  } catch (error: any) {
    logger.error('Error sending SMS help message', { 
      error: error.message, 
      phoneNumber 
    });
  }
}

/**
 * Send help message for unrecognized WhatsApp responses
 */
async function sendWhatsAppHelpMessage(phoneNumber: string, originalMessageSid: string) {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!twilioAccountSid || !twilioAuthToken) {
      logger.warn('Twilio not configured, cannot send WhatsApp help message');
      return;
    }

    const { Twilio } = require('twilio');
    const client = new Twilio(twilioAccountSid, twilioAuthToken);
    
    const helpMessage = `I didn't understand your response. Please reply:
• "YES" to confirm your booking
• "NO" to decline

Or use the links in the original message.`;

    await client.messages.create({
      body: helpMessage,
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phoneNumber}`
    });
    
    logger.info('Help message sent via WhatsApp', { phoneNumber, originalMessageSid });
    
  } catch (error: any) {
    logger.error('Error sending WhatsApp help message', { 
      error: error.message, 
      phoneNumber 
    });
  }
}

/**
 * Process SendGrid delivery events
 */
async function processSendGridEvent(event: any) {
  const db = require('../config/database').default;
  
  try {
    // Extract message ID from SendGrid event
    const messageId = event['sg_message_id'];
    if (!messageId) {
      return;
    }

    // Find notification by message ID (this would require storing message ID in notifications table)
    // For now, we'll log the event
    logger.info('SendGrid event received', {
      event: event.event,
      messageId,
      timestamp: event.timestamp,
      email: event.email
    });

    // Update notification status based on event type
    switch (event.event) {
      case 'delivered':
        // Update notification status to delivered
        await db('notifications')
          .where('message_id', messageId) // This field would need to be added to notifications table
          .update({
            status: 'delivered',
            delivered_at: new Date(event.timestamp * 1000),
            updated_at: new Date()
          });
        break;
        
      case 'bounce':
      case 'dropped':
        // Update notification status to failed
        await db('notifications')
          .where('message_id', messageId)
          .update({
            status: 'failed',
            error_message: event.reason || 'Email bounced or dropped',
            updated_at: new Date()
          });
        break;
    }
    
  } catch (error: any) {
    logger.error('Error processing SendGrid event', { 
      error: error.message, 
      event 
    });
  }
}

export default router;