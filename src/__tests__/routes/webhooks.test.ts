import request from 'supertest';
import { app } from '../../index';
import db from '../../database/connection';
import { Twilio } from 'twilio';

// Mock Twilio
jest.mock('twilio');
const mockTwilioMessages = {
  create: jest.fn()
};
const mockTwilioClient = {
  messages: mockTwilioMessages
} as any;
(Twilio as jest.MockedClass<typeof Twilio>).mockImplementation(() => mockTwilioClient);

describe('Webhook Routes', () => {
  const tenantId = 'tenant-123';
  let notificationId: string;
  let slotId: string;
  let entryId: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.TWILIO_WHATSAPP_NUMBER = '+1234567890';
  });

  beforeEach(async () => {
    // Clean up database
    await db('notifications').del();
    await db('waitlist_entries').del();
    await db('slots').del();
    await db('services').del();
    await db('staff').del();
    await db('tenants').del();

    // Create test tenant
    await db('tenants').insert({
      id: tenantId,
      name: 'Test Business',
      timezone: 'UTC'
    });

    // Create test staff
    await db('staff').insert({
      id: 'staff-123',
      tenant_id: tenantId,
      name: 'Sarah Johnson',
      role: 'Stylist',
      active: true
    });

    // Create test service
    await db('services').insert({
      id: 'service-123',
      tenant_id: tenantId,
      name: 'Haircut',
      duration_minutes: 60,
      price: 50,
      active: true
    });

    // Create test slot
    slotId = 'slot-123';
    await db('slots').insert({
      id: slotId,
      tenant_id: tenantId,
      staff_id: 'staff-123',
      service_id: 'service-123',
      start_time: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      status: 'held',
      hold_expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
    });

    // Create test waitlist entry
    entryId = 'entry-123';
    await db('waitlist_entries').insert({
      id: entryId,
      tenant_id: tenantId,
      customer_name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      service_id: 'service-123',
      staff_id: 'staff-123',
      earliest_time: new Date(),
      latest_time: new Date(Date.now() + 24 * 60 * 60 * 1000),
      priority_score: 75,
      vip_status: false,
      status: 'notified',
      notification_channels: JSON.stringify(['sms', 'email']),
      preferred_channel: 'sms'
    });

    // Create test notification
    notificationId = 'notification-123';
    await db('notifications').insert({
      id: notificationId,
      tenant_id: tenantId,
      waitlist_entry_id: entryId,
      slot_id: slotId,
      type: 'sms',
      recipient: '+1234567890',
      message: 'Test SMS notification',
      status: 'sent',
      sent_at: new Date()
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('POST /api/webhooks/twilio/sms', () => {
    const twilioSMSPayload = {
      From: '+1234567890',
      Body: 'YES',
      MessageSid: 'SMS123456789'
    };

    it('should process YES response and confirm booking', async () => {
      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(twilioSMSPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify slot was booked
      const updatedSlot = await db('slots').where({ id: slotId }).first();
      expect(updatedSlot.status).toBe('booked');

      // Verify booking was created
      const booking = await db('bookings').where({ slot_id: slotId }).first();
      expect(booking).toBeTruthy();
      expect(booking.customer_name).toBe('John Doe');
      expect(booking.booking_source).toBe('waitlist');
    });

    it('should process NO response and trigger cascade', async () => {
      const declinePayload = {
        ...twilioSMSPayload,
        Body: 'NO'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(declinePayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify slot is still held (would be released and offered to next candidate in real scenario)
      const updatedSlot = await db('slots').where({ id: slotId }).first();
      expect(updatedSlot.status).toBe('held');

      // Verify waitlist entry was updated
      const updatedEntry = await db('waitlist_entries').where({ id: entryId }).first();
      expect(updatedEntry.status).toBe('removed');
    });

    it('should handle alternative YES responses', async () => {
      const variations = ['yes', 'Y', 'y', 'confirm', '1', 'ok'];

      for (const variation of variations) {
        // Reset slot status
        await db('slots').where({ id: slotId }).update({ status: 'held' });
        await db('waitlist_entries').where({ id: entryId }).update({ status: 'notified' });

        const payload = {
          ...twilioSMSPayload,
          Body: variation,
          MessageSid: `SMS${Date.now()}`
        };

        const response = await request(app)
          .post('/api/webhooks/twilio/sms')
          .send(payload)
          .expect(200);

        expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

        // Verify slot was booked
        const updatedSlot = await db('slots').where({ id: slotId }).first();
        expect(updatedSlot.status).toBe('booked');
      }
    });

    it('should handle alternative NO responses', async () => {
      const variations = ['no', 'N', 'n', 'decline', '0', 'cancel'];

      for (const variation of variations) {
        // Reset slot and entry status
        await db('slots').where({ id: slotId }).update({ status: 'held' });
        await db('waitlist_entries').where({ id: entryId }).update({ status: 'notified' });

        const payload = {
          ...twilioSMSPayload,
          Body: variation,
          MessageSid: `SMS${Date.now()}`
        };

        const response = await request(app)
          .post('/api/webhooks/twilio/sms')
          .send(payload)
          .expect(200);

        expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

        // Verify entry was removed
        const updatedEntry = await db('waitlist_entries').where({ id: entryId }).first();
        expect(updatedEntry.status).toBe('removed');
      }
    });

    it('should send help message for unrecognized responses', async () => {
      mockTwilioMessages.create.mockResolvedValue({
        sid: 'HELP123456789',
        status: 'sent'
      });

      const unrecognizedPayload = {
        ...twilioSMSPayload,
        Body: 'MAYBE'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(unrecognizedPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify help message was sent
      expect(mockTwilioMessages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('I didn\'t understand your response'),
        from: '+1234567890',
        to: '+1234567890'
      });
    });

    it('should handle expired hold gracefully', async () => {
      // Set hold to expired
      await db('slots').where({ id: slotId }).update({
        hold_expires_at: new Date(Date.now() - 60 * 1000) // 1 minute ago
      });

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(twilioSMSPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify slot status wasn't changed
      const updatedSlot = await db('slots').where({ id: slotId }).first();
      expect(updatedSlot.status).toBe('held'); // Should remain unchanged
    });

    it('should handle missing notification gracefully', async () => {
      const noNotificationPayload = {
        From: '+9999999999', // Different phone number
        Body: 'YES',
        MessageSid: 'SMS999999999'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(noNotificationPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    it('should validate required fields', async () => {
      const invalidPayload = {
        From: '+1234567890'
        // Missing Body and MessageSid
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/webhooks/twilio/whatsapp', () => {
    const twilioWhatsAppPayload = {
      From: 'whatsapp:+1234567890',
      Body: 'YES',
      MessageSid: 'WA123456789'
    };

    beforeEach(async () => {
      // Update notification to WhatsApp type
      await db('notifications').where({ id: notificationId }).update({
        type: 'whatsapp'
      });
    });

    it('should process WhatsApp YES response', async () => {
      const response = await request(app)
        .post('/api/webhooks/twilio/whatsapp')
        .send(twilioWhatsAppPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify slot was booked
      const updatedSlot = await db('slots').where({ id: slotId }).first();
      expect(updatedSlot.status).toBe('booked');
    });

    it('should process WhatsApp NO response', async () => {
      const declinePayload = {
        ...twilioWhatsAppPayload,
        Body: 'NO'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/whatsapp')
        .send(declinePayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify entry was removed
      const updatedEntry = await db('waitlist_entries').where({ id: entryId }).first();
      expect(updatedEntry.status).toBe('removed');
    });

    it('should send WhatsApp help message for unrecognized responses', async () => {
      mockTwilioMessages.create.mockResolvedValue({
        sid: 'WAHELP123456789',
        status: 'sent'
      });

      const unrecognizedPayload = {
        ...twilioWhatsAppPayload,
        Body: 'MAYBE'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/whatsapp')
        .send(unrecognizedPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

      // Verify help message was sent
      expect(mockTwilioMessages.create).toHaveBeenCalledWith({
        body: expect.stringContaining('I didn\'t understand your response'),
        from: 'whatsapp:+1234567890',
        to: 'whatsapp:+1234567890'
      });
    });

    it('should handle whatsapp: prefix in phone number', async () => {
      const response = await request(app)
        .post('/api/webhooks/twilio/whatsapp')
        .send(twilioWhatsAppPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });
  });

  describe('POST /api/webhooks/sendgrid/events', () => {
    it('should process SendGrid delivery events', async () => {
      const sendGridEvents = [
        {
          event: 'delivered',
          email: 'john@example.com',
          timestamp: Math.floor(Date.now() / 1000),
          sg_message_id: 'EMAIL123456789'
        },
        {
          event: 'bounce',
          email: 'invalid@example.com',
          timestamp: Math.floor(Date.now() / 1000),
          sg_message_id: 'EMAIL987654321',
          reason: 'Invalid email address'
        }
      ];

      const response = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .send(sendGridEvents)
        .expect(200);

      expect(response.body.message).toBe('Events processed');
    });

    it('should handle invalid SendGrid payload', async () => {
      const invalidPayload = 'not an array';

      const response = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .send(invalidPayload)
        .expect(400);

      expect(response.body.error).toBe('Expected array of events');
    });

    it('should handle SendGrid processing errors gracefully', async () => {
      const eventsWithMissingData = [
        {
          event: 'delivered'
          // Missing required fields
        }
      ];

      const response = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .send(eventsWithMissingData)
        .expect(200);

      expect(response.body.message).toBe('Events processed');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error by using invalid tenant ID
      await db('notifications').where({ id: notificationId }).update({
        tenant_id: 'invalid-tenant'
      });

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send({
          From: '+1234567890',
          Body: 'YES',
          MessageSid: 'SMS123456789'
        })
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    it('should handle Twilio client errors gracefully', async () => {
      // Remove Twilio configuration
      delete process.env.TWILIO_ACCOUNT_SID;

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send({
          From: '+1234567890',
          Body: 'UNKNOWN',
          MessageSid: 'SMS123456789'
        })
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });
  });
});