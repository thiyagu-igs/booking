import winston from 'winston';
import path from 'path';

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: {
    service: 'waitlist-management',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'app.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // Separate file for errors
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log')
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log')
    })
  ]
});

// Add structured logging methods
export class StructuredLogger {
  static request(requestId: string, method: string, url: string, meta: any = {}) {
    logger.info('HTTP Request', {
      type: 'request',
      requestId,
      method,
      url,
      ...meta
    });
  }

  static response(requestId: string, statusCode: number, responseTime: number, meta: any = {}) {
    logger.info('HTTP Response', {
      type: 'response',
      requestId,
      statusCode,
      responseTime,
      ...meta
    });
  }

  static database(operation: string, table: string, duration: number, meta: any = {}) {
    logger.info('Database Operation', {
      type: 'database',
      operation,
      table,
      duration,
      ...meta
    });
  }

  static notification(type: string, recipient: string, status: string, meta: any = {}) {
    logger.info('Notification', {
      type: 'notification',
      notificationType: type,
      recipient,
      status,
      ...meta
    });
  }

  static business(event: string, tenantId: string, meta: any = {}) {
    logger.info('Business Event', {
      type: 'business',
      event,
      tenantId,
      ...meta
    });
  }

  static security(event: string, severity: 'low' | 'medium' | 'high' | 'critical', meta: any = {}) {
    logger.warn('Security Event', {
      type: 'security',
      event,
      severity,
      ...meta
    });
  }

  static performance(metric: string, value: number, unit: string, meta: any = {}) {
    logger.info('Performance Metric', {
      type: 'performance',
      metric,
      value,
      unit,
      ...meta
    });
  }

  static error(error: Error, context: any = {}) {
    logger.error('Application Error', {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...context
    });
  }
}

// Production logging configuration
if (process.env.NODE_ENV === 'production') {
  // Add external logging services in production
  
  // Example: Add Datadog transport
  if (process.env.DATADOG_API_KEY) {
    const DatadogWinston = require('@datadog/winston');
    logger.add(new DatadogWinston({
      apikey: process.env.DATADOG_API_KEY,
      hostname: process.env.HOSTNAME || 'unknown',
      service: 'waitlist-management',
      ddsource: 'nodejs'
    }));
  }
  
  // Example: Add Elasticsearch transport
  if (process.env.ELASTICSEARCH_URL) {
    const { ElasticsearchTransport } = require('winston-elasticsearch');
    logger.add(new ElasticsearchTransport({
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD
        }
      },
      index: 'waitlist-management-logs'
    }));
  }
}

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}