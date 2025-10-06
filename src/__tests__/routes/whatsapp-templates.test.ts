import request from 'supertest';
import { app } from '../../index';
import db from '../../database/connection';
import jwt from 'jsonwebtoken';

describe('WhatsApp Templates Routes', () => {
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
  });

  beforeEach(async () => {
    // Clean up database
    await db('whatsapp_templates').del();
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

  describe('GET /api/whatsapp-templates', () => {
    beforeEach(async () => {
      // Create test templates
      await db('whatsapp_templates').insert([
        {
          id: 'template-1',
          tenant_id: tenantId,
          template_name: 'waitlist_notification',
          template_language: 'en',
          template_category: 'UTILITY',
          status: 'approved',
          template_components: JSON.stringify({
            body: { text: 'Test template 1' }
          }),
          active: true
        },
        {
          id: 'template-2',
          tenant_id: tenantId,
          template_name: 'booking_confirmation',
          template_language: 'en',
          template_category: 'UTILITY',
          status: 'pending',
          template_components: JSON.stringify({
            body: { text: 'Test template 2' }
          }),
          active: true
        }
      ]);
    });

    it('should get all templates', async () => {
      const response = await request(app)
        .get('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].template_name).toBe('booking_confirmation'); // Ordered by created_at desc
    });

    it('should filter templates by status', async () => {
      const response = await request(app)
        .get('/api/whatsapp-templates?status=approved')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('approved');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/whatsapp-templates')
        .expect(401);
    });

    it('should validate status filter', async () => {
      await request(app)
        .get('/api/whatsapp-templates?status=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/whatsapp-templates/:templateId', () => {
    let templateId: string;

    beforeEach(async () => {
      templateId = 'template-123';
      await db('whatsapp_templates').insert({
        id: templateId,
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
    });

    it('should get specific template', async () => {
      const response = await request(app)
        .get(`/api/whatsapp-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(templateId);
      expect(response.body.data.template_name).toBe('test_template');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/whatsapp-templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Template not found');
    });

    it('should validate UUID format', async () => {
      await request(app)
        .get('/api/whatsapp-templates/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /api/whatsapp-templates', () => {
    const validTemplateData = {
      templateName: 'new_waitlist_template',
      templateLanguage: 'en',
      templateCategory: 'UTILITY',
      templateComponents: {
        body: {
          text: 'Hi {{1}}, a slot is available for {{2}}. Reply YES to confirm.'
        },
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: '✅ Confirm'
          }
        ]
      }
    };

    it('should create template successfully', async () => {
      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTemplateData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templateId).toBeDefined();

      // Verify template was created in database
      const template = await db('whatsapp_templates')
        .where({ template_name: 'new_waitlist_template' })
        .first();
      expect(template).toBeTruthy();
      expect(template.status).toBe('pending');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        templateName: '', // Empty name
        templateLanguage: 'en',
        templateCategory: 'UTILITY'
        // Missing templateComponents
      };

      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate template name format', async () => {
      const invalidData = {
        ...validTemplateData,
        templateName: 'Invalid Name With Spaces' // Should be lowercase with underscores
      };

      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate template category', async () => {
      const invalidData = {
        ...validTemplateData,
        templateCategory: 'INVALID_CATEGORY'
      };

      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should validate template components structure', async () => {
      const invalidData = {
        ...validTemplateData,
        templateComponents: {
          body: {
            text: 'A'.repeat(1025) // Exceeds character limit
          }
        }
      };

      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Invalid template components');
      expect(response.body.details).toContain('Body text cannot exceed 1024 characters');
    });

    it('should prevent duplicate template names', async () => {
      // Create first template
      await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTemplateData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/whatsapp-templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validTemplateData)
        .expect(409);

      expect(response.body.error).toBe('Template with this name and language already exists');
    });
  });

  describe('POST /api/whatsapp-templates/:templateId/submit', () => {
    let templateId: string;

    beforeEach(async () => {
      templateId = 'template-123';
      await db('whatsapp_templates').insert({
        id: templateId,
        tenant_id: tenantId,
        template_name: 'test_template',
        template_language: 'en',
        template_category: 'UTILITY',
        status: 'pending',
        template_components: JSON.stringify({
          body: { text: 'Test template' }
        }),
        active: true
      });
    });

    it('should submit template for approval', async () => {
      const response = await request(app)
        .post(`/api/whatsapp-templates/${templateId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templateId).toBe(templateId);

      // Verify submitted_at was set
      const template = await db('whatsapp_templates').where({ id: templateId }).first();
      expect(template.submitted_at).toBeTruthy();
    });

    it('should fail for non-existent template', async () => {
      const response = await request(app)
        .post('/api/whatsapp-templates/non-existent-id/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Template not found');
    });

    it('should fail for non-pending template', async () => {
      // Update template to approved status
      await db('whatsapp_templates').where({ id: templateId }).update({ status: 'approved' });

      const response = await request(app)
        .post(`/api/whatsapp-templates/${templateId}/submit`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Template is not in pending status');
    });
  });

  describe('PUT /api/whatsapp-templates/:templateId/status', () => {
    let templateId: string;

    beforeEach(async () => {
      templateId = 'template-123';
      await db('whatsapp_templates').insert({
        id: templateId,
        tenant_id: tenantId,
        template_name: 'test_template',
        template_language: 'en',
        template_category: 'UTILITY',
        status: 'pending',
        template_components: JSON.stringify({
          body: { text: 'Test template' }
        }),
        active: true
      });
    });

    it('should update template status to approved', async () => {
      const response = await request(app)
        .put(`/api/whatsapp-templates/${templateId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'approved' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('approved');

      // Verify status was updated
      const template = await db('whatsapp_templates').where({ id: templateId }).first();
      expect(template.status).toBe('approved');
      expect(template.approved_at).toBeTruthy();
    });

    it('should update template status to rejected with reason', async () => {
      const response = await request(app)
        .put(`/api/whatsapp-templates/${templateId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          status: 'rejected',
          rejectionReason: 'Template violates policy'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify rejection reason was saved
      const template = await db('whatsapp_templates').where({ id: templateId }).first();
      expect(template.status).toBe('rejected');
      expect(template.rejection_reason).toBe('Template violates policy');
    });

    it('should validate status values', async () => {
      await request(app)
        .put(`/api/whatsapp-templates/${templateId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'invalid_status' })
        .expect(400);
    });
  });

  describe('PUT /api/whatsapp-templates/:templateId/deactivate', () => {
    let templateId: string;

    beforeEach(async () => {
      templateId = 'template-123';
      await db('whatsapp_templates').insert({
        id: templateId,
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
    });

    it('should deactivate template', async () => {
      const response = await request(app)
        .put(`/api/whatsapp-templates/${templateId}/deactivate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify template was deactivated
      const template = await db('whatsapp_templates').where({ id: templateId }).first();
      expect(template.active).toBe(false);
    });
  });

  describe('DELETE /api/whatsapp-templates/:templateId', () => {
    let templateId: string;

    beforeEach(async () => {
      templateId = 'template-123';
      await db('whatsapp_templates').insert({
        id: templateId,
        tenant_id: tenantId,
        template_name: 'test_template',
        template_language: 'en',
        template_category: 'UTILITY',
        status: 'pending',
        template_components: JSON.stringify({
          body: { text: 'Test template' }
        }),
        active: true
      });
    });

    it('should delete pending template', async () => {
      const response = await request(app)
        .delete(`/api/whatsapp-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify template was deleted
      const template = await db('whatsapp_templates').where({ id: templateId }).first();
      expect(template).toBeFalsy();
    });

    it('should prevent deletion of approved template', async () => {
      // Update template to approved
      await db('whatsapp_templates').where({ id: templateId }).update({ status: 'approved' });

      const response = await request(app)
        .delete(`/api/whatsapp-templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.error).toBe('Cannot delete approved template. Deactivate it instead.');
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .delete('/api/whatsapp-templates/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.error).toBe('Template not found');
    });
  });

  describe('POST /api/whatsapp-templates/default/waitlist', () => {
    it('should create default waitlist template', async () => {
      const response = await request(app)
        .post('/api/whatsapp-templates/default/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.templateId).toBeDefined();

      // Verify default template was created
      const template = await db('whatsapp_templates')
        .where({ template_name: 'waitlist_slot_available' })
        .first();
      expect(template).toBeTruthy();
      expect(template.template_category).toBe('UTILITY');
    });

    it('should prevent creating duplicate default template', async () => {
      // Create first default template
      await request(app)
        .post('/api/whatsapp-templates/default/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Try to create another
      const response = await request(app)
        .post('/api/whatsapp-templates/default/waitlist')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(409);

      expect(response.body.error).toBe('Default waitlist template already exists');
    });
  });
});