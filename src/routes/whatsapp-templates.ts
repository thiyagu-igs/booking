import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { WhatsAppTemplateService } from '../services/WhatsAppTemplateService';
import { authMiddleware } from '../middleware/auth';
import { WhatsAppTemplateStatus } from '../models';
import { logger } from '../config/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * Get all WhatsApp templates for tenant
 */
router.get('/', [
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'disabled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.query;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    const templates = await templateService.getTemplates(status as WhatsAppTemplateStatus);
    
    res.json({
      success: true,
      data: templates
    });

  } catch (error: any) {
    logger.error('Error fetching WhatsApp templates', {
      error: error.message,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
});

/**
 * Get specific WhatsApp template
 */
router.get('/:templateId', [
  param('templateId').isUUID().withMessage('Valid template ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    const template = await templateService.getTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    res.json({
      success: true,
      data: template
    });

  } catch (error: any) {
    logger.error('Error fetching WhatsApp template', {
      error: error.message,
      templateId: req.params.templateId,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch template'
    });
  }
});

/**
 * Create new WhatsApp template
 */
router.post('/', [
  body('templateName')
    .notEmpty()
    .withMessage('Template name is required')
    .matches(/^[a-z0-9_]+$/)
    .withMessage('Template name must contain only lowercase letters, numbers, and underscores'),
  body('templateLanguage')
    .notEmpty()
    .withMessage('Template language is required')
    .isLength({ min: 2, max: 10 })
    .withMessage('Template language must be 2-10 characters'),
  body('templateCategory')
    .isIn(['MARKETING', 'UTILITY', 'AUTHENTICATION'])
    .withMessage('Template category must be MARKETING, UTILITY, or AUTHENTICATION'),
  body('templateComponents')
    .isObject()
    .withMessage('Template components must be an object'),
  body('templateComponents.body.text')
    .notEmpty()
    .withMessage('Template body text is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateName, templateLanguage, templateCategory, templateComponents } = req.body;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    // Validate template components structure
    const validation = templateService.validateTemplateComponents(templateComponents);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template components',
        details: validation.errors
      });
    }

    // Check if template with same name already exists
    const existingTemplates = await templateService.getTemplates();
    const nameExists = existingTemplates.some(t => 
      t.template_name === templateName && 
      t.template_language === templateLanguage &&
      t.active
    );
    
    if (nameExists) {
      return res.status(409).json({
        success: false,
        error: 'Template with this name and language already exists'
      });
    }
    
    const templateId = await templateService.createTemplate({
      templateName,
      templateLanguage,
      templateCategory,
      templateComponents
    });
    
    res.status(201).json({
      success: true,
      data: {
        templateId,
        message: 'Template created successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error creating WhatsApp template', {
      error: error.message,
      tenantId: req.tenantId,
      templateName: req.body.templateName
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create template'
    });
  }
});

/**
 * Submit template for Meta approval
 */
router.post('/:templateId/submit', [
  param('templateId').isUUID().withMessage('Valid template ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    const result = await templateService.submitTemplateForApproval(templateId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: {
        templateId: result.templateId,
        message: 'Template submitted for approval'
      }
    });

  } catch (error: any) {
    logger.error('Error submitting WhatsApp template', {
      error: error.message,
      templateId: req.params.templateId,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to submit template'
    });
  }
});

/**
 * Update template status (for webhook from Meta)
 */
router.put('/:templateId/status', [
  param('templateId').isUUID().withMessage('Valid template ID is required'),
  body('status')
    .isIn(['pending', 'approved', 'rejected', 'disabled'])
    .withMessage('Status must be pending, approved, rejected, or disabled'),
  body('rejectionReason').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    const { status, rejectionReason } = req.body;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    await templateService.updateTemplateStatus(
      templateId, 
      status as WhatsAppTemplateStatus, 
      rejectionReason
    );
    
    res.json({
      success: true,
      data: {
        templateId,
        status,
        message: 'Template status updated successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error updating WhatsApp template status', {
      error: error.message,
      templateId: req.params.templateId,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to update template status'
    });
  }
});

/**
 * Deactivate template
 */
router.put('/:templateId/deactivate', [
  param('templateId').isUUID().withMessage('Valid template ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    await templateService.deactivateTemplate(templateId);
    
    res.json({
      success: true,
      data: {
        templateId,
        message: 'Template deactivated successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error deactivating WhatsApp template', {
      error: error.message,
      templateId: req.params.templateId,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate template'
    });
  }
});

/**
 * Delete template
 */
router.delete('/:templateId', [
  param('templateId').isUUID().withMessage('Valid template ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    // Check if template exists and is not approved (safety check)
    const template = await templateService.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    if (template.status === WhatsAppTemplateStatus.APPROVED) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete approved template. Deactivate it instead.'
      });
    }
    
    await templateService.deleteTemplate(templateId);
    
    res.json({
      success: true,
      data: {
        templateId,
        message: 'Template deleted successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error deleting WhatsApp template', {
      error: error.message,
      templateId: req.params.templateId,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to delete template'
    });
  }
});

/**
 * Create default waitlist template
 */
router.post('/default/waitlist', async (req, res) => {
  try {
    const templateService = new WhatsAppTemplateService(req.db, req.tenantId);
    
    // Check if default template already exists
    const existingTemplates = await templateService.getTemplates();
    const defaultExists = existingTemplates.some(t => 
      t.template_name === 'waitlist_slot_available' && 
      t.active
    );
    
    if (defaultExists) {
      return res.status(409).json({
        success: false,
        error: 'Default waitlist template already exists'
      });
    }
    
    const templateId = await templateService.createDefaultWaitlistTemplate();
    
    res.status(201).json({
      success: true,
      data: {
        templateId,
        message: 'Default waitlist template created successfully'
      }
    });

  } catch (error: any) {
    logger.error('Error creating default WhatsApp template', {
      error: error.message,
      tenantId: req.tenantId
    });
    res.status(500).json({
      success: false,
      error: 'Failed to create default template'
    });
  }
});

export default router;