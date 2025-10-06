import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import slotRoutes from '../../routes/slots';
import { SlotStatus } from '../../models';

// Mock the repositories and services
jest.mock('../../repositories/SlotRepository');
jest.mock('../../repositories/WaitlistRepository');
jest.mock('../../repositories/ServiceRepository');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../services/WaitlistService');
jest.mock('../../services/SlotService');

const app = express();
app.use(express.json());
app.use('/api/slots', slotRoutes);

describe('Slot Routes', () => {
  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-123';
  const mockSlotId = 'slot-123';
  
  let authToken: string;

  beforeAll(() => {
    // Set JWT_SECRET for testing
    process.env.JWT_SECRET = 'test-secret';
    
    // Create a valid JWT token for testing
    authToken = jwt.sign(
      { 
        userId: mockUserId, 
        tenantId: mockTenantId,
        email: 'test@example.com',
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/slots', () => {
    const validSlotData = {
      staff_id: 'staff-123',
      service_id: 'service-123',
      start_time: '2024-01-15T10:00:00Z',
      end_time: '2024-01-15T11:00:00Z'
    };

    it('should create a slot successfully', async () => {
      const mockSlot = {
        id: mockSlotId,
        tenant_id: mockTenantId,
        ...validSlotData,
        start_time: new Date(validSlotData.start_time),
        end_time: new Date(validSlotData.end_time),
        status: SlotStatus.OPEN,
        created_at: new Date(),
        updated_at: new Date()
      };

      // Mock SlotService.createSlot
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.createSlot = jest.fn().mockResolvedValue(mockSlot);

      const response = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validSlotData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSlot);
      expect(response.body.message).toBe('Slot created successfully');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/slots')
        .send(validSlotData);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid slot data', async () => {
      const invalidData = {
        staff_id: 'invalid-uuid',
        service_id: 'service-123',
        start_time: 'invalid-date',
        end_time: '2024-01-15T11:00:00Z'
      };

      const response = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData);

      expect(response.status).toBe(400);
    });

    it('should handle service errors', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.createSlot = jest.fn().mockRejectedValue(new Error('Service not found'));

      const response = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send(validSlotData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Service not found');
    });
  });

  describe('GET /api/slots', () => {
    it('should fetch slots with filters', async () => {
      const mockSlots = [
        {
          id: mockSlotId,
          tenant_id: mockTenantId,
          staff_id: 'staff-123',
          service_id: 'service-123',
          start_time: new Date('2024-01-15T10:00:00Z'),
          end_time: new Date('2024-01-15T11:00:00Z'),
          status: SlotStatus.OPEN,
          staff_name: 'John Stylist',
          service_name: 'Haircut',
          service_duration: 60,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlots = jest.fn().mockResolvedValue(mockSlots);

      const response = await request(app)
        .get('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          status: SlotStatus.OPEN,
          staff_id: 'staff-123',
          start_date: '2024-01-15T00:00:00Z',
          end_date: '2024-01-15T23:59:59Z'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSlots);
      expect(response.body.count).toBe(1);
    });

    it('should handle service errors', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlots = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/slots')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/slots/:id', () => {
    it('should fetch slot by ID', async () => {
      const mockSlotDetails = [{
        id: mockSlotId,
        tenant_id: mockTenantId,
        staff_id: 'staff-123',
        service_id: 'service-123',
        start_time: new Date('2024-01-15T10:00:00Z'),
        end_time: new Date('2024-01-15T11:00:00Z'),
        status: SlotStatus.OPEN,
        staff_name: 'John Stylist',
        service_name: 'Haircut',
        service_duration: 60,
        created_at: new Date(),
        updated_at: new Date()
      }];

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlotWithDetails = jest.fn().mockResolvedValue(mockSlotDetails);

      const response = await request(app)
        .get(`/api/slots/${mockSlotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSlotDetails[0]);
    });

    it('should return 404 if slot not found', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlotWithDetails = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/slots/${mockSlotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Slot not found');
    });
  });

  describe('POST /api/slots/:id/open', () => {
    it('should open slot and trigger matching', async () => {
      const mockMatchResult = {
        slot: {
          id: mockSlotId,
          status: SlotStatus.OPEN,
          tenant_id: mockTenantId,
          staff_id: 'staff-123',
          service_id: 'service-123',
          start_time: new Date('2024-01-15T10:00:00Z'),
          end_time: new Date('2024-01-15T11:00:00Z'),
          created_at: new Date(),
          updated_at: new Date()
        },
        candidates: [
          {
            id: 'waitlist-123',
            customer_name: 'Jane Doe',
            priority_score: 75,
            match_score: 85
          }
        ],
        top_candidate: {
          id: 'waitlist-123',
          customer_name: 'Jane Doe',
          priority_score: 75,
          match_score: 85
        },
        notification_sent: true
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.openSlot = jest.fn().mockResolvedValue(mockMatchResult);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockMatchResult);
      expect(response.body.message).toContain('1 candidates found');
    });

    it('should handle slot with no candidates', async () => {
      const mockMatchResult = {
        slot: {
          id: mockSlotId,
          status: SlotStatus.OPEN
        },
        candidates: [],
        notification_sent: false
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.openSlot = jest.fn().mockResolvedValue(mockMatchResult);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('no eligible candidates found');
    });

    it('should handle service errors', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.openSlot = jest.fn().mockRejectedValue(new Error('Slot not found'));

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Slot not found');
    });
  });

  describe('POST /api/slots/:id/hold', () => {
    it('should hold slot successfully', async () => {
      const mockHeldSlot = {
        id: mockSlotId,
        status: SlotStatus.HELD,
        hold_expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.holdSlot = jest.fn().mockResolvedValue(mockHeldSlot);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/hold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hold_duration_minutes: 15 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockHeldSlot);
      expect(response.body.message).toBe('Slot held for 15 minutes');
    });

    it('should use default hold duration', async () => {
      const mockHeldSlot = {
        id: mockSlotId,
        status: SlotStatus.HELD,
        hold_expires_at: new Date(Date.now() + 10 * 60 * 1000)
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.holdSlot = jest.fn().mockResolvedValue(mockHeldSlot);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/hold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Slot held for 10 minutes');
    });
  });

  describe('POST /api/slots/:id/book', () => {
    it('should book slot successfully', async () => {
      const mockBookedSlot = {
        id: mockSlotId,
        status: SlotStatus.BOOKED,
        hold_expires_at: null
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.bookSlot = jest.fn().mockResolvedValue(mockBookedSlot);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/book`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBookedSlot);
      expect(response.body.message).toBe('Slot booked successfully');
    });

    it('should return 404 if slot not found', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.bookSlot = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post(`/api/slots/${mockSlotId}/book`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Slot not found');
    });
  });

  describe('GET /api/slots/:id/candidates', () => {
    it('should fetch candidates for slot', async () => {
      const mockSlot = {
        id: mockSlotId,
        status: SlotStatus.OPEN
      };

      const mockCandidates = [
        {
          id: 'waitlist-123',
          customer_name: 'Jane Doe',
          priority_score: 75,
          match_score: 85,
          service_name: 'Haircut',
          staff_name: 'John Stylist'
        },
        {
          id: 'waitlist-456',
          customer_name: 'John Smith',
          priority_score: 70,
          match_score: 80,
          service_name: 'Haircut',
          staff_name: 'John Stylist'
        }
      ];

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlot = jest.fn().mockResolvedValue(mockSlot);
      SlotService.prototype.findCandidatesForSlot = jest.fn().mockResolvedValue(mockCandidates);

      const response = await request(app)
        .get(`/api/slots/${mockSlotId}/candidates`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCandidates);
      expect(response.body.count).toBe(2);
    });

    it('should return 404 if slot not found', async () => {
      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlot = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/slots/${mockSlotId}/candidates`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Slot not found');
    });
  });

  describe('POST /api/slots/process-expired-holds', () => {
    it('should process expired holds successfully', async () => {
      const mockResult = {
        released_count: 3,
        cascade_notifications: 2
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.processExpiredHolds = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/slots/process-expired-holds')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(response.body.message).toContain('Processed 3 expired holds');
      expect(response.body.message).toContain('sent 2 cascade notifications');
    });
  });

  describe('GET /api/slots/stats/:startDate/:endDate', () => {
    it('should fetch slot statistics', async () => {
      const mockStats = {
        total_slots: 100,
        open_slots: 20,
        held_slots: 5,
        booked_slots: 70,
        canceled_slots: 5
      };

      const { SlotService } = require('../../services/SlotService');
      SlotService.prototype.getSlotStats = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/slots/stats/2024-01-01T00:00:00Z/2024-01-31T23:59:59Z')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('Race condition scenarios', () => {
    it('should handle concurrent slot booking attempts', async () => {
      const { SlotService } = require('../../services/SlotService');
      
      // First request succeeds
      SlotService.prototype.bookSlot = jest.fn()
        .mockResolvedValueOnce({ id: mockSlotId, status: SlotStatus.BOOKED })
        .mockRejectedValueOnce(new Error('Can only book open or held slots'));

      const request1 = request(app)
        .post(`/api/slots/${mockSlotId}/book`)
        .set('Authorization', `Bearer ${authToken}`);

      const request2 = request(app)
        .post(`/api/slots/${mockSlotId}/book`)
        .set('Authorization', `Bearer ${authToken}`);

      const [response1, response2] = await Promise.all([request1, request2]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(400);
      expect(response2.body.error).toBe('Can only book open or held slots');
    });

    it('should handle concurrent hold attempts', async () => {
      const { SlotService } = require('../../services/SlotService');
      
      SlotService.prototype.holdSlot = jest.fn()
        .mockResolvedValueOnce({ id: mockSlotId, status: SlotStatus.HELD })
        .mockRejectedValueOnce(new Error('Can only hold open slots'));

      const request1 = request(app)
        .post(`/api/slots/${mockSlotId}/hold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hold_duration_minutes: 10 });

      const request2 = request(app)
        .post(`/api/slots/${mockSlotId}/hold`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ hold_duration_minutes: 10 });

      const [response1, response2] = await Promise.all([request1, request2]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(400);
      expect(response2.body.error).toBe('Can only hold open slots');
    });
  });
});