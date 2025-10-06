import {
  expiredHoldsQueue,
  notificationCascadeQueue,
  retryNotificationQueue,
  cleanupQueue,
  ExpiredHoldsJobData,
  NotificationCascadeJobData,
  RetryNotificationJobData,
  CleanupJobData,
  getQueueHealth,
} from '../config/queue';

export interface ScheduleJobResult {
  success: boolean;
  jobId?: string;
  error?: string;
}

export class JobSchedulerService {
  /**
   * Schedule immediate processing of expired holds for all tenants or specific tenant
   */
  async scheduleExpiredHoldsCheck(tenantId?: string): Promise<ScheduleJobResult> {
    try {
      const jobData: ExpiredHoldsJobData = { tenantId };
      
      const job = await expiredHoldsQueue.add('manual-expired-holds-check', jobData, {
        priority: 10, // High priority for manual triggers
        removeOnComplete: 50,
        removeOnFail: 100,
      });

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Schedule notification cascade when customer declines or hold expires
   */
  async scheduleNotificationCascade(
    tenantId: string,
    slotId: string,
    previousEntryId: string,
    reason: 'declined' | 'expired'
  ): Promise<ScheduleJobResult> {
    try {
      const jobData: NotificationCascadeJobData = {
        tenantId,
        slotId,
        previousEntryId,
        reason,
      };

      const job = await notificationCascadeQueue.add('notification-cascade', jobData, {
        priority: 5, // Medium-high priority
        removeOnComplete: 100,
        removeOnFail: 200,
      });

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Schedule retry for failed notification
   */
  async scheduleNotificationRetry(
    tenantId: string,
    notificationId: string,
    retryCount: number = 0,
    delayMs: number = 0
  ): Promise<ScheduleJobResult> {
    try {
      const jobData: RetryNotificationJobData = {
        tenantId,
        notificationId,
        retryCount,
      };

      const job = await retryNotificationQueue.add('retry-notification', jobData, {
        delay: delayMs,
        priority: 3, // Medium priority
        removeOnComplete: 50,
        removeOnFail: 100,
      });

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Schedule cleanup of old data
   */
  async scheduleCleanup(olderThanDays: number = 30): Promise<ScheduleJobResult> {
    try {
      const jobData: CleanupJobData = { olderThanDays };

      const job = await cleanupQueue.add('manual-cleanup', jobData, {
        priority: 1, // Low priority
        removeOnComplete: 10,
        removeOnFail: 20,
      });

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get queue health and statistics
   */
  async getQueueStatus() {
    try {
      const health = await getQueueHealth();
      return {
        success: true,
        data: health,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Pause all queues (for maintenance)
   */
  async pauseAllQueues(): Promise<{ success: boolean; error?: string }> {
    try {
      await Promise.all([
        expiredHoldsQueue.pause(),
        notificationCascadeQueue.pause(),
        retryNotificationQueue.pause(),
        cleanupQueue.pause(),
      ]);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Resume all queues
   */
  async resumeAllQueues(): Promise<{ success: boolean; error?: string }> {
    try {
      await Promise.all([
        expiredHoldsQueue.resume(),
        notificationCascadeQueue.resume(),
        retryNotificationQueue.resume(),
        cleanupQueue.resume(),
      ]);

      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear failed jobs from all queues
   */
  async clearFailedJobs(): Promise<{
    success: boolean;
    cleared: { [queueName: string]: number };
    error?: string;
  }> {
    try {
      const results = await Promise.all([
        expiredHoldsQueue.clean(0, 'failed'),
        notificationCascadeQueue.clean(0, 'failed'),
        retryNotificationQueue.clean(0, 'failed'),
        cleanupQueue.clean(0, 'failed'),
      ]);

      return {
        success: true,
        cleared: {
          'expired-holds': results[0].length,
          'notification-cascade': results[1].length,
          'retry-notification': results[2].length,
          'cleanup': results[3].length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        cleared: {},
        error: error.message,
      };
    }
  }

  /**
   * Get job details by ID and queue
   */
  async getJobDetails(queueName: string, jobId: string) {
    try {
      let queue;
      switch (queueName) {
        case 'expired-holds':
          queue = expiredHoldsQueue;
          break;
        case 'notification-cascade':
          queue = notificationCascadeQueue;
          break;
        case 'retry-notification':
          queue = retryNotificationQueue;
          break;
        case 'cleanup':
          queue = cleanupQueue;
          break;
        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      return {
        success: true,
        data: {
          id: job.id,
          name: job.name,
          data: job.data,
          opts: job.opts,
          progress: job.progress(),
          delay: (job as any).delay,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade,
          failedReason: job.failedReason,
          stacktrace: job.stacktrace,
          returnvalue: job.returnvalue,
          finishedOn: job.finishedOn,
          processedOn: job.processedOn,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Retry a specific failed job
   */
  async retryJob(queueName: string, jobId: string) {
    try {
      let queue;
      switch (queueName) {
        case 'expired-holds':
          queue = expiredHoldsQueue;
          break;
        case 'notification-cascade':
          queue = notificationCascadeQueue;
          break;
        case 'retry-notification':
          queue = retryNotificationQueue;
          break;
        case 'cleanup':
          queue = cleanupQueue;
          break;
        default:
          throw new Error(`Unknown queue: ${queueName}`);
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      await job.retry();

      return {
        success: true,
        message: `Job ${jobId} queued for retry`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}