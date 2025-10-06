import { Router, Request, Response } from 'express';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { authenticate } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';
import { validateRequest, validateParams } from '../middleware/validation';
import Joi from 'joi';
import { logger } from '../config/logger';

const router = Router();

// Validation schemas
const createServiceSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  duration_minutes: Joi.number().integer().min(1).max(1440).required(),
  price: Joi.number().min(0).precision(2).required(),
  active: Joi.boolean().optional().default(true)
});

const updateServiceSchema = Joi.object({
  name: Joi.string().optional().min(1).max(255),
  duration_minutes: Joi.number().integer().min(1).max(1440).optional(),
  price: Joi.number().min(0).precision(2).optional(),
  active: Joi.boolean().optional()
});

const serviceIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Get all services for tenant
router.get('/', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    const services = await serviceRepo.findAll();
    
    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get active services for tenant
router.get('/active', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    const services = await serviceRepo.findActive();
    
    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    logger.error('Error fetching active services:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get service by ID
router.get('/:id', authenticate, validateTenantAccess, validateParams(serviceIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    const service = await serviceRepo.findById(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' }
      });
    }
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Create new service
router.post('/', authenticate, validateTenantAccess, validateRequest(createServiceSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    // Check if service name is available
    const isNameAvailable = await serviceRepo.isNameAvailable(req.body.name);
    if (!isNameAvailable) {
      return res.status(400).json({
        success: false,
        error: { message: 'Service name already exists' }
      });
    }
    
    const service = await serviceRepo.create({
      ...req.body,
      tenant_id: decoded.tenantId
    });
    
    res.status(201).json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Update service
router.put('/:id', authenticate, validateTenantAccess, validateRequest(updateServiceSchema), validateParams(serviceIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    // Check if service exists
    const existingService = await serviceRepo.findById(req.params.id);
    if (!existingService) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' }
      });
    }
    
    // Check if name is available (if name is being updated)
    if (req.body.name && req.body.name !== existingService.name) {
      const isNameAvailable = await serviceRepo.isNameAvailable(req.body.name, req.params.id);
      if (!isNameAvailable) {
        return res.status(400).json({
          success: false,
          error: { message: 'Service name already exists' }
        });
      }
    }
    
    const service = await serviceRepo.update(req.params.id, req.body);
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Delete service (soft delete)
router.delete('/:id', authenticate, validateTenantAccess, validateParams(serviceIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    const service = await serviceRepo.deactivate(req.params.id);
    
    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' }
      });
    }
    
    res.json({
      success: true,
      data: service
    });
  } catch (error) {
    logger.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get service statistics
router.get('/:id/stats', authenticate, validateTenantAccess, validateParams(serviceIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const serviceRepo = new ServiceRepository(decoded.tenantId);
    
    // Check if service exists
    const service = await serviceRepo.findById(req.params.id);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: { message: 'Service not found' }
      });
    }
    
    const stats = await serviceRepo.getServiceStats(req.params.id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching service stats:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

export default router;