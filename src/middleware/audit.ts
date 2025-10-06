import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService';

/**
 * Middleware to automatically log state changes
 */
export const auditMiddleware = (
  action: string,
  resourceType: string,
  options: {
    getResourceId?: (req: Request) => string;
    getOldValues?: (req: Request) => any;
    getNewValues?: (req: Request, res: Response) => any;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    skipIf?: (req: Request) => boolean;
  } = {}
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip if condition is met
    if (options.skipIf && options.skipIf(req)) {
      return next();
    }

    // Store original res.json to intercept response
    const originalJson = res.json;
    let responseData: any;

    res.json = function(data: any) {
      responseData = data;
      return originalJson.call(this, data);
    };

    // Store original res.end to capture when response is sent
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      // Log the audit event after response is sent
      setImmediate(async () => {
        try {
          const resourceId = options.getResourceId ? options.getResourceId(req) : undefined;
          const oldValues = options.getOldValues ? options.getOldValues(req) : undefined;
          const newValues = options.getNewValues ? options.getNewValues(req, res) : responseData;

          await AuditService.logFromRequest(
            req,
            action,
            resourceType,
            resourceId,
            oldValues,
            newValues,
            options.severity || 'low'
          );
        } catch (error) {
          console.error('Failed to log audit event:', error);
        }
      });

      return originalEnd.apply(this, args);
    };

    next();
  };
};

/**
 * Middleware to log CRUD operations
 */
export const auditCRUD = (resourceType: string) => ({
  create: auditMiddleware('CREATE', resourceType, {
    getResourceId: (req) => req.body?.id,
    getNewValues: (req) => req.body,
    severity: 'low'
  }),

  read: auditMiddleware('READ', resourceType, {
    getResourceId: (req) => req.params.id,
    severity: 'low',
    skipIf: (req) => req.method === 'GET' && !req.params.id // Skip list operations
  }),

  update: auditMiddleware('UPDATE', resourceType, {
    getResourceId: (req) => req.params.id,
    getOldValues: (req) => (req as any).originalData, // Set by route handler
    getNewValues: (req) => req.body,
    severity: 'low'
  }),

  delete: auditMiddleware('DELETE', resourceType, {
    getResourceId: (req) => req.params.id,
    getOldValues: (req) => (req as any).originalData, // Set by route handler
    severity: 'medium'
  })
});

/**
 * Middleware to store original data before updates/deletes
 */
export const storeOriginalData = (getOriginalData: (req: Request) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      (req as any).originalData = await getOriginalData(req);
      next();
    } catch (error) {
      console.error('Failed to store original data for audit:', error);
      next(); // Continue without original data
    }
  };
};

/**
 * Middleware to log authentication events
 */
export const auditAuth = (action: 'LOGIN' | 'LOGOUT' | 'REGISTER') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Log auth event after successful response
      setImmediate(async () => {
        try {
          const success = res.statusCode < 400;
          const tenantId = req.body?.tenantId || (req as any).tenantId || 'unknown';
          const userId = data?.user?.id || req.body?.email || 'unknown';

          await AuditService.logAuth(
            tenantId,
            userId,
            action,
            req,
            success,
            success ? undefined : data?.message
          );
        } catch (error) {
          console.error('Failed to log auth event:', error);
        }
      });

      return originalJson.call(this, data);
    };

    next();
  };
};

/**
 * Middleware to log security events
 */
export const auditSecurity = (action: string, severity: 'medium' | 'high' | 'critical' = 'high') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = (req as any).tenantId || 'unknown';
    
    await AuditService.logSecurity(
      tenantId,
      action,
      req,
      severity,
      {
        body: req.body,
        query: req.query,
        params: req.params
      }
    );

    next();
  };
};