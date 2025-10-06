import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import { Twilio } from 'twilio';
import { redisClient } from '../config/redis';
import { 
  Notification, 
  WaitlistEntry, 
  Slot, 
  Service, 
  Staff, 
  NotificationStatus, 
  NotificationType,
  WhatsAppTemplate,
  WhatsAppTemplateComponents
} from '../models';
import { v4 as uuidv4 } from 'uuid';

// Email template interfaces
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationData {
  customerName: string;
  serviceName: string;
  staffName: string;
  slotTime: string;
  confirmUrl: string;
  declineUrl: string;
  businessName: string;
}

export interface SMSTemplate {
  message: string;
}

export interface WhatsAppTemplateData {
  templateName: string;
  templateLanguage: string;
  parameters: string[];
}

export interface SendNotificationResult {
  success: boolean;
  notificationId: string;
  messageId?: string;
  error?: string;
}

export interface ConfirmationToken {
  entryId: string;
  slotId: string;
  tenantId: string;
  action: 'confirm' | 'decline';
  exp: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export class NotificationService {
  private db: any;
  private tenantId: string;
  private twilioClient: Twilio | null = null;

  constructor(db: any, tenantId: string) {
    this.db = db;
    this.tenantId = tenantId;
    
    // Initialize SendGrid
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      throw new Error('SENDGRID_API_KEY environment variable is required');
    }
    sgMail.setApiKey(apiKey);

    // Initialize Twilio (optional for Phase 2)
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (twilioAccountSid && twilioAuthToken) {
      this.twilioClient = new Twilio(twilioAccountSid, twilioAuthToken);
    }
  }

  /**
   * Send multi-channel notification with fallback logic
   */
  async sendNotification(
    entry: WaitlistEntry,
    slot: Slot,
    service: Service,
    staff: Staff,
    businessName: string
  ): Promise<SendNotificationResult> {
    // Determine notification channels to try based on entry preferences
    const channels = this.getNotificationChannels(entry);
    
    let lastError: string = '';
    
    // Try each channel in order of preference
    for (const channel of channels) {
      try {
        let result: SendNotificationResult;
        
        switch (channel) {
          case NotificationType.EMAIL:
            result = await this.sendEmailNotification(entry, slot, service, staff, businessName);
            break;
          case NotificationType.SMS:
            result = await this.sendSMSNotification(entry, slot, service, staff, businessName);
            break;
          case NotificationType.WHATSAPP:
            result = await this.sendWhatsAppNotification(entry, slot, service, staff, businessName);
            break;
          default:
            continue;
        }
        
        if (result.success) {
          return result;
        }
        
        lastError = result.error || 'Unknown error';
      } catch (error: any) {
        lastError = error.message;
        continue;
      }
    }
    
    // All channels failed
    return {
      success: false,
      notificationId: uuidv4(),
      error: `All notification channels failed. Last error: ${lastError}`
    };
  }

  /**
   * Send email notification to waitlist customer
   */
  async sendEmailNotification(
    entry: WaitlistEntry,
    slot: Slot,
    service: Service,
    staff: Staff,
    businessName: string
  ): Promise<SendNotificationResult> {
    try {
      // Check rate limit first
      const rateLimitCheck = await this.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          notificationId: '',
          error: `Rate limit exceeded. ${rateLimitCheck.remaining} notifications remaining. Reset at ${new Date(rateLimitCheck.resetTime).toISOString()}`
        };
      }

      // Generate confirmation tokens
      const confirmToken = this.generateConfirmToken(entry.id, slot.id, 'confirm');
      const declineToken = this.generateConfirmToken(entry.id, slot.id, 'decline');

