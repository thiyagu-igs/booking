import { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { AuditService } from '../services/AuditService';

// Redis client for rate limiting
let redisClient: any = null;

// Initialize Redis client for rate limiting
export const initializeRateLimiting = async () => {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    console.log('Rate limiting Redis client connected');
  } catch (error) {
    console.error('Failed to connect to Redis for rate limiting:', error);
  }
};

/**
 * Rate limiting middleware
 */
export const rateLimit = (options: {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!redisClient) {
      // If Redis is not available, log and continue without rate limiting
      console.warn('Rate limiting disabled: Redis not available');
      return next();
    }

    try {
      const key = options.keyGenerator 
        ? options.keyGenerator(req)
        : `rate_limit:${getClientIP(req)}:${req.route?.path || req.path}`;

      const current = await redisClient.incr(key);
      
      if (current === 1) {
        // First request in window, set expiration
        await redisClient.expire(key, Math.ceil(options.windowMs / 1000));
      }

      if (current > options.maxRequests) {
        // Rate limit exceeded
        const tenantId = (req as any).tenantId || 'unknown';
        
        await AuditService.logSecurity(
          tenantId,
          'RATE_LIMIT_EXCEEDED',
          req,
          'medium',
          {
            limit: options.maxRequests,
            current,
            windowMs: options.windowMs
          }
        );

        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: Math.ceil(options.windowMs / 1000)
        });
        return;
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, options.maxRequests - current).toString(),
        'X-RateLimit-Reset': new Date(Date.now() + options.windowMs).toISOString()
      });

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
};

/**
 * API rate limiting - general API endpoints
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 requests per 15 minutes per IP
  keyGenerator: (req) => `api:${getClientIP(req)}`
});

/**
 * Authentication rate limiting - stricter for auth endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 auth attempts per 15 minutes per IP
  keyGenerator: (req) => `auth:${getClientIP(req)}`
});

/**
 * Notification rate limiting - per tenant
 */
export const notificationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 25, // 25 notifications per hour per tenant
  keyGenerator: (req) => `notifications:${(req as any).tenantId || 'unknown'}`
});

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // HTTPS enforcement in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }

  // Security headers
  res.set({
    // Prevent clickjacking
    'X-Frame-Options': 'DENY',
    
    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',
    
    // XSS protection
    'X-XSS-Protection': '1; mode=block',
    
    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    
    // Content Security Policy
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Allow inline scripts for React
      "style-src 'self' 'unsafe-inline'", // Allow inline styles for Tailwind
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.sendgrid.com https://accounts.google.com",
      "frame-ancestors 'none'"
    ].join('; '),
    
    // HSTS (HTTP Strict Transport Security)
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    
    // Permissions Policy
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()'
    ].join(', ')
  });

  next();
};

/**
 * Input sanitization middleware
 */
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * SQL injection prevention middleware
 */
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*?[=<>]/i,
    /\b(WAITFOR|DELAY)\b/i
  ];

  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlInjectionPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkForSQLInjection);
    }
    return false;
  };

  // Check body, query, and params
  const suspicious = [
    ...(req.body ? Object.values(req.body) : []),
    ...(req.query ? Object.values(req.query) : []),
    ...(req.params ? Object.values(req.params) : [])
  ].some(checkForSQLInjection);

  if (suspicious) {
    const tenantId = (req as any).tenantId || 'unknown';
    
    AuditService.logSecurity(
      tenantId,
      'SQL_INJECTION_ATTEMPT',
      req,
      'critical',
      {
        body: req.body,
        query: req.query,
        params: req.params
      }
    );

    res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'Request contains invalid characters'
    });
    return;
  }

  next();
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API endpoints with valid JWT (stateless)
  if (req.path.startsWith('/api/') && req.headers.authorization) {
    return next();
  }

  // For form submissions, check CSRF token
  const token = req.body._csrf || req.headers['x-csrf-token'];
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    const tenantId = (req as any).tenantId || 'unknown';
    
    AuditService.logSecurity(
      tenantId,
      'CSRF_TOKEN_MISMATCH',
      req,
      'high',
      {
        providedToken: token,
        expectedToken: sessionToken
      }
    );

    res.status(403).json({
      error: 'CSRF_TOKEN_INVALID',
      message: 'Invalid CSRF token'
    });
    return;
  }

  next();
};

/**
 * Request size limiting middleware
 */
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    
    if (contentLength > maxSize) {
      const tenantId = (req as any).tenantId || 'unknown';
      
      AuditService.logSecurity(
        tenantId,
        'REQUEST_SIZE_EXCEEDED',
        req,
        'medium',
        {
          contentLength,
          maxSize
        }
      );

      res.status(413).json({
        error: 'REQUEST_TOO_LARGE',
        message: 'Request size exceeds limit'
      });
      return;
    }

    next();
  };
};

/**
 * Utility functions
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as any)?.socket?.remoteAddress ||
    'unknown'
  );
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}