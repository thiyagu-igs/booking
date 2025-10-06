import request from 'supertest';
import express from 'express';
import publicRoutes from '../../routes/public';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { TenantRepository } from '../../repositories/TenantRepository';

// Mock repositories
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../repositories/TenantRepository');

const app = express();
app.use(express.json());

// Mock Redis
const mockRedis = {
  setex: jest.fn(),
  get: jest.fn(),
  del: jest.fn()
};
app.locals.redis = mockRedis;

app.use('/api/public', publicRoutes);

describe('Public API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/public/business/:tenantId', () => {
    it('should return business information', async () => {
      const mockBusiness = {
        id: 'tenant-1',
        name: 'Test Business',
        description: 'A test business',
        address: '123 Test St',
        phone: '+1234567890',
        hours: '9 AM - 5 PM',
        rating: 4.5,
        logo_url: 'https://example.com/logo.png'
      };

      (TenantRepository as jest.Mock).mockImplementation(() => ({
        findById: jest.fn().mockResolvedValue(mockBusiness)
      }));

      const response = await request(app)
        .get('/api/public/business/tenant-1')
        .expect(200);

      expect(response.body).toEqual({
        id: 'tenant-1',
        name: 'Test Business',
        description: 'A test business',
        address: '123 Test St',
        phone: '+1234567890',
        hours: '9 AM - 5 PM',
        rating: 4.5,
        logo: 'https://example.com/logo.png'
      });
    });

    it('should return 404 for non-existent business', async () => {
      (TenantRepository as jest.Mock).mockImplementation(() => ({
        findById: jest.fn().mockResolvedValue(null)
      }));

      const response = await request(app)
        .get('/api/public/business/non-existent')
        .expect(404);

      expect(response.body.error.message).toBe('Business not found');
    });
  });

  describe('GET /api/public/services', () => {
    it('should return services for a tenant', async () => {
      const mockServices = [
        { id: '1', name: 'Haircut', duration_minutes: 30, price: 50, active: true },
        { id: '2', name: 'Color', duration_minutes: 90, price: 120, active: true }
      ];

      (ServiceRepository as jest.Mock).mockImplementation(() => ({
        findAll: jest.fn().mockResolvedValue(mockServices)
      }));

      const response = await request(app)
        .get('/api/public/services?tenant_id=tenant-1')
        .expect(200);

      expect(response.body).toEqual(mockServices);
    });

    it('should require tenant_id parameter', async () => {
      const response = await request(app)
        .get('/api/public/services')
        .expect(400);

      expect(response.body.error.message).toBe('tenant_id is required');
    });
  });

  describe('POST /api/public/send-otp', () => {
    it('should send OTP successfully', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      const response = await request(app)
        .post('/api/public/send-otp')
        .send({
          tenant_id: 'tenant-1',
          phone: '+1234567890'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'otp:tenant-1:+1234567890',
        300,
        expect.any(String)
      );
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/public/send-otp')
        .send({
          tenant_id: 'invalid-uuid',
          phone: '123'
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/public/verify-otp', () => {
    it('should verify OTP successfully', async () => {
      mockRedis.get.mockResolvedValue('123456');
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/public/verify-otp')
        .send({
          tenant_id: 'tenant-1',
          phone: '+1234567890',
          otp_code: '123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockRedis.del).toHaveBeenCalledWith('otp:tenant-1:+1234567890');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'verified:tenant-1:+1234567890',
        3600,
        'true'
      );
    });

    it('should reject invalid OTP', async () => {
      mockRedis.get.mockResolvedValue('654321');

      const response = await request(app)
        .post('/api/public/verify-otp')
        .send({
          tenant_id: 'tenant-1',
          phone: '+1234567890',
          otp_code: '123456'
        })
        .expect(400);

      expect(response.body.error.message).toBe('Invalid or expired verification code');
    });
  });

  describe('POST /api/public/waitlist', () => {
    it('should join waitlist successfully', async () => {
      mockRedis.get.mockResolvedValue('true'); // Phone verified

      const mockEntry = {
        id: 'entry-1',
        priority_score: 85
      };

      (WaitlistRepository as jest.Mock).mockImplementation(() => ({
        findByPhone: jest.fn().mockResolvedValue([]), // No existing entries
        calculatePriorityScore: jest.fn().mockResolvedValue(85),
        create: jest.fn().mockResolvedValue(mockEntry)
      }));

      const response = await request(app)
        .post('/api/public/waitlist')
        .send({
          tenant_id: 'tenant-1',
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: 'service-1',
          staff_id: 'staff-1',
          earliest_time: '2024-01-15T09:00:00Z',
          latest_time: '2024-01-15T17:00:00Z'
        })
        .expect(201);

      expect(response.body).toEqual({
        id: 'entry-1',
        priority_score: 85,
        position: 1
      });
    });

    it('should reject unverified phone numbers', async () => {
      mockRedis.get.mockResolvedValue(null); // Phone not verified

      const response = await request(app)
        .post('/api/public/waitlist')
        .send({
          tenant_id: 'tenant-1',
          customer_name: 'John Doe',
          phone: '+1234567890',
          service_id: 'service-1',
          earliest_time: '2024-01-15T09:00:00Z',
          latest_time: '2024-01-15T17:00:00Z'
        })
        .expect(400);

      expect(response.body.error.message).toBe('Phone number not verified');
    });

    it('should enforce waitlist limit', async () => {
      mockRedis.get.mockResolvedValue('true'); // Phone verified

      const existingEntries = [
        { id: '1' }, { id: '2' }, { id: '3' }
      ];

      (WaitlistRepository as jest.Mock).mockImplementation(() => ({
        findByPhone: jest.fn().mockResolvedValue(existingEntries)
      }));

      const response = await request(app)
        .post('/api/public/waitlist')
        .send({
          tenant_id: 'tenant-1',
          customer_name: 'John Doe',
          phone: '+1234567890',
          service_id: 'service-1',
          earliest_time: '2024-01-15T09:00:00Z',
          latest_time: '2024-01-15T17:00:00Z'
        })
        .expect(400);

      expect(response.body.error.code).toBe('WAITLIST_LIMIT_EXCEEDED');
    });
  });
});