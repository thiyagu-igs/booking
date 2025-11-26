import { Request } from 'express';
import db from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  actorType: 'user' | 'system' | 'api';
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  success?: boolean;
  errorMessage?: string;
}

export class AuditService {
  /**
   * Log an audit event
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      const auditLog = {
        id: uuidv4(),
        tenant_id: entry.tenantId,
        user_id: entry.userId || null,
        actor_type: entry.actorType,
        actor_id: entry.actorId || null,
        action: entry.action,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId || null,
        old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        new_values: entry.newValues ? JSON.stringify(entry.newValues) : null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        severity: entry.severity || 'low',
        success: entry.success !== false, // Default to true
        error_message: entry.errorMessage || null,
        created_at: new Date()
      };

      await db('audit_logs').insert(auditLog);
    } catch (error) {
      // Don't let audit logging failures break the main application
      console.error('Failed to write audit log:', error);
    }
  }

  /**
   * Log from Express request context
   */
  static async logFromRequest(
    req: Request,
    action: string,
    resourceType: string,
    resourceId?: string,
    oldValues?: any,
    newValues?: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  ): Promise<void> {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId;

    if (!tenantId) {
      console.warn('Cannot log audit event: no tenant context');
      return;
    }

    await this.log({
      tenantId,
      userId: user?.id,
      actorType: user ? 'user' : 'api',
      actorId: user?.id,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      severity,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log authentication events
   */
  static async logAuth(
    tenantId: string,
    userId: string,
    action: 'LOGIN' | 'LOGOUT' | 'LOGIN_FAILED' | 'TOKEN_REFRESH' | 'REGISTER' | 'TOKEN_VALIDATED' | 'TOKEN_VALIDATION_FAILED',
    req: Request,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      actorType: 'user',
      actorId: userId,
      action,
      resourceType: 'authentication',
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      severity: success ? 'low' : 'medium',
      success,
      errorMessage,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log security events
   */
  static async logSecurity(
    tenantId: string,
    action: string,
    req: Request,
    severity: 'medium' | 'high' | 'critical' = 'high',
    details?: any
  ): Promise<void> {
    const user = (req as any).user;

    await this.log({
      tenantId,
      userId: user?.id,
      actorType: user ? 'user' : 'api',
      action,
      resourceType: 'security',
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
      severity,
      success: false,
      metadata: {
        method: req.method,
        url: req.originalUrl,
        details,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log system events
   */
  static async logSystem(
    action: string,
    resourceType: string,
    resourceId?: string,
    details?: any,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
  ): Promise<void> {
    // For system events, we use a default tenant or log without tenant
    await this.log({
      tenantId: 'system', // Special tenant for system events
      actorType: 'system',
      action,
      resourceType,
      resourceId,
      severity,
      metadata: {
        details,
        timestamp: new Date().toISOString(),
        process: process.pid
      }
    });
  }

  /**
   * Get client IP address from request
   */
  private static getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection as any)?.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Query audit logs with filtering
   */
  static async queryLogs(
    tenantId: string,
    filters: {
      userId?: string;
      action?: string;
      resourceType?: string;
      severity?: string;
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<any[]> {
    let query = db('audit_logs')
      .where('tenant_id', tenantId)
      .orderBy('created_at', 'desc');

    if (filters.userId) {
      query = query.where('user_id', filters.userId);
    }

    if (filters.action) {
      query = query.where('action', filters.action);
    }

    if (filters.resourceType) {
      query = query.where('resource_type', filters.resourceType);
    }

    if (filters.severity) {
      query = query.where('severity', filters.severity);
    }

    if (filters.success !== undefined) {
      query = query.where('success', filters.success);
    }

    if (filters.startDate) {
      query = query.where('created_at', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('created_at', '<=', filters.endDate);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    return await query;
  }
}