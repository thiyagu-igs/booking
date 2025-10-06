import request from 'supertest';
import express from 'express';
import calendarRoutes from '../../routes/calendar';
import { CalendarService } from '../../services/CalendarService';
import { StaffRepository } from '../../repositories/StaffRepository';

// Mock the services and repositories
jest.mock('../../services/CalendarService');
jest.mock('../../repositories/StaffRepository');
jest.mock('../../middleware/auth');

const MockCalendarService = CalendarService as jest.MockedClass<typeof CalendarService>;
const MockStaffRepository = StaffRepository as jest.MockedClass<typeof StaffRepository>;

// Mock the auth middleware to add user to request
const mockAuthMiddleware = require('../../middleware/auth');
mockAuthMiddleware.authenticateToken = jest.fn((req: any, res: any, next: any) => {
  req.user = { tenantId: 'test-tenant-id', userId: 'test-user-id' };
  next();
});

describe('Calendar Routes', () => {
  let app: express.Application;
  let mockCalendarService: jest.Mocked<CalendarService>;
  let mockStaffRepo: jest.Mocked<StaffRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());
    app.use('/api/calendar', calendarRoutes);

    // Mock service instances
    mockCalendarService = new MockCalendarService('test-tenant-id') as jest.Mocked<CalendarService>;
    mockStaffRepo = new MockStaffRepository('test-tenant-id') as jest.Mocked<StaffRepository>;

    // Mock constructor calls
    MockCalendarService.mockImplementation(() => mockCalendarService);
    MockStaffRepository.mockImplementation(() => mockStaffRepo);
  });

  describe('GET /api/calendar/auth/:staffId', () => {
    it('should generate OAuth authorization URL', async () => {
      const staffId = 'staff-123';
      const mockStaff = { id: staffId, name: 'John Doe' };
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?...';

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendarService.generateAuthUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get(`/api/calendar/auth/${staffId}`)
        .expect(200);

      expect(mockStaffRepo.findById).toHaveBeenCalledWith(staffId);
      expect(mockCalendarService.generateAuthUrl).toHaveBeenCalledWith(staffId);
      expect(response.body).toEqual({ authUrl: mockAuthUrl });
    });

    it('should return 404 when staff member not found', async () => {
      const staffId = 'nonexistent-staff';

      mockStaffRepo.findById.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/calendar/auth/${staffId}`)
        .expect(404);

      expect(response.body).toEqual({ error: 'Staff member not found' });
    });

    it('should handle service errors', async () => {
      const staffId = 'staff-123';
      const mockStaff = { id: staffId, name: 'John Doe' };

      mockStaffRepo.findById.mockResolvedValue(mockStaff as any);
      mockCalendarService.generateAuthUrl.mockImplementation(() => {
        throw new Error('Service error');
      });

      const response = await request(app)
        .get(`/api/calendar/auth/${staffId}`)
        .expect(500);

      expect(response.body).toEqual({ error: 'Failed to generate authorization URL' });
    });
  });

  describe('POST /api/calendar/callback', () => {
    it('should handle OAuth callback successfully', async () => {
      const callbackData = {
        code: 'auth-code-123',
        state: 'staff-123'
      };

      mockCalendarService.handleOAuthCallback.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .post('/api/calendar/callback')
        .send(callbackData)
        .expect(200);

      expect(mockCalendarService.handleOAuthCallback).toHaveBeenCalledWith(
        callbackData.code,
        callbackData.state
      );
      expect(response.body).toEqual({
        message: 'Calendar integration enabled successfully'
      });
    });

    it('should return 400 when callback fails', async () => {
      const callbackData = {
        code: 'auth-code-123',
        state: 'staff-123'
      };

      mockCalendarService.handleOAuthCallback.mockResolvedValue({
        success: false,
        error: 'Invalid authorization code'
      });

      const response = await request(app)
        .post('/api/calendar/callback')
        .send(callbackData)
        .expect(400);

      expect(response.body).toEqual({ error: 'Invalid authorization code' });
    });

    it('should return 400 when required parameters are missing', async () => {
      const response = await request(app)
        .post('/api/calendar/callback')
        .send({ code: 'auth-code-123' }) // Missing state
        .expect(400);

      expect(response.body).toEqual({
        error: 'Authorization code and state are required'
      });
    });
  });

  describe('GET /api/calendar/status/:staffId', () => {
    it('should return calendar sync status', async () => {
      const staffId = 'staff-123';
      const mockStatus = {
        enabled: true,
        status: 'enabled',
        lastSync: new Date('2024-01-15T10:00:00Z'),
        error: null
      };

      mockCalendarService.getCalendarSyncStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get(`/api/calendar/status/${staffId}`)
        .expect(200);

      expect(mockCalendarService.getCalendarSyncStatus).toHaveBeenCalledWith(staffId);
      expect(response.body).toEqual({
        enabled: true,
        status: 'enabled',
        lastSync: '2024-01-15T10:00:00.000Z',
        error: null
      });
    });

    it('should handle service errors', async () => {
      const staffId = 'staff-123';

      mockCalendarService.getCalendarSyncStatus.mockRejectedValue(
        new Error('Service error')
      );

      const response = await request(app)
        .get(`/api/calendar/status/${staffId}`)
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to get calendar sync status'
      });
    });
  });

  describe('POST /api/calendar/test/:staffId', () => {
    it('should test calendar connection successfully', async () => {
      const staffId = 'staff-123';

      mockCalendarService.testCalendarConnection.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .post(`/api/calendar/test/${staffId}`)
        .expect(200);

      expect(mockCalendarService.testCalendarConnection).toHaveBeenCalledWith(staffId);
      expect(response.body).toEqual({
        message: 'Calendar connection test successful'
      });
    });

    it('should return 400 when connection test fails', async () => {
      const staffId = 'staff-123';

      mockCalendarService.testCalendarConnection.mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });

      const response = await request(app)
        .post(`/api/calendar/test/${staffId}`)
        .expect(400);

      expect(response.body).toEqual({ error: 'Connection failed' });
    });
  });

  describe('DELETE /api/calendar/sync/:staffId', () => {
    it('should disable calendar sync successfully', async () => {
      const staffId = 'staff-123';

      mockCalendarService.disableCalendarSync.mockResolvedValue({
        success: true
      });

      const response = await request(app)
        .delete(`/api/calendar/sync/${staffId}`)
        .expect(200);

      expect(mockCalendarService.disableCalendarSync).toHaveBeenCalledWith(staffId);
      expect(response.body).toEqual({
        message: 'Calendar sync disabled successfully'
      });
    });

    it('should return 400 when disable fails', async () => {
      const staffId = 'staff-123';

      mockCalendarService.disableCalendarSync.mockResolvedValue({
        success: false,
        error: 'Failed to disable sync'
      });

      const response = await request(app)
        .delete(`/api/calendar/sync/${staffId}`)
        .expect(400);

      expect(response.body).toEqual({ error: 'Failed to disable sync' });
    });
  });

  describe('GET /api/calendar/events/stats', () => {
    it('should return calendar sync statistics', async () => {
      const mockStats = {
        total: 10,
        created: 7,
        updated: 2,
        deleted: 1,
        errors: 0
      };

      // Mock the private property access
      Object.defineProperty(mockCalendarService, 'calendarEventRepo', {
        value: {
          getSyncStats: jest.fn().mockResolvedValue(mockStats)
        },
        configurable: true
      });

      const response = await request(app)
        .get('/api/calendar/events/stats')
        .expect(200);

      expect(response.body).toEqual(mockStats);
    });
  });

  describe('POST /api/calendar/events/cleanup', () => {
    it('should cleanup orphaned calendar events', async () => {
      const cleanedUpCount = 3;

      // Mock the private property access
      Object.defineProperty(mockCalendarService, 'calendarEventRepo', {
        value: {
          cleanupOrphanedEvents: jest.fn().mockResolvedValue(cleanedUpCount)
        },
        configurable: true
      });

      const response = await request(app)
        .post('/api/calendar/events/cleanup')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Cleaned up 3 orphaned calendar events',
        cleanedUp: 3
      });
    });

    it('should handle case when no events need cleanup', async () => {
      // Mock the private property access
      Object.defineProperty(mockCalendarService, 'calendarEventRepo', {
        value: {
          cleanupOrphanedEvents: jest.fn().mockResolvedValue(0)
        },
        configurable: true
      });

      const response = await request(app)
        .post('/api/calendar/events/cleanup')
        .expect(200);

      expect(response.body).toEqual({
        message: 'Cleaned up 0 orphaned calendar events',
        cleanedUp: 0
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication for all routes', async () => {
      // Temporarily remove the mock to test actual auth behavior
      mockAuthMiddleware.authenticateToken = jest.fn((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const app = express();
      app.use(express.json());
      app.use('/api/calendar', calendarRoutes);

      await request(app)
        .get('/api/calendar/auth/staff-123')
        .expect(401);

      await request(app)
        .post('/api/calendar/callback')
        .expect(401);

      await request(app)
        .get('/api/calendar/status/staff-123')
        .expect(401);

      await request(app)
        .post('/api/calendar/test/staff-123')
        .expect(401);

      await request(app)
        .delete('/api/calendar/sync/staff-123')
        .expect(401);

      await request(app)
        .get('/api/calendar/events/stats')
        .expect(401);

      await request(app)
        .post('/api/calendar/events/cleanup')
        .expect(401);
    });
  });
});