      // Create notification record
      const notificationId = uuidv4();
      const notification: Partial<Notification> = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.EMAIL,
        recipient: entry.email || '',
        status: NotificationStatus.PENDING,
        created_at: new Date()
      };

      // Prepare notification data
      const notificationData: NotificationData = {
        customerName: entry.customer_name,
        serviceName: service.name,
        staffName: staff.name,
        slotTime: this.formatSlotTime(slot.start_time, slot.end_time),
        confirmUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/confirm/${confirmToken}`,
        declineUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/decline/${declineToken}`,
        businessName
      };

      // Generate email content
      const emailTemplate = this.generateEmailTemplate(notificationData);
      notification.subject = emailTemplate.subject;
      notification.message = emailTemplate.html;

      // Send email via SendGrid
      const msg = {
        to: entry.email!,
        from: process.env.FROM_EMAIL || 'noreply@waitlist.com',
        subject: emailTemplate.subject,
        text: emailTemplate.text,
        html: emailTemplate.html,
      };

      const response = await sgMail.send(msg);
      const messageId = response[0].headers['x-message-id'] as string;

      // Update notification record with success
      notification.status = NotificationStatus.SENT;
      notification.sent_at = new Date();
      await this.saveNotification(notification as Notification);

      // Update rate limit counter
      await this.incrementRateLimit();

      return {
        success: true,
        notificationId,
        messageId
      };

    } catch (error: any) {
      // Save failed notification
      const notificationId = uuidv4();
      const failedNotification: Notification = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.EMAIL,
        recipient: entry.email || '',
        subject: 'Slot Available',
        message: '',
        status: NotificationStatus.FAILED,
        error_message: error.message,
        created_at: new Date()
      };

      await this.saveNotification(failedNotification);

      return {
        success: false,
        notificationId,
        error: error.message
      };
    }
  }

  /**
   * Send SMS notification to waitlist customer
   */
  async sendSMSNotification(
    entry: WaitlistEntry,
    slot: Slot,
    service: Service,
    staff: Staff,
    businessName: string
  ): Promise<SendNotificationResult> {
    try {
      if (!this.twilioClient) {
        return {
          success: false,
          notificationId: '',
          error: 'Twilio client not configured'
        };
      }

      // Check rate limit first
      const rateLimitCheck = await this.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          notificationId: '',
          error: `Rate limit exceeded. ${rateLimitCheck.remaining} notifications remaining. Reset at ${new Date(rateLimitCheck.resetTime).toISOString()}`
        };
      }

      // Generate confirmation tokens
      const confirmToken = this.generateConfirmToken(entry.id, slot.id, 'confirm');
      const declineToken = this.generateConfirmToken(entry.id, slot.id, 'decline');

      // Create notification record
      const notificationId = uuidv4();
      const notification: Partial<Notification> = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.SMS,
        recipient: entry.phone,
        status: NotificationStatus.PENDING,
        created_at: new Date()
      };

      // Prepare notification data
      const notificationData: NotificationData = {
        customerName: entry.customer_name,
        serviceName: service.name,
        staffName: staff.name,
        slotTime: this.formatSlotTime(slot.start_time, slot.end_time),
        confirmUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/confirm/${confirmToken}`,
        declineUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/decline/${declineToken}`,
        businessName
      };

      // Generate SMS content
      const smsTemplate = this.generateSMSTemplate(notificationData);
      notification.message = smsTemplate.message;

      // Send SMS via Twilio
      const message = await this.twilioClient.messages.create({
        body: smsTemplate.message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: entry.phone
      });

      // Update notification record with success
      notification.status = NotificationStatus.SENT;
      notification.sent_at = new Date();
      await this.saveNotification(notification as Notification);

      // Update rate limit counter
      await this.incrementRateLimit();

      return {
        success: true,
        notificationId,
        messageId: message.sid
      };

    } catch (error: any) {
      // Save failed notification
      const notificationId = uuidv4();
      const failedNotification: Notification = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.SMS,
        recipient: entry.phone,
        subject: undefined,
        message: '',
        status: NotificationStatus.FAILED,
        error_message: error.message,
        created_at: new Date()
      };

      await this.saveNotification(failedNotification);

      return {
        success: false,
        notificationId,
        error: error.message
      };
    }
  }

  /**
   * Send WhatsApp notification to waitlist customer
   */
  async sendWhatsAppNotification(
    entry: WaitlistEntry,
    slot: Slot,
    service: Service,
    staff: Staff,
    businessName: string
  ): Promise<SendNotificationResult> {
    try {
      if (!this.twilioClient) {
        return {
          success: false,
          notificationId: '',
          error: 'Twilio client not configured'
        };
      }

      // Check rate limit first
      const rateLimitCheck = await this.checkRateLimit();
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          notificationId: '',
          error: `Rate limit exceeded. ${rateLimitCheck.remaining} notifications remaining. Reset at ${new Date(rateLimitCheck.resetTime).toISOString()}`
        };
      }

      // Get approved WhatsApp template for this tenant
      const template = await this.getApprovedWhatsAppTemplate();
      if (!template) {
        return {
          success: false,
          notificationId: '',
          error: 'No approved WhatsApp template found'
        };
      }

      // Generate confirmation tokens
      const confirmToken = this.generateConfirmToken(entry.id, slot.id, 'confirm');
      const declineToken = this.generateConfirmToken(entry.id, slot.id, 'decline');

      // Create notification record
      const notificationId = uuidv4();
      const notification: Partial<Notification> = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.WHATSAPP,
        recipient: entry.phone,
        status: NotificationStatus.PENDING,
        created_at: new Date()
      };

      // Prepare notification data
      const notificationData: NotificationData = {
        customerName: entry.customer_name,
        serviceName: service.name,
        staffName: staff.name,
        slotTime: this.formatSlotTime(slot.start_time, slot.end_time),
        confirmUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/confirm/${confirmToken}`,
        declineUrl: `${process.env.BASE_URL || 'http://localhost:3000'}/api/decline/${declineToken}`,
        businessName
      };

      // Generate WhatsApp template parameters
      const templateData = this.generateWhatsAppTemplateData(template, notificationData);
      notification.message = `WhatsApp template: ${templateData.templateName}`;

      // Send WhatsApp message via Twilio
      const message = await this.twilioClient.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to: `whatsapp:${entry.phone}`,
        contentSid: template.template_name, // This would be the approved template SID from Twilio
        contentVariables: JSON.stringify(templateData.parameters)
      });

      // Update notification record with success
      notification.status = NotificationStatus.SENT;
      notification.sent_at = new Date();
      await this.saveNotification(notification as Notification);

      // Update rate limit counter
      await this.incrementRateLimit();

      return {
        success: true,
        notificationId,
        messageId: message.sid
      };

    } catch (error: any) {
      // Save failed notification
      const notificationId = uuidv4();
      const failedNotification: Notification = {
        id: notificationId,
        tenant_id: this.tenantId,
        waitlist_entry_id: entry.id,
        slot_id: slot.id,
        type: NotificationType.WHATSAPP,
        recipient: entry.phone,
        subject: undefined,
        message: '',
        status: NotificationStatus.FAILED,
        error_message: error.message,
        created_at: new Date()
      };

      await this.saveNotification(failedNotification);

      return {
        success: false,
        notificationId,
        error: error.message
      };
    }
  }

  /**
   * Generate secure confirmation token
   */
  generateConfirmToken(entryId: string, slotId: string, action: 'confirm' | 'decline'): string {
    const expiryMinutes = parseInt(process.env.CONFIRMATION_TOKEN_EXPIRY || '15');
    const payload: ConfirmationToken = {
      entryId,
      slotId,
      tenantId: this.tenantId,
      action,
      exp: Math.floor(Date.now() / 1000) + (expiryMinutes * 60)
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.sign(payload, secret);
  }

  /**
   * Verify and decode confirmation token
   */
  verifyConfirmToken(token: string): ConfirmationToken | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
      }

      const decoded = jwt.verify(token, secret) as ConfirmationToken;
      
      // Check if token belongs to this tenant
      if (decoded.tenantId !== this.tenantId) {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check rate limit for notifications (25 per hour per tenant)
   */
  async checkRateLimit(): Promise<RateLimitResult> {
    const limit = parseInt(process.env.NOTIFICATION_RATE_LIMIT || '25');
    const windowMs = 60 * 60 * 1000; // 1 hour in milliseconds
    const key = `rate_limit:notifications:${this.tenantId}`;

    try {
      const current = await redisClient.get(key);
      const count = current ? parseInt(current) : 0;
      const ttl = await redisClient.ttl(key);
      
      const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : windowMs);

      if (count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetTime
        };
      }

      return {
        allowed: true,
        remaining: limit - count - 1,
        resetTime
      };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      
      // In mock mode or Redis failure, allow requests but log warning
      if (process.env.MOCK_REDIS === 'true') {
        console.warn('🔧 Rate limiting disabled in mock Redis mode');
      } else {
        console.warn('⚠️  Rate limiting unavailable - Redis connection failed');
      }
      
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + windowMs
      };
    }
  }

  /**
   * Increment rate limit counter
   */
  private async incrementRateLimit(): Promise<void> {
    const windowMs = 60 * 60 * 1000; // 1 hour in milliseconds
    const key = `rate_limit:notifications:${this.tenantId}`;

    try {
      const multi = redisClient.multi();
      multi.incr(key);
      multi.expire(key, Math.floor(windowMs / 1000));
      await multi.exec();
    } catch (error) {
      if (process.env.MOCK_REDIS !== 'true') {
        console.error('Failed to increment rate limit:', error);
      }
      // Silently fail in mock mode or Redis unavailable
    }
  }

  /**
   * Generate email template with personalization
   */
  private generateEmailTemplate(data: NotificationData): EmailTemplate {
    const subject = `${data.businessName}: Slot Available - ${data.serviceName}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .slot-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4f46e5; }
          .buttons { text-align: center; margin: 30px 0; }
          .btn { display: inline-block; padding: 12px 30px; margin: 0 10px; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .btn-confirm { background-color: #10b981; color: white; }
          .btn-decline { background-color: #ef4444; color: white; }
          .footer { text-align: center; margin-top: 30px; font-size: 14px; color: #6b7280; }
          .warning { background-color: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Great News, ${data.customerName}!</h1>
            <p>A slot has opened up for your requested service</p>
          </div>
          
          <div class="content">
            <div class="slot-details">
              <h2>📅 Slot Details</h2>
              <p><strong>Service:</strong> ${data.serviceName}</p>
              <p><strong>Staff:</strong> ${data.staffName}</p>
              <p><strong>Time:</strong> ${data.slotTime}</p>
              <p><strong>Business:</strong> ${data.businessName}</p>
            </div>

            <div class="warning">
              <strong>⏰ Time Sensitive:</strong> This slot is being held for you for 10 minutes. Please respond quickly to secure your booking.
            </div>

            <div class="buttons">
              <a href="${data.confirmUrl}" class="btn btn-confirm">✅ CONFIRM BOOKING</a>
              <a href="${data.declineUrl}" class="btn btn-decline">❌ DECLINE</a>
            </div>

            <p>If you confirm this booking, you'll be removed from other waitlists for ${data.businessName}. If you decline or don't respond within 10 minutes, we'll offer this slot to the next person on the waitlist.</p>
          </div>

          <div class="footer">
            <p>This is an automated message from ${data.businessName}'s waitlist system.</p>
            <p>If you have any questions, please contact ${data.businessName} directly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
${data.businessName}: Slot Available

Hi ${data.customerName},

Great news! A slot has opened up for your requested service:

Service: ${data.serviceName}
Staff: ${data.staffName}
Time: ${data.slotTime}

This slot is being held for you for 10 minutes. Please respond quickly:

CONFIRM: ${data.confirmUrl}
DECLINE: ${data.declineUrl}

If you confirm this booking, you'll be removed from other waitlists for ${data.businessName}. If you decline or don't respond within 10 minutes, we'll offer this slot to the next person on the waitlist.

This is an automated message from ${data.businessName}'s waitlist system.
    `;

    return { subject, html, text };
  }

  /**
   * Generate SMS template with personalization
   */
  private generateSMSTemplate(data: NotificationData): SMSTemplate {
    const message = `🎉 ${data.businessName}: Slot Available!

Hi ${data.customerName}, great news! A slot opened up:

📅 ${data.serviceName} with ${data.staffName}
⏰ ${data.slotTime}

⚡ QUICK ACTION NEEDED (10 min hold):
✅ Confirm: Reply "YES" or visit ${data.confirmUrl}
❌ Decline: Reply "NO" or visit ${data.declineUrl}

Confirming removes you from other waitlists. If no response in 10 min, we'll offer to next person.`;

    return { message };
  }

  /**
   * Get notification channels in order of preference with fallback
   */
  private getNotificationChannels(entry: WaitlistEntry): NotificationType[] {
    const channels: NotificationType[] = [];
    
    // Start with preferred channel
    if (entry.preferred_channel) {
      channels.push(entry.preferred_channel);
    }
    
    // Add other available channels from notification_channels array
    if (entry.notification_channels && entry.notification_channels.length > 0) {
      for (const channel of entry.notification_channels) {
        if (!channels.includes(channel)) {
          channels.push(channel);
        }
      }
    }
    
    // Fallback logic based on available contact info
    if (channels.length === 0) {
      if (entry.email) {
        channels.push(NotificationType.EMAIL);
      }
      if (entry.phone) {
        channels.push(NotificationType.SMS);
        channels.push(NotificationType.WHATSAPP);
      }
    }
    
    // Filter out channels that aren't properly configured
    return channels.filter(channel => {
      switch (channel) {
        case NotificationType.EMAIL:
          return !!entry.email && !!process.env.SENDGRID_API_KEY;
        case NotificationType.SMS:
        case NotificationType.WHATSAPP:
          return !!entry.phone && !!this.twilioClient;
        default:
          return false;
      }
    });
  }

  /**
   * Get approved WhatsApp template for tenant
   */
  private async getApprovedWhatsAppTemplate(): Promise<WhatsAppTemplate | null> {
    const template = await this.db('whatsapp_templates')
      .where({
        tenant_id: this.tenantId,
        status: 'approved',
        active: true
      })
      .orderBy('created_at', 'desc')
      .first();

    return template || null;
  }

  /**
   * Generate WhatsApp template data with parameters
   */
  private generateWhatsAppTemplateData(
    template: WhatsAppTemplate, 
    data: NotificationData
  ): WhatsAppTemplateData {
    // This would map the notification data to template parameters
    // The exact mapping depends on the template structure
    const parameters = [
      data.customerName,
      data.serviceName,
      data.staffName,
      data.slotTime,
      data.businessName
    ];

    return {
      templateName: template.template_name,
      templateLanguage: template.template_language,
      parameters
    };
  }

  /**
   * Format slot time for display
   */
  private formatSlotTime(startTime: Date, endTime: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    };

    const start = startTime.toLocaleDateString('en-US', options);
    const endTimeOnly = endTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    return `${start} - ${endTimeOnly}`;
  }

  /**
   * Save notification to database
   */
  private async saveNotification(notification: Notification): Promise<void> {
    await this.db('notifications').insert({
      ...notification,
      created_at: notification.created_at,
      updated_at: new Date()
    });
  }

  /**
   * Get notification by ID
   */
  async getNotification(notificationId: string): Promise<Notification | null> {
    const result = await this.db('notifications')
      .where({ id: notificationId, tenant_id: this.tenantId })
      .first();

    return result || null;
  }

  /**
   * Get notifications for a waitlist entry
   */
  async getNotificationsForEntry(entryId: string): Promise<Notification[]> {
    return await this.db('notifications')
      .where({ waitlist_entry_id: entryId, tenant_id: this.tenantId })
      .orderBy('created_at', 'desc');
  }

  /**
   * Update notification status (for delivery tracking)
   */
  async updateNotificationStatus(
    notificationId: string, 
    status: NotificationStatus, 
    deliveredAt?: Date,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date()
    };

    if (deliveredAt) {
      updateData.delivered_at = deliveredAt;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    await this.db('notifications')
      .where({ id: notificationId, tenant_id: this.tenantId })
      .update(updateData);
  }

  /**
   * Retry failed notification with exponential backoff
   */
  async retryFailedNotification(notificationId: string, retryCount: number = 0): Promise<SendNotificationResult> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    if (retryCount >= maxRetries) {
      return {
        success: false,
        notificationId,
        error: 'Maximum retry attempts exceeded'
      };
    }

    // Exponential backoff delay
    const delay = baseDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) {
        return {
          success: false,
          notificationId,
          error: 'Notification not found'
        };
      }

      // Get related data for retry
      const entry = await this.db('waitlist_entries')
        .where({ id: notification.waitlist_entry_id, tenant_id: this.tenantId })
        .first();

      const slot = await this.db('slots')
        .where({ id: notification.slot_id, tenant_id: this.tenantId })
        .first();

      const service = await this.db('services')
        .where({ id: slot.service_id, tenant_id: this.tenantId })
        .first();

      const staff = await this.db('staff')
        .where({ id: slot.staff_id, tenant_id: this.tenantId })
        .first();

      const tenant = await this.db('tenants')
        .where({ id: this.tenantId })
        .first();

      if (!entry || !slot || !service || !staff || !tenant) {
        return {
          success: false,
          notificationId,
          error: 'Required data not found for retry'
        };
      }

      // Attempt to resend
      return await this.sendEmailNotification(entry, slot, service, staff, tenant.name);

    } catch (error: any) {
      // Retry with exponential backoff
      return await this.retryFailedNotification(notificationId, retryCount + 1);
    }
  }

  /**
   * Get notification statistics for analytics
   */
  async getNotificationStats(startDate: Date, endDate: Date): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  }> {
    const stats = await this.db('notifications')
      .where('tenant_id', this.tenantId)
      .whereBetween('created_at', [startDate, endDate])
      .select(
        this.db.raw('COUNT(*) as total'),
        this.db.raw('SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent'),
        this.db.raw('SUM(CASE WHEN status = "delivered" THEN 1 ELSE 0 END) as delivered'),
        this.db.raw('SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed')
      )
      .first();

    const total = parseInt(stats.total) || 0;
    const sent = parseInt(stats.sent) || 0;
    const delivered = parseInt(stats.delivered) || 0;
    const failed = parseInt(stats.failed) || 0;

    const deliveryRate = total > 0 ? (sent / total) * 100 : 0;

    return {
      total,
      sent,
      delivered,
      failed,
      deliveryRate: Math.round(deliveryRate * 100) / 100
    };
  }
}