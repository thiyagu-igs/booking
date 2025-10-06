import request from 'supertest';
import express from 'express';
import { 
  rateLimit, 
  securityHeaders, 
  sanitizeInput, 
  preventSQLInjection,
  csrfProtection,
  limitRequestSize
} from '../../middleware/security';
import { AuditService } from '../../services/AuditService';
import { AuthService } from '../../services/AuthService';

// Mock dependencies
jest.mock('../../services/AuditService');
jest.mock('../../database/connection');

describe('Security Middleware Tests', () => {
  let app: express.Application;
  let authService: AuthService;

  beforeEach(() => {
    app = express();
    authService = new AuthService();
    app.use(express.json());
    
    // Clear mocks
    jest.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      app.use(rateLimit({
        windowMs: 60000,
        maxRequests: 5
      }));
      
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request should succeed
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBe('5');
      expect(response.headers['x-ratelimit-remaining']).toBe('4');
    });

    it('should block requests exceeding limit', async () => {
      app.use(rateLimit({
        windowMs: 60000,
        maxRequests: 1
      }));
      
      app.get('/test', (req, res) => res.json({ success: true }));

      // First request should succeed
      await request(app).get('/test').expect(200);

      // Second request should be rate limited
      const response = await request(app)
        .get('/test')
        .expect(429);

      expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should redirect HTTP to HTTPS in production', async () => {
      process.env.NODE_ENV = 'production';
      
      app.use(securityHeaders);
      app.get('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .get('/test')
        .set('x-forwarded-proto', 'http')
        .set('host', 'example.com')
        .expect(302);

      expect(response.headers.location).toBe('https://example.com/test');
      
      process.env.NODE_ENV = 'test';
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious script tags', async () => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => res.json(req.body));

      const maliciousInput = {
        name: 'John<script>alert("xss")</script>',
        email: 'test@example.com'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.name).toBe('John');
      expect(response.body.email).toBe('test@example.com');
    });

    it('should remove javascript: protocols', async () => {
      app.use(sanitizeInput);
      app.post('/test', (req, res) => res.json(req.body));

      const maliciousInput = {
        url: 'javascript:alert("xss")',
        link: 'https://example.com'
      };

      const response = await request(app)
        .post('/test')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.url).toBe('alert("xss")');
      expect(response.body.link).toBe('https://example.com');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should block SQL injection attempts', async () => {
      app.use(preventSQLInjection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const sqlInjectionAttempts = [
        { query: "'; DROP TABLE users; --" },
        { search: "1' OR '1'='1" },
        { filter: "UNION SELECT * FROM passwords" },
        { id: "1; WAITFOR DELAY '00:00:05'" }
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/test')
          .send(attempt)
          .expect(400);

        expect(response.body.error).toBe('INVALID_INPUT');
        expect(AuditService.logSecurity).toHaveBeenCalledWith(
          'unknown',
          'SQL_INJECTION_ATTEMPT',
          expect.any(Object),
          'critical',
          expect.any(Object)
        );
      }
    });

    it('should allow legitimate queries', async () => {
      app.use(preventSQLInjection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const legitimateInput = {
        name: 'John Doe',
        email: 'john@example.com',
        search: 'hair salon',
        description: 'Looking for a good haircut'
      };

      await request(app)
        .post('/test')
        .send(legitimateInput)
        .expect(200);
    });
  });

  describe('Request Size Limiting', () => {
    it('should block oversized requests', async () => {
      app.use(limitRequestSize(100)); // 100 bytes limit
      app.post('/test', (req, res) => res.json({ success: true }));

      const largePayload = 'x'.repeat(200);

      const response = await request(app)
        .post('/test')
        .set('content-length', '200')
        .send({ data: largePayload })
        .expect(413);

      expect(response.body.error).toBe('REQUEST_TOO_LARGE');
    });

    it('should allow requests within size limit', async () => {
      app.use(limitRequestSize(1000)); // 1KB limit
      app.post('/test', (req, res) => res.json({ success: true }));

      const smallPayload = { message: 'Hello world' };

      await request(app)
        .post('/test')
        .send(smallPayload)
        .expect(200);
    });
  });

  describe('Authentication Security', () => {
    it('should reject invalid JWT tokens', async () => {
      const invalidToken = 'invalid.jwt.token';

      try {
        await authService.verifyToken(invalidToken);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid token');
      }
    });

    it('should reject expired JWT tokens', async () => {
      // Create a token that expires immediately
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMiLCJ0ZW5hbnRJZCI6IjQ1NiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInJvbGUiOiJzdGFmZiIsImV4cCI6MX0.invalid';

      try {
        await authService.verifyToken(expiredToken);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid token');
      }
    });

    it('should validate password strength', () => {
      const weakPasswords = [
        'password',
        '12345678',
        'Password',
        'Password1',
        'pass'
      ];

      const strongPassword = 'MyStr0ng!Password';

      weakPasswords.forEach(password => {
        const result = authService.validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      const strongResult = authService.validatePassword(strongPassword);
      expect(strongResult.valid).toBe(true);
      expect(strongResult.errors.length).toBe(0);
    });
  });

  describe('CSRF Protection', () => {
    beforeEach(() => {
      // Mock session middleware
      app.use((req, res, next) => {
        (req as any).session = { csrfToken: 'valid-csrf-token' };
        next();
      });
    });

    it('should allow GET requests without CSRF token', async () => {
      app.use(csrfProtection);
      app.get('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .get('/test')
        .expect(200);
    });

    it('should block POST requests without CSRF token', async () => {
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      const response = await request(app)
        .post('/test')
        .send({ data: 'test' })
        .expect(403);

      expect(response.body.error).toBe('CSRF_TOKEN_INVALID');
    });

    it('should allow POST requests with valid CSRF token', async () => {
      app.use(csrfProtection);
      app.post('/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/test')
        .send({ _csrf: 'valid-csrf-token', data: 'test' })
        .expect(200);
    });

    it('should allow API requests with JWT token', async () => {
      app.use(csrfProtection);
      app.post('/api/test', (req, res) => res.json({ success: true }));

      await request(app)
        .post('/api/test')
        .set('Authorization', 'Bearer valid-jwt-token')
        .send({ data: 'test' })
        .expect(200);
    });
  });
});

describe('Penetration Testing Scenarios', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(securityHeaders);
    app.use(sanitizeInput);
    app.use(preventSQLInjection);
  });

  describe('Common Attack Vectors', () => {
    it('should prevent XSS attacks', async () => {
      app.post('/test', (req, res) => res.json(req.body));

      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/test')
          .send({ input: payload })
          .expect(200);

        // Should be sanitized
        expect(response.body.input).not.toContain('<script');
        expect(response.body.input).not.toContain('javascript:');
        expect(response.body.input).not.toContain('onerror');
      }
    });

    it('should prevent directory traversal attacks', async () => {
      app.get('/file/:filename', (req, res) => {
        const filename = req.params.filename;
        // In real app, this would serve files - here we just echo back
        res.json({ filename });
      });

      const traversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd'
      ];

      for (const attempt of traversalAttempts) {
        const response = await request(app)
          .get(`/file/${encodeURIComponent(attempt)}`)
          .expect(200);

        // Should not contain traversal sequences
        expect(response.body.filename).not.toContain('../');
        expect(response.body.filename).not.toContain('..\\');
      }
    });

    it('should handle malformed JSON gracefully', async () => {
      app.post('/test', (req, res) => res.json({ received: true }));

      const malformedJson = '{"name": "test", "data": }';

      const response = await request(app)
        .post('/test')
        .set('Content-Type', 'application/json')
        .send(malformedJson)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should prevent header injection', async () => {
      app.get('/redirect', (req, res) => {
        const url = req.query.url as string;
        if (url && url.startsWith('http')) {
          res.redirect(url);
        } else {
          res.json({ error: 'Invalid URL' });
        }
      });

      const headerInjectionAttempts = [
        'http://example.com\r\nSet-Cookie: admin=true',
        'http://example.com\nLocation: http://evil.com',
        'http://example.com%0d%0aSet-Cookie: admin=true'
      ];

      for (const attempt of headerInjectionAttempts) {
        const response = await request(app)
          .get('/redirect')
          .query({ url: attempt });

        // Should not set malicious headers
        expect(response.headers['set-cookie']).toBeUndefined();
        expect(response.headers['location']).not.toContain('evil.com');
      }
    });
  });

  describe('Brute Force Protection', () => {
    it('should implement rate limiting on sensitive endpoints', async () => {
      app.use('/auth', rateLimit({
        windowMs: 60000,
        maxRequests: 3
      }));
      
      app.post('/auth/login', (req, res) => {
        res.json({ success: false, message: 'Invalid credentials' });
      });

      // Make multiple failed login attempts
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/auth/login')
          .send({ email: 'test@example.com', password: 'wrong' })
          .expect(200);
      }

      // Fourth attempt should be rate limited
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(429);

      expect(response.body.error).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});