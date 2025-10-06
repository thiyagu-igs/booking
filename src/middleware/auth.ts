import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/AuthService';
import { UserRepository } from '../repositories/UserRepository';
import { TenantRepository } from '../repositories/TenantRepository';
import { AuditService } from '../services/AuditService';

// Extend Express Request interface to include auth data
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      tenantId?: string;
      repositories?: {
        user: UserRepository;
        tenant: TenantRepository;
        [key: string]: any;
      };
    }
  }
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Middleware to authenticate JWT token and set user context
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({ 
          error: 'UNAUTHORIZED',
          message: 'Authorization header is required' 
        });
        return;
      }

      const token = this.extractToken(authHeader);
      if (!token) {
        res.status(401).json({ 
          error: 'UNAUTHORIZED',
          message: 'Invalid authorization header format' 
        });
        return;
      }

      // Verify token
      const payload = await this.authService.verifyToken(token);
      
      // Set user context
      req.user = payload;
      req.tenantId = payload.tenantId;

      // Initialize tenant-scoped repositories
      req.repositories = {
        user: new UserRepository(payload.tenantId),
        tenant: new TenantRepository(payload.tenantId)
      };

      // Log successful authentication
      await AuditService.logAuth(
        payload.tenantId,
        payload.id,
        'TOKEN_VALIDATED',
        req,
        true
      );

      next();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed';
      
      // Log failed authentication attempt
      const authHeader = req.headers.authorization;
      if (authHeader) {
        try {
          // Try to extract tenant info from token without verification for logging
          const token = this.extractToken(authHeader);
          if (token) {
            const decoded = this.authService.decodeTokenUnsafe(token);
            if (decoded?.tenantId) {
              await AuditService.logAuth(
                decoded.tenantId,
                decoded.id || 'unknown',
                'TOKEN_VALIDATION_FAILED',
                req,
                false,
                message
              );
            }
          }
        } catch {
          // If we can't decode the token, log as security event
          await AuditService.logSecurity(
            'unknown',
            'INVALID_TOKEN_FORMAT',
            req,
            'medium',
            { error: message }
          );
        }
      }

      res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message 
      });
    }
  };

  /**
   * Middleware to check if user has required role
   */
  requireRole = (roles: string | string[]) => {
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ 
          error: 'UNAUTHORIZED',
          message: 'Authentication required' 
        });
        return;
      }

      if (!requiredRoles.includes(req.user.role)) {
        res.status(403).json({ 
          error: 'FORBIDDEN',
          message: `Access denied. Required role: ${requiredRoles.join(' or ')}` 
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to check if user is admin
   */
  requireAdmin = this.requireRole('admin');

  /**
   * Middleware to check if user is admin or manager
   */
  requireManager = this.requireRole(['admin', 'manager']);

  /**
   * Optional authentication - sets user context if token is provided but doesn't fail if missing
   */
  optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        next();
        return;
      }

      const token = this.extractToken(authHeader);
      if (!token) {
        next();
        return;
      }

      // Verify token
      const payload = await this.authService.verifyToken(token);
      
      // Set user context
      req.user = payload;
      req.tenantId = payload.tenantId;

      // Initialize tenant-scoped repositories
      req.repositories = {
        user: new UserRepository(payload.tenantId),
        tenant: new TenantRepository(payload.tenantId)
      };

      next();
    } catch (error) {
      // For optional auth, we don't fail on invalid tokens
      next();
    }
  };

  /**
   * Extract token from Authorization header
   */
  private extractToken(authHeader: string): string | null {
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }
    
    return parts[1];
  }
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();

// Export individual middleware functions for convenience
export const authenticate = authMiddleware.authenticate;
export const requireRole = authMiddleware.requireRole;
export const requireAdmin = authMiddleware.requireAdmin;
export const requireManager = authMiddleware.requireManager;
export const optionalAuth = authMiddleware.optionalAuth;