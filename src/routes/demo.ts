import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin, requireManager } from '../middleware/auth';

const router = Router();

/**
 * GET /demo/public
 * Public endpoint - no authentication required
 */
router.get('/public', (req: Request, res: Response) => {
  res.json({
    message: 'This is a public endpoint',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /demo/protected
 * Protected endpoint - requires authentication
 */
router.get('/protected', authenticate, (req: Request, res: Response) => {
  res.json({
    message: 'This is a protected endpoint',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /demo/admin-only
 * Admin-only endpoint - requires admin role
 */
router.get('/admin-only', authenticate, requireAdmin, (req: Request, res: Response) => {
  res.json({
    message: 'This endpoint is only accessible by admins',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /demo/manager-or-admin
 * Manager/Admin endpoint - requires manager or admin role
 */
router.get('/manager-or-admin', authenticate, requireManager, (req: Request, res: Response) => {
  res.json({
    message: 'This endpoint is accessible by managers and admins',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /demo/tenant-data
 * Demonstrates tenant-scoped data access
 */
router.get('/tenant-data', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.repositories) {
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Repositories not initialized'
      });
    }

    // Example of using tenant-scoped repositories
    const users = await req.repositories.user.findActiveUsers();
    
    res.json({
      message: 'Tenant-scoped data retrieved successfully',
      tenantId: req.tenantId,
      data: {
        activeUsersCount: users.length,
        users: users.map(user => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'DATA_FETCH_FAILED',
      message: 'Failed to retrieve tenant data'
    });
  }
});

export default router;