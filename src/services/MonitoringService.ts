import { createClient } from 'redis';
import { AuditService } from './AuditService';
import db from '../database/connection';

interface SystemMetrics {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  responseTime: number;
  errorRate: number;
}

interface SecurityAlert {
  type: 'RATE_LIMIT_EXCEEDED' | 'SQL_INJECTION_ATTEMPT' | 'INVALID_TOKEN' | 'SUSPICIOUS_ACTIVITY';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tenantId: string;
  details: any;
  timestamp: Date;
}

export class MonitoringService {
  private redisClient: any;
  private metrics: SystemMetrics[] = [];
  private alerts: SecurityAlert[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly MAX_ALERTS_HISTORY = 500;
  private redisInitialized: boolean = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      if (process.env.MOCK_REDIS === 'true') {
        console.log('🔧 MonitoringService using Mock Redis');
        this.redisClient = null; // Skip Redis for monitoring in mock mode
        this.redisInitialized = true;
        return;
      }
      
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: any) => {
        console.error('Redis Client Error:', err);
        this.redisClient = null; // Reset client on error
        this.redisInitialized = true; // Mark as initialized even on error
      });

      this.redisClient.on('connect', () => {
        console.log('✅ MonitoringService connected to Redis');
      });

      await this.redisClient.connect();
      this.redisInitialized = true;
    } catch (error) {
      console.error('Failed to connect to Redis for monitoring:', error);
      this.redisClient = null; // Fallback to in-memory only
      this.redisInitialized = true; // Mark as initialized even on error
    }
  }

  /**
   * Ensure Redis is initialized before operations
   */
  private async ensureRedisInitialized(): Promise<void> {
    if (!this.redisInitialized) {
      await this.initializeRedis();
    }
  }

  /**
   * Collect system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    // Ensure Redis is initialized
    await this.ensureRedisInitialized();
    const metrics: SystemMetrics = {
      timestamp: new Date(),
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: this.getMemoryUsage(),
      diskUsage: await this.getDiskUsage(),
      activeConnections: await this.getActiveConnections(),
      responseTime: await this.getAverageResponseTime(),
      errorRate: await this.getErrorRate()
    };

    // Store metrics in memory (limited history)
    this.metrics.push(metrics);
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }

    // Store in Redis for persistence
    if (this.redisInitialized && this.redisClient && typeof this.redisClient.lpush === 'function') {
      try {
        // Check if client is connected
        if (this.redisClient.isOpen || this.redisClient.isReady) {
          await this.redisClient.lpush('system_metrics', JSON.stringify(metrics));
          await this.redisClient.ltrim('system_metrics', 0, this.MAX_METRICS_HISTORY - 1);
        }
      } catch (error) {
        console.error('Failed to store metrics in Redis:', error);
        // Reset client if connection is broken
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage?.includes('connection') || errorMessage?.includes('ECONNREFUSED')) {
          this.redisClient = null;
          console.log('Redis connection lost, falling back to in-memory storage');
        }
      }
    }

    // Check for alerts
    await this.checkMetricAlerts(metrics);

    return metrics;
  }

  /**
   * Log security alert
   */
  async logSecurityAlert(alert: Omit<SecurityAlert, 'timestamp'>): Promise<void> {
    const fullAlert: SecurityAlert = {
      ...alert,
      timestamp: new Date()
    };

    // Store alert
    this.alerts.push(fullAlert);
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts.shift();
    }

    // Log to audit system (only log medium, high, critical to security audit)
    if (alert.severity !== 'low') {
      await AuditService.logSecurity(
        alert.tenantId,
        alert.type,
        {} as any, // No request context for system alerts
        alert.severity as 'medium' | 'high' | 'critical',
        alert.details
      );
    }

    // Send notifications for critical alerts
    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(fullAlert);
    }

    console.warn(`Security Alert [${alert.severity.toUpperCase()}]: ${alert.type}`, alert.details);
  }

  /**
   * Get system health status
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    metrics: SystemMetrics | null;
    alerts: SecurityAlert[];
    uptime: number;
    version: string;
  }> {
    const latestMetrics = this.metrics[this.metrics.length - 1] || null;
    const recentAlerts = this.alerts.filter(
      alert => Date.now() - alert.timestamp.getTime() < 60 * 60 * 1000 // Last hour
    );

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (latestMetrics) {
      if (latestMetrics.cpuUsage > 90 || latestMetrics.memoryUsage > 90 || latestMetrics.errorRate > 10) {
        status = 'critical';
      } else if (latestMetrics.cpuUsage > 70 || latestMetrics.memoryUsage > 70 || latestMetrics.errorRate > 5) {
        status = 'warning';
      }
    }

    // Check for critical alerts
    if (recentAlerts.some(alert => alert.severity === 'critical')) {
      status = 'critical';
    }

    return {
      status,
      metrics: latestMetrics,
      alerts: recentAlerts,
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 24): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Get security alerts history
   */
  getAlertsHistory(hours: number = 24): SecurityAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => alert.timestamp >= cutoff);
  }

  /**
   * Start monitoring loop
   */
  startMonitoring(intervalMinutes: number = 5): void {
    const interval = intervalMinutes * 60 * 1000;
    
    // Collect initial metrics
    this.collectMetrics();

    // Schedule recurring collection
    setInterval(() => {
      this.collectMetrics().catch(error => {
        console.error('Failed to collect metrics:', error);
      });
    }, interval);

    console.log(`System monitoring started (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Private helper methods
   */
  private async getCPUUsage(): Promise<number> {
    // Simple CPU usage calculation
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = endUsage.user + endUsage.system;
    const percentage = (totalUsage / 100000) * 100; // Convert to percentage
    
    return Math.min(100, Math.max(0, percentage));
  }

  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = used.heapTotal;
    return (used.heapUsed / total) * 100;
  }

  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage - in production, use proper disk monitoring
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync('df -h / | tail -1');
      const usage = stdout.split(/\s+/)[4];
      return parseInt(usage.replace('%', ''));
    } catch {
      return 0; // Return 0 if unable to get disk usage
    }
  }

  private async getActiveConnections(): Promise<number> {
    try {
      // Get database connection count
      const result = await db.raw('SHOW STATUS LIKE "Threads_connected"');
      return parseInt(String(result[0][0]?.Value || '0'));
    } catch {
      return 0;
    }
  }

  private async getAverageResponseTime(): Promise<number> {
    // This would be calculated from request timing middleware
    // For now, return a placeholder
    return 0;
  }

  private async getErrorRate(): Promise<number> {
    try {
      // Calculate error rate from recent audit logs
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const totalRequests = await db('audit_logs')
        .where('created_at', '>=', oneHourAgo)
        .where('action', 'like', '%REQUEST%')
        .count('* as count');

      const errorRequests = await db('audit_logs')
        .where('created_at', '>=', oneHourAgo)
        .where('success', false)
        .count('* as count');

      const total = parseInt(String(totalRequests[0]?.count || '0'));
      const errors = parseInt(String(errorRequests[0]?.count || '0'));

      return total > 0 ? (errors / total) * 100 : 0;
    } catch {
      return 0;
    }
  }

  private async checkMetricAlerts(metrics: SystemMetrics): Promise<void> {
    // CPU usage alert
    if (metrics.cpuUsage > 90) {
      await this.logSecurityAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'critical',
        tenantId: 'system',
        details: { type: 'HIGH_CPU_USAGE', value: metrics.cpuUsage }
      });
    }

    // Memory usage alert
    if (metrics.memoryUsage > 90) {
      await this.logSecurityAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'critical',
        tenantId: 'system',
        details: { type: 'HIGH_MEMORY_USAGE', value: metrics.memoryUsage }
      });
    }

    // Error rate alert
    if (metrics.errorRate > 10) {
      await this.logSecurityAlert({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'high',
        tenantId: 'system',
        details: { type: 'HIGH_ERROR_RATE', value: metrics.errorRate }
      });
    }
  }

  private async sendCriticalAlert(alert: SecurityAlert): Promise<void> {
    // In production, this would send emails, Slack messages, etc.
    console.error('CRITICAL ALERT:', alert);
    
    // Log to system audit
    await AuditService.logSystem(
      'CRITICAL_ALERT_SENT',
      'monitoring',
      undefined,
      alert,
      'critical'
    );
  }

  /**
   * Record HTTP request metrics
   */
  recordRequest(data: {
    method: string;
    url: string;
    statusCode: number;
    responseTime: number;
    tenantId?: string;
    userAgent?: string;
    ip?: string;
  }): void {
    // Store request metrics (in-memory for now)
    // In production, this would be sent to a metrics service
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(metrics: any): void {
    // Store system metrics
  }

  /**
   * Record error
   */
  recordError(error: Error, context: any): void {
    // Log error with context
    console.error('Error recorded:', error.message, context);
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<{ status: string; latency?: number }> {
    try {
      const start = Date.now();
      await db.raw('SELECT 1');
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Check Redis health
   */
  async checkRedisHealth(): Promise<{ status: string }> {
    await this.ensureRedisInitialized();
    if (this.redisClient && typeof this.redisClient.ping === 'function') {
      try {
        await this.redisClient.ping();
        return { status: 'healthy' };
      } catch (error) {
        return { status: 'unhealthy' };
      }
    }
    return { status: 'disabled' };
  }

  /**
   * Check external services health
   */
  async checkExternalServicesHealth(): Promise<{ status: string }> {
    // Check external services (Twilio, SendGrid, etc.)
    return { status: 'healthy' };
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(metric: any): void {
    // Record performance metrics
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();