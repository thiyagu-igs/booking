import { WhatsAppTemplateService } from '../../services/WhatsAppTemplateService';
import { WhatsAppTemplateStatus, WhatsAppTemplateComponents } from '../../models';

describe('WhatsAppTemplateService', () => {
  let templateService: WhatsAppTemplateService;
  let mockDb: any;
  const tenantId = 'tenant-123';

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      insert: jest.fn().mockResolvedValue([1]),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn(),
      orderBy: jest.fn().mockReturnThis(),
      update: jest.fn().mockResolvedValue(1),
      delete: jest.fn().mockResolvedValue(1),
      'whatsapp_templates': jest.fn().mockReturnThis()
    };

    templateService = new WhatsAppTemplateService(mockDb, tenantId);
  });

  describe('createTemplate', () => {
    const validTemplateRequest = {
      templateName: 'waitlist_notification',
      templateLanguage: 'en',
      templateCategory: 'UTILITY' as const,
      templateComponents: {
        body: {
          text: 'Hi {{1}}, a slot is available for {{2}} with {{3}} at {{4}}. Reply YES to confirm or NO to decline.'
        },
        buttons: [
          {
            type: 'QUICK_REPLY' as const,
            text: '✅ Confirm'
          },
          {
            type: 'QUICK_REPLY' as const,
            text: '❌ Decline'
          }
        ]
      }
    };

    it('should create template successfully', async () => {
      const templateId = await templateService.createTemplate(validTemplateRequest);

      expect(templateId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          template_name: 'waitlist_notification',
          template_language: 'en',
          template_category: 'UTILITY',
          status: WhatsAppTemplateStatus.PENDING,
          template_components: validTemplateRequest.templateComponents,
          active: true,
          tenant_id: tenantId
        })
      );
    });
  });

  describe('submitTemplateForApproval', () => {
    const mockTemplate = {
      id: 'template-123',
      tenant_id: tenantId,
      template_name: 'waitlist_notification',
      status: WhatsAppTemplateStatus.PENDING
    };

    it('should submit template for approval successfully', async () => {
      mockDb.first.mockResolvedValue(mockTemplate);

      const result = await templateService.submitTemplateForApproval('template-123');

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('template-123');
      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          submitted_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      );
    });

    it('should fail when template not found', async () => {
      mockDb.first.mockResolvedValue(null);

      const result = await templateService.submitTemplateForApproval('nonexistent-template');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template not found');
    });

    it('should fail when template not in pending status', async () => {
      mockDb.first.mockResolvedValue({
        ...mockTemplate,
        status: WhatsAppTemplateStatus.APPROVED
      });

      const result = await templateService.submitTemplateForApproval('template-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template is not in pending status');
    });
  });

  describe('updateTemplateStatus', () => {
    it('should update template status to approved', async () => {
      await templateService.updateTemplateStatus(
        'template-123',
        WhatsAppTemplateStatus.APPROVED
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WhatsAppTemplateStatus.APPROVED,
          approved_at: expect.any(Date),
          updated_at: expect.any(Date)
        })
      );
    });

    it('should update template status to rejected with reason', async () => {
      await templateService.updateTemplateStatus(
        'template-123',
        WhatsAppTemplateStatus.REJECTED,
        'Template content violates policy'
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WhatsAppTemplateStatus.REJECTED,
          rejection_reason: 'Template content violates policy',
          updated_at: expect.any(Date)
        })
      );
    });
  });

  describe('getTemplates', () => {
    const mockTemplates = [
      {
        id: 'template-1',
        template_name: 'template_1',
        status: WhatsAppTemplateStatus.APPROVED
      },
      {
        id: 'template-2',
        template_name: 'template_2',
        status: WhatsAppTemplateStatus.PENDING
      }
    ];

    it('should get all templates', async () => {
      mockDb.orderBy.mockResolvedValue(mockTemplates);

      const templates = await templateService.getTemplates();

      expect(templates).toEqual(mockTemplates);
      expect(mockDb.where).toHaveBeenCalledWith({ tenant_id: tenantId });
    });

    it('should filter templates by status', async () => {
      const approvedTemplates = [mockTemplates[0]];
      mockDb.orderBy.mockResolvedValue(approvedTemplates);

      const templates = await templateService.getTemplates(WhatsAppTemplateStatus.APPROVED);

      expect(templates).toEqual(approvedTemplates);
      expect(mockDb.where).toHaveBeenCalledWith({ status: WhatsAppTemplateStatus.APPROVED });
    });
  });

  describe('getApprovedTemplate', () => {
    it('should get most recent approved template', async () => {
      const approvedTemplate = {
        id: 'template-123',
        template_name: 'waitlist_notification',
        status: WhatsAppTemplateStatus.APPROVED
      };

      mockDb.first.mockResolvedValue(approvedTemplate);

      const template = await templateService.getApprovedTemplate();

      expect(template).toEqual(approvedTemplate);
      expect(mockDb.where).toHaveBeenCalledWith({
        tenant_id: tenantId,
        status: WhatsAppTemplateStatus.APPROVED,
        active: true
      });
    });

    it('should return null when no approved template exists', async () => {
      mockDb.first.mockResolvedValue(null);

      const template = await templateService.getApprovedTemplate();

      expect(template).toBeNull();
    });
  });

  describe('createDefaultWaitlistTemplate', () => {
    it('should create default waitlist template', async () => {
      const templateId = await templateService.createDefaultWaitlistTemplate();

      expect(templateId).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          template_name: 'waitlist_slot_available',
          template_language: 'en',
          template_category: 'UTILITY',
          template_components: expect.objectContaining({
            header: expect.objectContaining({
              type: 'TEXT',
              text: '🎉 Slot Available at {{1}}'
            }),
            body: expect.objectContaining({
              text: expect.stringContaining('Hi {{1}}, great news!')
            }),
            buttons: expect.arrayContaining([
              expect.objectContaining({
                type: 'QUICK_REPLY',
                text: '✅ Confirm'
              }),
              expect.objectContaining({
                type: 'QUICK_REPLY',
                text: '❌ Decline'
              })
            ])
          })
        })
      );
    });
  });

  describe('validateTemplateComponents', () => {
    it('should validate valid template components', () => {
      const validComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Hello {{1}}, your appointment is confirmed for {{2}}.'
        },
        footer: {
          text: 'Thank you for choosing us!'
        }
      };

      const result = templateService.validateTemplateComponents(validComponents);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject template without body text', () => {
      const invalidComponents = {} as WhatsAppTemplateComponents;

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template body text is required');
    });

    it('should reject body text exceeding character limit', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'A'.repeat(1025) // Exceeds 1024 character limit
        }
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Body text cannot exceed 1024 characters');
    });

    it('should validate header constraints', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Valid body text'
        },
        header: {
          type: 'TEXT',
          text: 'A'.repeat(61) // Exceeds 60 character limit
        }
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Header text is required and cannot exceed 60 characters');
    });

    it('should validate footer constraints', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Valid body text'
        },
        footer: {
          text: 'A'.repeat(61) // Exceeds 60 character limit
        }
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Footer text cannot exceed 60 characters');
    });

    it('should validate button constraints', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Valid body text'
        },
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Button 1'
          },
          {
            type: 'QUICK_REPLY',
            text: 'Button 2'
          },
          {
            type: 'QUICK_REPLY',
            text: 'Button 3'
          },
          {
            type: 'QUICK_REPLY',
            text: 'Button 4' // Exceeds 3 button limit
          }
        ]
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 3 buttons allowed');
    });

    it('should validate button text length', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Valid body text'
        },
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'A'.repeat(26) // Exceeds 25 character limit
          }
        ]
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Button text is required and cannot exceed 25 characters');
    });

    it('should validate button types', () => {
      const invalidComponents: WhatsAppTemplateComponents = {
        body: {
          text: 'Valid body text'
        },
        buttons: [
          {
            type: 'INVALID_TYPE' as any,
            text: 'Button'
          }
        ]
      };

      const result = templateService.validateTemplateComponents(invalidComponents);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Button type must be QUICK_REPLY, URL, or PHONE_NUMBER');
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template successfully', async () => {
      await templateService.deleteTemplate('template-123');

      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalledWith({
        id: 'template-123',
        tenant_id: tenantId
      });
    });
  });

  describe('deactivateTemplate', () => {
    it('should deactivate template successfully', async () => {
      await templateService.deactivateTemplate('template-123');

      expect(mockDb.update).toHaveBeenCalledWith({
        active: false,
        updated_at: expect.any(Date)
      });
    });
  });
});