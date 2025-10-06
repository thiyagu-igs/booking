import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { AuditService } from '../services/AuditService';
import Joi from 'joi';

const router = express.Router();

// Validation schemas
const auditQuerySchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  action: Joi.string().max(100).optional(),
  resourceType: Joi.string().max(100).optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  success: Joi.boolean().optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

/**
 * GET /api/audit/logs
 * Get audit logs with filtering
 */
router.get('/logs', 
  authenticate,
  requireAdmin,
  validateQuery(auditQuerySchema),
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const filters = {
        userId: req.query.userId as string,
        action: req.query.action as string,
        resourceType: req.query.resourceType as string,
        severity: req.query.severity as string,
        success: req.query.success as boolean,
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        limit: req.query.limit as number,
        offset: req.query.offset as number
      };

      const logs = await AuditService.queryLogs(tenantId, filters);
      
      // Get total count for pagination
      const totalCount = await AuditService.queryLogs(tenantId, {
        ...filters,
        limit: undefined,
        offset: undefined
      });

      res.json({
        logs,
        pagination: {
          total: totalCount.length,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: totalCount.length > (filters.offset || 0) + (filters.limit || 100)
        }
      });
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      res.status(500).json({
        error: 'AUDIT_QUERY_FAILED',
        message: 'Failed to retrieve audit logs'
      });
    }
  }
);

/**
 * GET /api/audit/summary
 * Get audit summary statistics
 */
router.get('/summary',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const hours = parseInt(req.query.hours as string) || 24;
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const logs = await AuditService.queryLogs(tenantId, { startDate });

      const summary = {
        totalEvents: logs.length,
        successfulEvents: logs.filter(log => log.success).length,
        failedEvents: logs.filter(log => !log.success).length,
        severityBreakdown: {
          low: logs.filter(log => log.severity === 'low').length,
          medium: logs.filter(log => log.severity === 'medium').length,
          high: logs.filter(log => log.severity === 'high').length,
          critical: logs.filter(log => log.severity === 'critical').length
        },
        actionBreakdown: logs.reduce((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        resourceBreakdown: logs.reduce((acc, log) => {
          acc[log.resource_type] = (acc[log.resource_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timeRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          hours
        }
      };

      res.json(summary);
    } catch (error) {
      console.error('Failed to get audit summary:', error);
      res.status(500).json({
        error: 'AUDIT_SUMMARY_FAILED',
        message: 'Failed to generate audit summary'
      });
    }
  }
);

/**
 * GET /api/audit/security-events
 * Get security-related audit events
 */
router.get('/security-events',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const hours = parseInt(req.query.hours as string) || 24;
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const securityEvents = await AuditService.queryLogs(tenantId, {
        startDate,
        resourceType: 'security'
      });

      const authEvents = await AuditService.queryLogs(tenantId, {
        startDate,
        resourceType: 'authentication',
        success: false
      });

      const allSecurityEvents = [...securityEvents, ...authEvents]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      res.json({
        events: allSecurityEvents,
        summary: {
          totalSecurityEvents: allSecurityEvents.length,
          criticalEvents: allSecurityEvents.filter(e => e.severity === 'critical').length,
          highSeverityEvents: allSecurityEvents.filter(e => e.severity === 'high').length,
          failedLogins: authEvents.length,
          timeRange: {
            start: startDate.toISOString(),
            end: new Date().toISOString(),
            hours
          }
        }
      });
    } catch (error) {
      console.error('Failed to get security events:', error);
      res.status(500).json({
        error: 'SECURITY_EVENTS_FAILED',
        message: 'Failed to retrieve security events'
      });
    }
  }
);

/**
 * GET /api/audit/user-activity/:userId
 * Get audit logs for a specific user
 */
router.get('/user-activity/:userId',
  authenticate,
  requireAdmin,
  async (req, res) => {
    try {
      const tenantId = req.tenantId!;
      const userId = req.params.userId;
      const hours = parseInt(req.query.hours as string) || 24;
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const userLogs = await AuditService.queryLogs(tenantId, {
        userId,
        startDate,
        limit: 500
      });

      const activity = {
        userId,
        totalActions: userLogs.length,
        successfulActions: userLogs.filter(log => log.success).length,
        failedActions: userLogs.filter(log => !log.success).length,
        lastActivity: userLogs.length > 0 ? userLogs[0].created_at : null,
        actionBreakdown: userLogs.reduce((acc, log) => {
          acc[log.action] = (acc[log.action] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        recentActions: userLogs.slice(0, 20), // Last 20 actions
        timeRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          hours
        }
      };

      res.json(activity);
    } catch (error) {
      console.error('Failed to get user activity:', error);
      res.status(500).json({
        error: 'USER_ACTIVITY_FAILED',
        message: 'Failed to retrieve user activity'
      });
    }
  }
);

export default router;