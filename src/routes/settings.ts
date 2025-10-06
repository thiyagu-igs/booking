import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import { logger } from '../config/logger';

const router = Router();

// Validation schemas
const businessHoursSchema = Joi.object({
  monday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  tuesday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  wednesday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  thursday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  friday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  saturday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required(),
  sunday: Joi.object({
    isOpen: Joi.boolean().required(),
    openTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() }),
    closeTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).when('isOpen', { is: true, then: Joi.required() })
  }).required()
});

const emailTemplatesSchema = Joi.object().pattern(
  Joi.string(),
  Joi.object({
    type: Joi.string().valid('notification', 'confirmation', 'reminder').required(),
    subject: Joi.string().required(),
    htmlContent: Joi.string().required(),
    textContent: Joi.string().required()
  })
);

// Get business hours
router.get('/business-hours', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    
    // Check if business hours exist in database
    const existingHours = await req.app.locals.db('business_hours')
      .where({ tenant_id: decoded.tenantId })
      .first();
    
    if (existingHours) {
      // Parse the stored JSON data
      const hours = JSON.parse(existingHours.hours_data);
      res.json({
        success: true,
        data: hours
      });
    } else {
      // Return default business hours
      const defaultHours = {
        monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        saturday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
        sunday: { isOpen: false, openTime: '09:00', closeTime: '17:00' }
      };
      
      res.json({
        success: true,
        data: defaultHours
      });
    }
  } catch (error) {
    logger.error('Error fetching business hours:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Update business hours
router.put('/business-hours', authenticate, validateTenantAccess, validateRequest(businessHoursSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const hoursData = JSON.stringify(req.body);
    
    // Check if business hours already exist
    const existingHours = await req.app.locals.db('business_hours')
      .where({ tenant_id: decoded.tenantId })
      .first();
    
    if (existingHours) {
      // Update existing hours
      await req.app.locals.db('business_hours')
        .where({ tenant_id: decoded.tenantId })
        .update({
          hours_data: hoursData,
          updated_at: new Date()
        });
    } else {
      // Create new hours record
      await req.app.locals.db('business_hours')
        .insert({
          tenant_id: decoded.tenantId,
          hours_data: hoursData
        });
    }
    
    res.json({
      success: true,
      data: req.body
    });
  } catch (error) {
    logger.error('Error updating business hours:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get email templates
router.get('/email-templates', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    
    // Check if email templates exist in database
    const existingTemplates = await req.app.locals.db('email_templates')
      .where({ tenant_id: decoded.tenantId })
      .first();
    
    if (existingTemplates) {
      // Parse the stored JSON data
      const templates = JSON.parse(existingTemplates.templates_data);
      res.json({
        success: true,
        data: templates
      });
    } else {
      // Return empty object - frontend will use defaults
      res.json({
        success: true,
        data: {}
      });
    }
  } catch (error) {
    logger.error('Error fetching email templates:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Update email templates
router.put('/email-templates', authenticate, validateTenantAccess, validateRequest(emailTemplatesSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const templatesData = JSON.stringify(req.body);
    
    // Check if email templates already exist
    const existingTemplates = await req.app.locals.db('email_templates')
      .where({ tenant_id: decoded.tenantId })
      .first();
    
    if (existingTemplates) {
      // Update existing templates
      await req.app.locals.db('email_templates')
        .where({ tenant_id: decoded.tenantId })
        .update({
          templates_data: templatesData,
          updated_at: new Date()
        });
    } else {
      // Create new templates record
      await req.app.locals.db('email_templates')
        .insert({
          tenant_id: decoded.tenantId,
          templates_data: templatesData
        });
    }
    
    res.json({
      success: true,
      data: req.body
    });
  } catch (error) {
    logger.error('Error updating email templates:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

export default router;