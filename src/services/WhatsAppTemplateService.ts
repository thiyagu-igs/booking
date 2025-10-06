import { WhatsAppTemplate, WhatsAppTemplateComponents, WhatsAppTemplateStatus } from '../models';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

export interface CreateTemplateRequest {
  templateName: string;
  templateLanguage: string;
  templateCategory: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  templateComponents: WhatsAppTemplateComponents;
}

export interface TemplateSubmissionResult {
  success: boolean;
  templateId: string;
  error?: string;
}

export class WhatsAppTemplateService {
  private db: any;
  private tenantId: string;

  constructor(db: any, tenantId: string) {
    this.db = db;
    this.tenantId = tenantId;
  }

  /**
   * Create a new WhatsApp template
   */
  async createTemplate(request: CreateTemplateRequest): Promise<string> {
    const templateId = uuidv4();
    
    const template: Partial<WhatsAppTemplate> = {
      id: templateId,
      tenant_id: this.tenantId,
      template_name: request.templateName,
      template_language: request.templateLanguage,
      template_category: request.templateCategory,
      status: WhatsAppTemplateStatus.PENDING,
      template_components: request.templateComponents,
      active: true,
      created_at: new Date()
    };

    await this.db('whatsapp_templates').insert(template);
    
    logger.info('WhatsApp template created', {
      templateId,
      templateName: request.templateName,
      tenantId: this.tenantId
    });

    return templateId;
  }

  /**
   * Submit template to Meta for approval (simulated - in real implementation would call Meta API)
   */
  async submitTemplateForApproval(templateId: string): Promise<TemplateSubmissionResult> {
    try {
      const template = await this.getTemplate(templateId);
      if (!template) {
        return {
          success: false,
          templateId,
          error: 'Template not found'
        };
      }

      if (template.status !== WhatsAppTemplateStatus.PENDING) {
        return {
          success: false,
          templateId,
          error: 'Template is not in pending status'
        };
      }

      // In a real implementation, this would call the Meta WhatsApp Business API
      // to submit the template for approval
      // For now, we'll simulate the submission
      
      await this.db('whatsapp_templates')
        .where({ id: templateId, tenant_id: this.tenantId })
        .update({
          submitted_at: new Date(),
          updated_at: new Date()
        });

      logger.info('WhatsApp template submitted for approval', {
        templateId,
        templateName: template.template_name,
        tenantId: this.tenantId
      });

      return {
        success: true,
        templateId
      };

    } catch (error: any) {
      logger.error('Error submitting WhatsApp template', {
        error: error.message,
        templateId,
        tenantId: this.tenantId
      });

      return {
        success: false,
        templateId,
        error: error.message
      };
    }
  }

  /**
   * Update template status (called when Meta approves/rejects)
   */
  async updateTemplateStatus(
    templateId: string, 
    status: WhatsAppTemplateStatus, 
    rejectionReason?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date()
    };

    if (status === WhatsAppTemplateStatus.APPROVED) {
      updateData.approved_at = new Date();
    }

    if (rejectionReason) {
      updateData.rejection_reason = rejectionReason;
    }

    await this.db('whatsapp_templates')
      .where({ id: templateId, tenant_id: this.tenantId })
      .update(updateData);

    logger.info('WhatsApp template status updated', {
      templateId,
      status,
      rejectionReason,
      tenantId: this.tenantId
    });
  }

  /**
   * Get template by ID
   */
  async getTemplate(templateId: string): Promise<WhatsAppTemplate | null> {
    const template = await this.db('whatsapp_templates')
      .where({ id: templateId, tenant_id: this.tenantId })
      .first();

    return template || null;
  }

  /**
   * Get all templates for tenant
   */
  async getTemplates(status?: WhatsAppTemplateStatus): Promise<WhatsAppTemplate[]> {
    let query = this.db('whatsapp_templates')
      .where({ tenant_id: this.tenantId });

    if (status) {
      query = query.where({ status });
    }

    return await query.orderBy('created_at', 'desc');
  }

  /**
   * Get approved template for notifications
   */
  async getApprovedTemplate(): Promise<WhatsAppTemplate | null> {
    const template = await this.db('whatsapp_templates')
      .where({
        tenant_id: this.tenantId,
        status: WhatsAppTemplateStatus.APPROVED,
        active: true
      })
      .orderBy('approved_at', 'desc')
      .first();

    return template || null;
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    await this.db('whatsapp_templates')
      .where({ id: templateId, tenant_id: this.tenantId })
      .delete();

    logger.info('WhatsApp template deleted', {
      templateId,
      tenantId: this.tenantId
    });
  }

  /**
   * Deactivate template
   */
  async deactivateTemplate(templateId: string): Promise<void> {
    await this.db('whatsapp_templates')
      .where({ id: templateId, tenant_id: this.tenantId })
      .update({
        active: false,
        updated_at: new Date()
      });

    logger.info('WhatsApp template deactivated', {
      templateId,
      tenantId: this.tenantId
    });
  }

  /**
   * Create default waitlist notification template
   */
  async createDefaultWaitlistTemplate(): Promise<string> {
    const defaultTemplate: CreateTemplateRequest = {
      templateName: 'waitlist_slot_available',
      templateLanguage: 'en',
      templateCategory: 'UTILITY',
      templateComponents: {
        header: {
          type: 'TEXT',
          text: '🎉 Slot Available at {{1}}'
        },
        body: {
          text: 'Hi {{1}}, great news! A slot has opened up:\n\n📅 {{2}} with {{3}}\n⏰ {{4}}\n\n⚡ Quick action needed (10 min hold):\nReply "YES" to confirm or "NO" to decline.\n\nConfirming removes you from other waitlists. If no response in 10 minutes, we\'ll offer to the next person.',
          example: {
            body_text: [
              ['John', 'Haircut', 'Sarah', 'Monday, January 15, 2024 at 2:00 PM - 3:00 PM PST']
            ]
          }
        },
        footer: {
          text: 'Automated waitlist notification'
        },
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: '✅ Confirm'
          },
          {
            type: 'QUICK_REPLY',
            text: '❌ Decline'
          }
        ]
      }
    };

    return await this.createTemplate(defaultTemplate);
  }

  /**
   * Validate template components structure
   */
  validateTemplateComponents(components: WhatsAppTemplateComponents): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Body is required
    if (!components.body || !components.body.text) {
      errors.push('Template body text is required');
    }

    // Check body text length (WhatsApp limit is 1024 characters)
    if (components.body && components.body.text && components.body.text.length > 1024) {
      errors.push('Body text cannot exceed 1024 characters');
    }

    // Check header if present
    if (components.header) {
      if (!components.header.type || !['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT'].includes(components.header.type)) {
        errors.push('Header type must be TEXT, IMAGE, VIDEO, or DOCUMENT');
      }
      
      if (components.header.type === 'TEXT' && (!components.header.text || components.header.text.length > 60)) {
        errors.push('Header text is required and cannot exceed 60 characters');
      }
    }

    // Check footer if present
    if (components.footer && components.footer.text && components.footer.text.length > 60) {
      errors.push('Footer text cannot exceed 60 characters');
    }

    // Check buttons if present
    if (components.buttons) {
      if (components.buttons.length > 3) {
        errors.push('Maximum 3 buttons allowed');
      }

      for (const button of components.buttons) {
        if (!button.type || !['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(button.type)) {
          errors.push('Button type must be QUICK_REPLY, URL, or PHONE_NUMBER');
        }
        
        if (!button.text || button.text.length > 25) {
          errors.push('Button text is required and cannot exceed 25 characters');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}