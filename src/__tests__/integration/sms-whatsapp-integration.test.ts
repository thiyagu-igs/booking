import request from 'supertest';
import { app } from '../../index';
import db from '../../database/connection';
import jwt from 'jsonwebtoken';

describe('SMS and WhatsApp Integration', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';
  let authToken: string;

  beforeAll(async () => {
    // Create auth token
    authToken = jwt.sign(
      { userId, tenantId },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Set up test environment
    process.env.TWILIO_ACCOUNT_SID = 'test_account_sid';
    process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
    process.env.TWILIO_PHONE_NUMBER = '+1234567890';
    process.env.TWILIO_WHATSAPP_NUMBER = '+1234567890';
  });

  beforeEach(async () => {
    // Clean up database
    await db('whatsapp_templates').del();
    await db('notifications').del();
    await db('waitlist_entries').del();
    await db('slots').del();
    await db('services').del();
    await db('staff').del();
    await db('users').del();
    await db('tenants').del();

    // Create test tenant
    await db('tenants').insert({
      id: tenantId,
      name: 'Test Business',
      timezone: 'UTC'
    });

    // Create test user
    await db('users').insert({
      id: userId,
      tenant_id: tenantId,
      email: 'admin@test.com',
      password_hash: 'hashed_password',
      name: 'Admin User',
      role: 'admin',
      active: true
    });
  });

  describe('Waitlist Entry with Notification Channels', () => {
    beforeEach(async () => {
      // Create test staff
      await db('staff').insert({
        id: 'staff-123',
        tenant_id: tenantId,
        name: 'Sarah Johnson',
        role: 'Stylist',
        active: true,
        calendar_sync_status: 'disabled'
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
    });

    it('should create waitlist entry with SMS preference', async () => {
      const waitlistData = {
        customer_name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        service_id: 'service-123',
        staff_id: 'staff-123',
        earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        latest_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        vip_status: false,
        notification_channels: ['sms', 'email'],
        preferred_channel: 'sms'
      };

      const response = await request(app)
        .post('/api/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .send(waitlistData)
        .expect(201);

      expect(response.body.message).toBe('Successfully added to waitlist');
      expect(response.body.data.preferred_channel).toBe('sms');
      expect(response.body.data.notification_channels).toEqual(['sms', 'email']);
    });

    it('should create waitlist entry with WhatsApp preference', async () => {
      const waitlistData = {
        customer_name: 'Jane Smith',
        phone: '+1987654321',
        email: 'jane@example.com',
        service_id: 'service-123',
        earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        latest_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        vip_status: false,
        notification_channels: ['whatsapp', 'sms', 'email'],
        preferred_channel: 'whatsapp'
      };

      const response = await request(app)
        .post('/api/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .send(waitlistData)
        .expect(201);

      expect(response.body.message).toBe('Successfully added to waitlist');
      expect(response.body.data.preferred_channel).toBe('whatsapp');
      expect(response.body.data.notification_channels).toEqual(['whatsapp', 'sms', 'email']);
    });

    it('should default to email when no preferences specified', async () => {
      const waitlistData = {
        customer_name: 'Bob Wilson',
        phone: '+1555666777',
        email: 'bob@example.com',
        service_id: 'service-123',
        earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        latest_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        vip_status: false
      };

      const response = await request(app)
        .post('/api/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .send(waitlistData)
        .expect(201);

      expect(response.body.message).toBe('Successfully added to waitlist');
      expect(response.body.data.preferred_channel).toBe('email');
      expect(response.body.data.notification_channels).toContain('email');
      expect(response.body.data.notification_channels).toContain('sms');
      expect(response.body.data.notification_channels).toContain('whatsapp');
    });

    it('should validate notification channel values', async () => {
      const waitlistData = {
        customer_name: 'Invalid User',
        phone: '+1234567890',
        email: 'invalid@example.com',
        service_id: 'service-123',
        earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        latest_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        vip_status: false,
        notification_channels: ['invalid_channel'],
        preferred_channel: 'invalid_channel'
      };

      const response = await request(app)
        .post('/api/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .send(waitlistData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('WhatsApp Template Management', () => {
    it('should create default WhatsApp template', async () => {
      const response = await request(app)
        .post('/api/whatsapp-templates/default/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templateId).toBeDefined();

      // Verify template was created in database
      const template = await db('whatsapp_templates')
        .where({ template_name: 'waitlist_slot_available' })
        .first();
      expect(template).toBeTruthy();
      expect(template.status).toBe('pending');
    });

    it('should create custom WhatsApp template', async () => {
      const templateData = {
        templateName: 'custom_notification',
        templateLanguage: 'en',
        templateCategory: 'UTILITY',
        templateComponents: {
          body: {
            text: 'Hi {{1}}, your appointment for {{2}} is confirmed.'
          },
          buttons: [
            {
              type: 'QUICK_REPLY',
              text: '✅ Got it'
            }
          ]
        }
      };

      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(templateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templateId).toBeDefined();
    });

    it('should get all templates', async () => {
      // Create a template first
      await db('whatsapp_templates').insert({
        id: 'template-123',
        tenant_id: tenantId,
        template_name: 'test_template',
        template_language: 'en',
        template_category: 'UTILITY',
        status: 'approved',
        template_components: JSON.stringify({
          body: { text: 'Test template' }
        }),
        active: true
      });

      const response = await request(app)
        .get('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].template_name).toBe('test_template');
    });
  });

  describe('Webhook Endpoints', () => {
    it('should handle Twilio SMS webhook', async () => {
      const twilioPayload = {
        From: '+1234567890',
        Body: 'YES',
        MessageSid: 'SMS123456789'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/sms')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    it('should handle Twilio WhatsApp webhook', async () => {
      const twilioPayload = {
        From: 'whatsapp:+1234567890',
        Body: 'NO',
        MessageSid: 'WA123456789'
      };

      const response = await request(app)
        .post('/api/webhooks/twilio/whatsapp')
        .send(twilioPayload)
        .expect(200);

      expect(response.text).toContain('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    });

    it('should handle SendGrid webhook', async () => {
      const sendGridEvents = [
        {
          event: 'delivered',
          email: 'test@example.com',
          timestamp: Math.floor(Date.now() / 1000),
          sg_message_id: 'EMAIL123456789'
        }
      ];

      const response = await request(app)
        .post('/api/webhooks/sendgrid/events')
        .send(sendGridEvents)
        .expect(200);

      expect(response.body.message).toBe('Events processed');
    });
  });
});