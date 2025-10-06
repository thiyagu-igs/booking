import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate tenant access and set tenant context
 * This middleware should be used after authentication middleware
 */
export const validateTenantAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get tenant ID from authenticated user
    const user = (req as any).user;
    
    if (!user || !user.tenantId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Valid tenant context not found'
      });
    }

    // Set tenant ID in request for use by other middleware/routes
    (req as any).tenantId = user.tenantId;
    
    next();
  } catch (error) {
    console.error('Tenant validation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate tenant access'
    });
  }
};

/**
 * Middleware to validate admin access for tenant management operations
 */
export const validateAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    
    if (!user || !user.role || user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Admin access required'
      });
    }
    
    next();
  } catch (error) {
    console.error('Admin validation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate admin access'
    });
  }
};

// Alias for backward compatibility
export const validateTenant = validateTenantAccess;