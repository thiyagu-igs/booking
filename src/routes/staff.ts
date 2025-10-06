import { Router, Request, Response } from 'express';
import { StaffRepository } from '../repositories/StaffRepository';
import { authenticate } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';
import { validateRequest, validateParams } from '../middleware/validation';
import Joi from 'joi';
import { logger } from '../config/logger';

const router = Router();

// Validation schemas
const createStaffSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  role: Joi.string().required().min(1).max(255),
  active: Joi.boolean().optional().default(true)
});

const updateStaffSchema = Joi.object({
  name: Joi.string().optional().min(1).max(255),
  role: Joi.string().optional().min(1).max(255),
  active: Joi.boolean().optional()
});

const staffIdSchema = Joi.object({
  id: Joi.string().uuid().required()
});

// Get all staff for tenant
router.get('/', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    const staff = await staffRepo.findAll();

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error fetching staff:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get active staff for tenant
router.get('/active', authenticate, validateTenantAccess, async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    const staff = await staffRepo.findActive();

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error fetching active staff:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Get staff by ID
router.get('/:id', authenticate, validateTenantAccess, validateParams(staffIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    const staff = await staffRepo.findById(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: { message: 'Staff member not found' }
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error fetching staff member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Create new staff member
router.post('/', authenticate, validateTenantAccess, validateRequest(createStaffSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    const staff = await staffRepo.create({
      ...req.body,
      tenant_id: decoded.tenantId
    });

    res.status(201).json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error creating staff member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Update staff member
router.put('/:id', authenticate, validateTenantAccess, validateRequest(updateStaffSchema), validateParams(staffIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    // Check if staff member exists
    const existingStaff = await staffRepo.findById(req.params.id);
    if (!existingStaff) {
      return res.status(404).json({
        success: false,
        error: { message: 'Staff member not found' }
      });
    }

    const staff = await staffRepo.update(req.params.id, req.body);

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error updating staff member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

// Delete staff member (soft delete)
router.delete('/:id', authenticate, validateTenantAccess, validateParams(staffIdSchema), async (req: Request, res: Response) => {
  try {
    const decoded = req.user as any;
    const staffRepo = new StaffRepository(decoded.tenantId);

    const staff = await staffRepo.deactivate(req.params.id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        error: { message: 'Staff member not found' }
      });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    logger.error('Error deleting staff member:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
});

export default router;