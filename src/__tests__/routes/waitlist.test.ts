import request from 'supertest';
import express from 'express';
import waitlistRoutes from '../../routes/waitlist';
import { authenticate } from '../../middleware/auth';
import { WaitlistRepository } from '../../repositories/WaitlistRepository';
import { ServiceRepository } from '../../repositories/ServiceRepository';
import { StaffRepository } from '../../repositories/StaffRepository';
import { WaitlistEntry, WaitlistStatus, Service, Staff } from '../../models';

// Mock dependencies
jest.mock('../../middleware/auth');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');

const mockAuthenticate = authenticate as jest.MockedFunction<typeof authenticate>;

describe('Waitlist Routes', () => {
  let app: express.Application;
  let mockWaitlistRepo: jest.Mocked<WaitlistRepository>;
  let mockServiceRepo: jest.Mocked<ServiceRepository>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication middleware
    mockAuthenticate.mockImplementation((req: any, res: any, next: any) => {
      req.user = { userId: mockUserId, tenantId: mockTenantId };
      req.repositories = {
        waitlist: mockWaitlistRepo,
        service: mockServiceRepo,
        staff: mockStaffRepo
      };
      next();
    });

    // Create mock repositories
    mockWaitlistRepo = {
      findByPhone: jest.fn(),
      countActiveByPhone: jest.fn(),
      create: jest.fn(),
      findWithDetails: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      getWaitlistStats: jest.fn(),
      findActive: jest.fn(),
    } as any;

    mockServiceRepo = {
      findById: jest.fn(),
    } as any;

    mockStaffRepo = {
      findById: jest.fn(),
    } as any;

    app.use('/api/waitlist', waitlistRoutes);

    jest.clearAllMocks();
  });

  describe('POST /api/waitlist/verify-phone', () => {
    it('should send OTP for valid phone number', async () => {
      const response = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone: '+1234567890' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('OTP sent successfully');
    });

    it('should reject invalid phone number', async () => {
      const response = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should enforce rate limiting', async () => {
      const phone = '+1234567890';
      
      // First request should succeed
      const response1 = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone });

      expect(response1.status).toBe(200);

      // Second request should be rate limited
      const response2 = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone });

      expect(response2.status).toBe(429);
      expect(response2.body.error).toBe('RATE_LIMITED');
    });
  });

  describe('POST /api/waitlist/verify-otp', () => {
    it('should verify correct OTP', async () => {
      const phone = '+1234567890';
      
      // First generate OTP
      const generateResponse = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone });

      const otp = generateResponse.body.otp;

      // Then verify it
      const verifyResponse = await request(app)
        .post('/api/waitlist/verify-otp')
        .send({ phone, code: otp });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.message).toBe('Phone number verified successfully');
    });

    it('should reject incorrect OTP', async () => {
      const phone = '+1234567890';
      
      await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone });

      const verifyResponse = await request(app)
        .post('/api/waitlist/verify-otp')
        .send({ phone, code: '000000' });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.error).toBe('VERIFICATION_FAILED');
    });

    it('should validate OTP format', async () => {
      const response = await request(app)
        .post('/api/waitlist/verify-otp')
        .send({ phone: '+1234567890', code: '123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/waitlist', () => {
    const validWaitlistData = {
      customer_name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      service_id: 'service-123',
      staff_id: 'staff-123',
      earliest_time: '2024-01-15T10:00:00Z',
      latest_time: '2024-01-15T18:00:00Z',
      vip_status: false
    };

    const mockService: Service = {
      id: 'service-123',
      tenant_id: mockTenantId,
      name: 'Haircut',
      duration_minutes: 60,
      active: true,
      created_at: new Date(),
    };

    const mockStaff: Staff = {
      id: 'staff-123',
      tenant_id: mockTenantId,
      name: 'Jane Smith',
      active: true,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockServiceRepo.findById.mockResolvedValue(mockService);
      mockStaffRepo.findById.mockResolvedValue(mockStaff);
      mockWaitlistRepo.findByPhone.mockResolvedValue([]);
      mockWaitlistRepo.countActiveByPhone.mockResolvedValue(0);
    });

    it('should create waitlist entry for verified phone', async () => {
      // First verify phone
      await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone: validWaitlistData.phone });

      const generateResponse = await request(app)
        .post('/api/waitlist/verify-phone')
        .send({ phone: validWaitlistData.phone });

      await request(app)
        .post('/api/waitlist/verify-otp')
        .send({ phone: validWaitlistData.phone, code: generateResponse.body.otp });

      const mockCreatedEntry: WaitlistEntry = {
        id: 'entry-123',
        tenant_id: mockTenantId,
        ...validWaitlistData,
        earliest_time: new Date(validWaitlistData.earliest_time),
        latest_time: new Date(validWaitlistData.latest_time),
        priority_score: 55,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
      };

      mockWaitlistRepo.create.mockResolvedValue(mockCreatedEntry);

      const response = await request(app)
        .post('/api/waitlist')
        .send(validWaitlistData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Successfully added to waitlist');
      expect(response.body.data).toEqual(expect.objectContaining({
        id: 'entry-123',
        customer_name: 'John Doe'
      }));
    });

    it('should reject unverified phone for new customers', async () => {
      const response = await request(app)
        .post('/api/waitlist')
        .send(validWaitlistData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('PHONE_NOT_VERIFIED');
    });

    it('should allow existing customers without phone verification', async () => {
      const existingEntry: WaitlistEntry = {
        id: 'existing-123',
        tenant_id: mockTenantId,
        customer_name: 'John Doe',
        phone: validWaitlistData.phone,
        service_id: 'service-456',
        earliest_time: new Date(),
        latest_time: new Date(),
        priority_score: 50,
        vip_status: false,
        status: WaitlistStatus.CONFIRMED,
        created_at: new Date(),
      };

      mockWaitlistRepo.findByPhone.mockResolvedValue([existingEntry]);

      const mockCreatedEntry: WaitlistEntry = {
        id: 'entry-123',
        tenant_id: mockTenantId,
        ...validWaitlistData,
        earliest_time: new Date(validWaitlistData.earliest_time),
        latest_time: new Date(validWaitlistData.latest_time),
        priority_score: 55,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
      };

      mockWaitlistRepo.create.mockResolvedValue(mockCreatedEntry);

      const response = await request(app)
        .post('/api/waitlist')
        .send(validWaitlistData);

      expect(response.status).toBe(201);
    });

    it('should reject when maximum entries exceeded', async () => {
      mockWaitlistRepo.countActiveByPhone.mockResolvedValue(3);

      const response = await request(app)
        .post('/api/waitlist')
        .send(validWaitlistData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('WAITLIST_LIMIT_EXCEEDED');
    });

    it('should validate required fields', async () => {
      const invalidData = { ...validWaitlistData };
      delete (invalidData as any).customer_name;

      const response = await request(app)
        .post('/api/waitlist')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('VALIDATION_ERROR');
    });

    it('should validate service exists', async () => {
      mockServiceRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/waitlist')
        .send(validWaitlistData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_REFERENCE');
    });

    it('should validate time window', async () => {
      const invalidData = {
        ...validWaitlistData,
        earliest_time: '2024-01-15T18:00:00Z',
        latest_time: '2024-01-15T10:00:00Z'
      };

      const response = await request(app)
        .post('/api/waitlist')
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_TIME_WINDOW');
    });
  });

  describe('GET /api/waitlist', () => {
    it('should return paginated waitlist entries', async () => {
      const mockEntries = [
        {
          id: 'entry-1',
          customer_name: 'John Doe',
          priority_score: 70,
          service_name: 'Haircut',
          service_duration: 60,
          created_at: new Date()
        }
      ];

      mockWaitlistRepo.findWithDetails.mockResolvedValue(mockEntries as any);

      const response = await request(app)
        .get('/api/waitlist')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.entries).toEqual(mockEntries);
      expect(response.body.data.total).toBe(1);
    });

    it('should apply filters', async () => {
      mockWaitlistRepo.findWithDetails.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/waitlist')
        .query({ 
          status: 'active',
          service_id: 'service-123',
          vip_status: 'true'
        });

      expect(response.status).toBe(200);
      expect(mockWaitlistRepo.findWithDetails).toHaveBeenCalledWith({
        status: 'active',
        service_id: 'service-123',
        vip_status: true
      });
    });

    it('should validate filter parameters', async () => {
      const response = await request(app)
        .get('/api/waitlist')
        .query({ status: 'invalid_status' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_FILTERS');
    });
  });

  describe('GET /api/waitlist/stats', () => {
    it('should return waitlist statistics', async () => {
      const mockStats = {
        total_active: 5,
        total_notified: 2,
        total_confirmed: 3,
        total_removed: 1,
        avg_priority_score: 55.5,
        vip_count: 2
      };

      mockWaitlistRepo.getWaitlistStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/waitlist/stats');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('GET /api/waitlist/:id', () => {
    it('should return specific waitlist entry', async () => {
      const mockEntry: WaitlistEntry = {
        id: 'entry-123',
        tenant_id: mockTenantId,
        customer_name: 'John Doe',
        phone: '+1234567890',
        service_id: 'service-123',
        earliest_time: new Date(),
        latest_time: new Date(),
        priority_score: 55,
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
        created_at: new Date(),
      };

      mockWaitlistRepo.findById.mockResolvedValue(mockEntry);

      const response = await request(app)
        .get('/api/waitlist/entry-123');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(expect.objectContaining({
        id: 'entry-123',
        customer_name: 'John Doe'
      }));
    });

    it('should return 404 for non-existent entry', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/waitlist/entry-123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('ENTRY_NOT_FOUND');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/waitlist/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_ID');
    });
  });

  describe('PUT /api/waitlist/:id', () => {
    const mockEntry: WaitlistEntry = {
      id: 'entry-123',
      tenant_id: mockTenantId,
      customer_name: 'John Doe',
      phone: '+1234567890',
      service_id: 'service-123',
      earliest_time: new Date(),
      latest_time: new Date(),
      priority_score: 55,
      vip_status: false,
      status: WaitlistStatus.ACTIVE,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockWaitlistRepo.findById.mockResolvedValue(mockEntry);
    });

    it('should update waitlist entry', async () => {
      const updates = { customer_name: 'John Smith', vip_status: true };
      const updatedEntry = { ...mockEntry, ...updates };

      mockWaitlistRepo.update.mockResolvedValue(updatedEntry);

      const response = await request(app)
        .put('/api/waitlist/entry-123')
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.data.customer_name).toBe('John Smith');
      expect(response.body.data.vip_status).toBe(true);
    });

    it('should return 404 for non-existent entry', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/waitlist/entry-123')
        .send({ customer_name: 'John Smith' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('ENTRY_NOT_FOUND');
    });
  });

  describe('DELETE /api/waitlist/:id', () => {
    const mockEntry: WaitlistEntry = {
      id: 'entry-123',
      tenant_id: mockTenantId,
      customer_name: 'John Doe',
      phone: '+1234567890',
      service_id: 'service-123',
      earliest_time: new Date(),
      latest_time: new Date(),
      priority_score: 55,
      vip_status: false,
      status: WaitlistStatus.ACTIVE,
      created_at: new Date(),
    };

    beforeEach(() => {
      mockWaitlistRepo.findById.mockResolvedValue(mockEntry);
    });

    it('should remove waitlist entry', async () => {
      const removedEntry = { ...mockEntry, status: WaitlistStatus.REMOVED };
      mockWaitlistRepo.updateStatus.mockResolvedValue(removedEntry);

      const response = await request(app)
        .delete('/api/waitlist/entry-123')
        .send({ reason: 'Customer request' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Entry removed from waitlist successfully');
    });

    it('should return 404 for non-existent entry', async () => {
      mockWaitlistRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/waitlist/entry-123');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('ENTRY_NOT_FOUND');
    });
  });

  describe('GET /api/waitlist/phone/:phone', () => {
    it('should return entries for phone number', async () => {
      const mockEntries: WaitlistEntry[] = [
        {
          id: 'entry-123',
          tenant_id: mockTenantId,
          customer_name: 'John Doe',
          phone: '+1234567890',
          service_id: 'service-123',
          earliest_time: new Date(),
          latest_time: new Date(),
          priority_score: 55,
          vip_status: false,
          status: WaitlistStatus.ACTIVE,
          created_at: new Date(),
        }
      ];

      mockWaitlistRepo.findByPhone.mockResolvedValue(mockEntries);

      const response = await request(app)
        .get('/api/waitlist/phone/+1234567890');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockEntries);
    });

    it('should validate phone format', async () => {
      const response = await request(app)
        .get('/api/waitlist/phone/invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('INVALID_PHONE');
    });
  });

  describe('POST /api/waitlist/recalculate-priorities', () => {
    it('should recalculate priority scores', async () => {
      mockWaitlistRepo.findActive.mockResolvedValue([]);

      const response = await request(app)
        .post('/api/waitlist/recalculate-priorities');

      expect(response.status).toBe(200);
      expect(response.body.data.updated_count).toBe(0);
    });
  });
});