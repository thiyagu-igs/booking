import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { MonitoringService } from '../services/MonitoringService';

interface MonitoringMetrics {
  requestCount: number;
  responseTime: number[];
  errorCount: number;
  activeConnections: number;
}

class RequestMonitor {
  private metrics: MonitoringMetrics = {
    requestCount: 0,
    responseTime: [],
    errorCount: 0,
    activeConnections: 0
  };

  private monitoringService: MonitoringService;

  constructor() {
    this.monitoringService = new MonitoringService();
    this.startMetricsCollection();
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      this.metrics.activeConnections++;
      this.metrics.requestCount++;

      // Add request ID for tracing
      req.requestId = this.generateRequestId();
      res.setHeader('X-Request-ID', req.requestId);

      // Log request
      logger.info('Incoming request', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        tenantId: req.tenantId
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        this.metrics.responseTime.push(responseTime);
        this.metrics.activeConnections--;
        
        if (res.statusCode >= 400) {
          this.metrics.errorCount++;
        }

        // Log response
        logger.info('Request completed', {
          requestId: req.requestId,
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          tenantId: req.tenantId
        });

        // Send metrics to monitoring service
        this.monitoringService.recordRequest({
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime,
          tenantId: req.tenantId,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });

        // Call original end
        originalEnd.call(this, chunk, encoding);
      }.bind(this);

      next();
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startMetricsCollection() {
    // Collect and reset metrics every minute
    setInterval(() => {
      const currentMetrics = { ...this.metrics };
      
      // Calculate averages
      const avgResponseTime = currentMetrics.responseTime.length > 0
        ? currentMetrics.responseTime.reduce((a, b) => a + b, 0) / currentMetrics.responseTime.length
        : 0;

      // Send to monitoring service
      this.monitoringService.recordSystemMetrics({
        requestCount: currentMetrics.requestCount,
        avgResponseTime,
        errorCount: currentMetrics.errorCount,
        activeConnections: currentMetrics.activeConnections,
        timestamp: new Date()
      });

      // Reset metrics
      this.metrics = {
        requestCount: 0,
        responseTime: [],
        errorCount: 0,
        activeConnections: this.metrics.activeConnections // Keep active connections
      };
    }, 60000);
  }

  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }
}

// Error tracking middleware
export function errorTracking(err: Error, req: Request, res: Response, next: NextFunction) {
  const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log error with context
  logger.error('Application error', {
    errorId,
    requestId: req.requestId,
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query
    },
    user: req.user,
    tenantId: req.tenantId
  });

  // Send to error tracking service (e.g., Sentry)
  const monitoringService = new MonitoringService();
  monitoringService.recordError(err, {
    errorId,
    requestId: req.requestId,
    userId: req.user?.id,
    tenantId: req.tenantId,
    url: req.url,
    method: req.method
  });

  // Return error response
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      errorId,
      ...(process.env.NODE_ENV === 'development' && {
        details: err.message,
        stack: err.stack
      })
    }
  });
}

// Health check middleware
export function healthCheck(req: Request, res: Response) {
  const monitoringService = new MonitoringService();
  
  Promise.all([
    monitoringService.checkDatabaseHealth(),
    monitoringService.checkRedisHealth(),
    monitoringService.checkExternalServicesHealth()
  ]).then(([database, redis, external]) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database,
      redis,
      external,
      version: process.env.npm_package_version || '1.0.0'
    };

    // Determine overall status
    if (!database.healthy || !redis.healthy) {
      health.status = 'unhealthy';
      res.status(503);
    } else if (external.some((service: any) => !service.healthy)) {
      health.status = 'degraded';
    }

    res.json(health);
  }).catch(error => {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  });
}

// Performance monitoring middleware
export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests
    if (duration > 1000) { // Requests taking more than 1 second
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        duration,
        statusCode: res.statusCode,
        tenantId: req.tenantId
      });
    }
    
    // Record performance metrics
    const monitoringService = new MonitoringService();
    monitoringService.recordPerformanceMetric({
      endpoint: `${req.method} ${req.route?.path || req.url}`,
      duration,
      statusCode: res.statusCode,
      tenantId: req.tenantId,
      timestamp: new Date()
    });
  });
  
  next();
}

// Create singleton instance
const requestMonitor = new RequestMonitor();

export { requestMonitor };
export const requestMonitoring = requestMonitor.middleware();