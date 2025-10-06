import { JobSchedulerService } from '../../services/JobSchedulerService';
import {
  expiredHoldsQueue,
  notificationCascadeQueue,
  retryNotificationQueue,
  cleanupQueue,
  getQueueHealth,
} from '../../config/queue';

// Mock the queue modules
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

describe('JobSchedulerService', () => {
  let jobSchedulerService: JobSchedulerService;

  beforeEach(() => {
    jobSchedulerService = new JobSchedulerService();
    jest.clearAllMocks();
  });

  describe('scheduleExpiredHoldsCheck', () => {
    it('should schedule expired holds check for all tenants', async () => {
      const mockJob = { id: 'job-123' };
      (expiredHoldsQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleExpiredHoldsCheck();

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-123');
      expect(expiredHoldsQueue.add).toHaveBeenCalledWith(
        'manual-expired-holds-check',
        { tenantId: undefined },
        expect.objectContaining({
          priority: 10,
          removeOnComplete: 50,
          removeOnFail: 100,
        })
      );
    });

    it('should schedule expired holds check for specific tenant', async () => {
      const mockJob = { id: 'job-456' };
      (expiredHoldsQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleExpiredHoldsCheck('tenant-1');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job-456');
      expect(expiredHoldsQueue.add).toHaveBeenCalledWith(
        'manual-expired-holds-check',
        { tenantId: 'tenant-1' },
        expect.any(Object)
      );
    });

    it('should handle scheduling errors', async () => {
      (expiredHoldsQueue.add as jest.Mock).mockRejectedValue(new Error('Queue unavailable'));

      const result = await jobSchedulerService.scheduleExpiredHoldsCheck();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Queue unavailable');
    });
  });

  describe('scheduleNotificationCascade', () => {
    it('should schedule notification cascade successfully', async () => {
      const mockJob = { id: 'cascade-123' };
      (notificationCascadeQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleNotificationCascade(
        'tenant-1',
        'slot-1',
        'entry-1',
        'declined'
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('cascade-123');
      expect(notificationCascadeQueue.add).toHaveBeenCalledWith(
        'notification-cascade',
        {
          tenantId: 'tenant-1',
          slotId: 'slot-1',
          previousEntryId: 'entry-1',
          reason: 'declined',
        },
        expect.objectContaining({
          priority: 5,
          removeOnComplete: 100,
          removeOnFail: 200,
        })
      );
    });

    it('should handle cascade scheduling errors', async () => {
      (notificationCascadeQueue.add as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await jobSchedulerService.scheduleNotificationCascade(
        'tenant-1',
        'slot-1',
        'entry-1',
        'expired'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis connection failed');
    });
  });

  describe('scheduleNotificationRetry', () => {
    it('should schedule notification retry with default values', async () => {
      const mockJob = { id: 'retry-123' };
      (retryNotificationQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleNotificationRetry(
        'tenant-1',
        'notif-1'
      );

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('retry-123');
      expect(retryNotificationQueue.add).toHaveBeenCalledWith(
        'retry-notification',
        {
          tenantId: 'tenant-1',
          notificationId: 'notif-1',
          retryCount: 0,
        },
        expect.objectContaining({
          delay: 0,
          priority: 3,
        })
      );
    });

    it('should schedule notification retry with custom delay and retry count', async () => {
      const mockJob = { id: 'retry-456' };
      (retryNotificationQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleNotificationRetry(
        'tenant-1',
        'notif-1',
        2,
        5000
      );

      expect(result.success).toBe(true);
      expect(retryNotificationQueue.add).toHaveBeenCalledWith(
        'retry-notification',
        {
          tenantId: 'tenant-1',
          notificationId: 'notif-1',
          retryCount: 2,
        },
        expect.objectContaining({
          delay: 5000,
        })
      );
    });
  });

  describe('scheduleCleanup', () => {
    it('should schedule cleanup with default retention period', async () => {
      const mockJob = { id: 'cleanup-123' };
      (cleanupQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleCleanup();

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('cleanup-123');
      expect(cleanupQueue.add).toHaveBeenCalledWith(
        'manual-cleanup',
        { olderThanDays: 30 },
        expect.objectContaining({
          priority: 1,
        })
      );
    });

    it('should schedule cleanup with custom retention period', async () => {
      const mockJob = { id: 'cleanup-456' };
      (cleanupQueue.add as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.scheduleCleanup(60);

      expect(result.success).toBe(true);
      expect(cleanupQueue.add).toHaveBeenCalledWith(
        'manual-cleanup',
        { olderThanDays: 60 },
        expect.any(Object)
      );
    });
  });

  describe('getQueueStatus', () => {
    it('should return queue health data', async () => {
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
        {
          name: 'notification-cascade',
          waiting: 0,
          active: 0,
          completed: 5,
          failed: 1,
          delayed: 0,
          paused: false,
        },
      ];

      (getQueueHealth as jest.Mock).mockResolvedValue(mockHealthData);

      const result = await jobSchedulerService.getQueueStatus();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHealthData);
    });

    it('should handle queue health check errors', async () => {
      (getQueueHealth as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));

      const result = await jobSchedulerService.getQueueStatus();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Redis unavailable');
    });
  });

  describe('pauseAllQueues', () => {
    it('should pause all queues successfully', async () => {
      (expiredHoldsQueue.pause as jest.Mock).mockResolvedValue(undefined);
      (notificationCascadeQueue.pause as jest.Mock).mockResolvedValue(undefined);
      (retryNotificationQueue.pause as jest.Mock).mockResolvedValue(undefined);
      (cleanupQueue.pause as jest.Mock).mockResolvedValue(undefined);

      const result = await jobSchedulerService.pauseAllQueues();

      expect(result.success).toBe(true);
      expect(expiredHoldsQueue.pause).toHaveBeenCalled();
      expect(notificationCascadeQueue.pause).toHaveBeenCalled();
      expect(retryNotificationQueue.pause).toHaveBeenCalled();
      expect(cleanupQueue.pause).toHaveBeenCalled();
    });

    it('should handle pause errors', async () => {
      (expiredHoldsQueue.pause as jest.Mock).mockRejectedValue(new Error('Pause failed'));

      const result = await jobSchedulerService.pauseAllQueues();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pause failed');
    });
  });

  describe('resumeAllQueues', () => {
    it('should resume all queues successfully', async () => {
      (expiredHoldsQueue.resume as jest.Mock).mockResolvedValue(undefined);
      (notificationCascadeQueue.resume as jest.Mock).mockResolvedValue(undefined);
      (retryNotificationQueue.resume as jest.Mock).mockResolvedValue(undefined);
      (cleanupQueue.resume as jest.Mock).mockResolvedValue(undefined);

      const result = await jobSchedulerService.resumeAllQueues();

      expect(result.success).toBe(true);
      expect(expiredHoldsQueue.resume).toHaveBeenCalled();
      expect(notificationCascadeQueue.resume).toHaveBeenCalled();
      expect(retryNotificationQueue.resume).toHaveBeenCalled();
      expect(cleanupQueue.resume).toHaveBeenCalled();
    });
  });

  describe('clearFailedJobs', () => {
    it('should clear failed jobs from all queues', async () => {
      (expiredHoldsQueue.clean as jest.Mock).mockResolvedValue(['job1', 'job2']);
      (notificationCascadeQueue.clean as jest.Mock).mockResolvedValue(['job3']);
      (retryNotificationQueue.clean as jest.Mock).mockResolvedValue([]);
      (cleanupQueue.clean as jest.Mock).mockResolvedValue(['job4']);

      const result = await jobSchedulerService.clearFailedJobs();

      expect(result.success).toBe(true);
      expect(result.cleared).toEqual({
        'expired-holds': 2,
        'notification-cascade': 1,
        'retry-notification': 0,
        'cleanup': 1,
      });
    });
  });

  describe('getJobDetails', () => {
    it('should get job details for valid queue and job', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { test: 'data' },
        opts: { priority: 5 },
        progress: jest.fn().mockReturnValue(50),
        delay: 0,
        timestamp: 1234567890,
        attemptsMade: 1,
        failedReason: null,
        stacktrace: null,
        returnvalue: null,
        finishedOn: null,
        processedOn: 1234567900,
      };

      (expiredHoldsQueue.getJob as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.getJobDetails('expired-holds', 'job-123');

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('job-123');
      expect(result.data?.name).toBe('test-job');
    });

    it('should handle job not found', async () => {
      (expiredHoldsQueue.getJob as jest.Mock).mockResolvedValue(null);

      const result = await jobSchedulerService.getJobDetails('expired-holds', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });

    it('should handle unknown queue', async () => {
      const result = await jobSchedulerService.getJobDetails('unknown-queue', 'job-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown queue: unknown-queue');
    });
  });

  describe('retryJob', () => {
    it('should retry a job successfully', async () => {
      const mockJob = {
        retry: jest.fn().mockResolvedValue(undefined),
      };

      (expiredHoldsQueue.getJob as jest.Mock).mockResolvedValue(mockJob);

      const result = await jobSchedulerService.retryJob('expired-holds', 'job-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Job job-123 queued for retry');
      expect(mockJob.retry).toHaveBeenCalled();
    });

    it('should handle job not found for retry', async () => {
      (expiredHoldsQueue.getJob as jest.Mock).mockResolvedValue(null);

      const result = await jobSchedulerService.retryJob('expired-holds', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Job not found');
    });
  });
});