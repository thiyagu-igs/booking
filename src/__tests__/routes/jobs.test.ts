import request from 'supertest';
import express from 'express';

// Mock the queue configuration before importing anything else
jest.mock('../../config/queue', () => ({
  expiredHoldsQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
  },
  notificationCascadeQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
  },
  retryNotificationQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
  },
  cleanupQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    clean: jest.fn(),
  },
  getQueueHealth: jest.fn(),
}));

import jobRoutes from '../../routes/jobs';
import { JobSchedulerService } from '../../services/JobSchedulerService';

// Mock the JobSchedulerService
jest.mock('../../services/JobSchedulerService');

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user-1', tenantId: 'tenant-1' };
    req.tenantId = 'tenant-1';
    next();
  },
}));

describe('Jobs Routes', () => {
  let app: express.Application;
  let mockJobSchedulerService: jest.Mocked<JobSchedulerService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/jobs', jobRoutes);

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup JobSchedulerService mock
    mockJobSchedulerService = {
      getQueueStatus: jest.fn(),
      scheduleExpiredHoldsCheck: jest.fn(),
      scheduleNotificationCascade: jest.fn(),
      scheduleNotificationRetry: jest.fn(),
      scheduleCleanup: jest.fn(),
      getJobDetails: jest.fn(),
      retryJob: jest.fn(),
      pauseAllQueues: jest.fn(),
      resumeAllQueues: jest.fn(),
      clearFailedJobs: jest.fn(),
    } as any;

    (JobSchedulerService as jest.Mock).mockImplementation(() => mockJobSchedulerService);
  });

  describe('GET /status', () => {
    it('should return queue status successfully', async () => {
      const mockHealthData = [
        {
          name: 'expired-holds',
          waiting: 2,
          active: 1,
          completed: 10,
          failed: 0,
          delayed: 0,
          paused: false,
        },
      ];

      mockJobSchedulerService.getQueueStatus.mockResolvedValue({
        success: true,
        data: mockHealthData,
      });

      const response = await request(app)
        .get('/api/jobs/status')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        data: mockHealthData,
      });
    });

    it('should handle queue status errors', async () => {
      mockJobSchedulerService.getQueueStatus.mockResolvedValue({
        success: false,
        error: 'Redis connection failed',
      });

      const response = await request(app)
        .get('/api/jobs/status')
        .expect(500);

      expect(response.body.error).toBe('Failed to get queue status');
    });
  });

  describe('POST /expired-holds/trigger', () => {
    it('should trigger expired holds check for current tenant', async () => {
      mockJobSchedulerService.scheduleExpiredHoldsCheck.mockResolvedValue({
        success: true,
        jobId: 'job-123',
      });

      const response = await request(app)
        .post('/api/jobs/expired-holds/trigger')
        .send({})
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Expired holds check scheduled',
        jobId: 'job-123',
      });

      expect(mockJobSchedulerService.scheduleExpiredHoldsCheck).toHaveBeenCalledWith('tenant-1');
    });

    it('should reject request for different tenant', async () => {
      const response = await request(app)
        .post('/api/jobs/expired-holds/trigger')
        .send({ tenantId: 'other-tenant' })
        .expect(403);

      expect(response.body.error).toBe('Cannot trigger jobs for other tenants');
    });

    it('should handle scheduling errors', async () => {
      mockJobSchedulerService.scheduleExpiredHoldsCheck.mockResolvedValue({
        success: false,
        error: 'Queue unavailable',
      });

      const response = await request(app)
        .post('/api/jobs/expired-holds/trigger')
        .send({})
        .expect(500);

      expect(response.body.error).toBe('Failed to schedule expired holds check');
    });
  });

  describe('POST /cascade/trigger', () => {
    it('should trigger notification cascade successfully', async () => {
      mockJobSchedulerService.scheduleNotificationCascade.mockResolvedValue({
        success: true,
        jobId: 'cascade-123',
      });

      const response = await request(app)
        .post('/api/jobs/cascade/trigger')
        .send({
          slotId: 'slot-1',
          previousEntryId: 'entry-1',
          reason: 'declined',
        })
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Notification cascade scheduled',
        jobId: 'cascade-123',
      });

      expect(mockJobSchedulerService.scheduleNotificationCascade).toHaveBeenCalledWith(
        'tenant-1',
        'slot-1',
        'entry-1',
        'declined'
      );
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/jobs/cascade/trigger')
        .send({
          slotId: 'slot-1',
          // Missing previousEntryId and reason
        })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields: slotId, previousEntryId, reason');
    });

    it('should validate reason field', async () => {
      const response = await request(app)
        .post('/api/jobs/cascade/trigger')
        .send({
          slotId: 'slot-1',
          previousEntryId: 'entry-1',
          reason: 'invalid-reason',
        })
        .expect(400);

      expect(response.body.error).toBe('Reason must be either "declined" or "expired"');
    });
  });

  describe('POST /notifications/retry', () => {
    it('should schedule notification retry successfully', async () => {
      mockJobSchedulerService.scheduleNotificationRetry.mockResolvedValue({
        success: true,
        jobId: 'retry-123',
      });

      const response = await request(app)
        .post('/api/jobs/notifications/retry')
        .send({
          notificationId: 'notif-1',
          delayMs: 5000,
        })
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Notification retry scheduled',
        jobId: 'retry-123',
      });

      expect(mockJobSchedulerService.scheduleNotificationRetry).toHaveBeenCalledWith(
        'tenant-1',
        'notif-1',
        0,
        5000
      );
    });

    it('should validate required notificationId', async () => {
      const response = await request(app)
        .post('/api/jobs/notifications/retry')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Missing required field: notificationId');
    });
  });

  describe('POST /cleanup/trigger', () => {
    it('should schedule cleanup with default retention', async () => {
      mockJobSchedulerService.scheduleCleanup.mockResolvedValue({
        success: true,
        jobId: 'cleanup-123',
      });

      const response = await request(app)
        .post('/api/jobs/cleanup/trigger')
        .send({})
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Cleanup job scheduled',
        jobId: 'cleanup-123',
      });

      expect(mockJobSchedulerService.scheduleCleanup).toHaveBeenCalledWith(30);
    });

    it('should schedule cleanup with custom retention', async () => {
      mockJobSchedulerService.scheduleCleanup.mockResolvedValue({
        success: true,
        jobId: 'cleanup-456',
      });

      const response = await request(app)
        .post('/api/jobs/cleanup/trigger')
        .send({ olderThanDays: 60 })
        .expect(200);

      expect(mockJobSchedulerService.scheduleCleanup).toHaveBeenCalledWith(60);
    });

    it('should validate retention period range', async () => {
      const response = await request(app)
        .post('/api/jobs/cleanup/trigger')
        .send({ olderThanDays: 400 })
        .expect(400);

      expect(response.body.error).toBe('olderThanDays must be between 1 and 365');
    });
  });

  describe('GET /:queueName/:jobId', () => {
    it('should get job details successfully', async () => {
      const mockJobData = {
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        progress: 50,
      };

      mockJobSchedulerService.getJobDetails.mockResolvedValue({
        success: true,
        data: mockJobData,
      } as any);

      const response = await request(app)
        .get('/api/jobs/expired-holds/job-123')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        data: mockJobData,
      });
    });

    it('should handle job not found', async () => {
      mockJobSchedulerService.getJobDetails.mockResolvedValue({
        success: false,
        error: 'Job not found',
      });

      const response = await request(app)
        .get('/api/jobs/expired-holds/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Job not found');
    });
  });

  describe('POST /:queueName/:jobId/retry', () => {
    it('should retry job successfully', async () => {
      mockJobSchedulerService.retryJob.mockResolvedValue({
        success: true,
        message: 'Job job-123 queued for retry',
      });

      const response = await request(app)
        .post('/api/jobs/expired-holds/job-123/retry')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Job job-123 queued for retry',
      });
    });

    it('should handle retry failure', async () => {
      mockJobSchedulerService.retryJob.mockResolvedValue({
        success: false,
        error: 'Job not found',
      });

      const response = await request(app)
        .post('/api/jobs/expired-holds/nonexistent/retry')
        .expect(400);

      expect(response.body.error).toBe('Failed to retry job');
    });
  });

  describe('POST /pause', () => {
    it('should pause all queues successfully', async () => {
      mockJobSchedulerService.pauseAllQueues.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/api/jobs/pause')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'All queues paused',
      });
    });
  });

  describe('POST /resume', () => {
    it('should resume all queues successfully', async () => {
      mockJobSchedulerService.resumeAllQueues.mockResolvedValue({
        success: true,
      });

      const response = await request(app)
        .post('/api/jobs/resume')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'All queues resumed',
      });
    });
  });

  describe('POST /failed/clear', () => {
    it('should clear failed jobs successfully', async () => {
      const mockClearedData = {
        'expired-holds': 2,
        'notification-cascade': 1,
        'retry-notification': 0,
        'cleanup': 1,
      };

      mockJobSchedulerService.clearFailedJobs.mockResolvedValue({
        success: true,
        cleared: mockClearedData,
      });

      const response = await request(app)
        .post('/api/jobs/failed/clear')
        .expect(200);

      expect(response.body).toEqual({
        status: 'success',
        message: 'Failed jobs cleared',
        data: mockClearedData,
      });
    });
  });
});