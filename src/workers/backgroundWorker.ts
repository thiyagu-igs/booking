import { Job } from 'bull';
import { connectRedis } from '../config/redis';
import {
  expiredHoldsQueue,
  notificationCascadeQueue,
  retryNotificationQueue,
  cleanupQueue,
  closeQueues,
  ExpiredHoldsJobData,
  NotificationCascadeJobData,
  RetryNotificationJobData,
  CleanupJobData,
} from '../config/queue';
import { BackgroundJobService } from '../services/BackgroundJobService';
import { connectDatabase } from '../config/database';

// Worker configuration
const WORKER_CONCURRENCY = {
  expiredHolds: 1,      // Process one at a time to avoid conflicts
  cascade: 3,           // Can process multiple cascades simultaneously
  retry: 2,             // Moderate concurrency for retries
  cleanup: 1,           // Single cleanup job at a time
};

class BackgroundWorker {
  private jobService: BackgroundJobService;
  private db: any;
  private isShuttingDown = false;

  constructor() {
    this.jobService = new BackgroundJobService(this.db);
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Starting background worker...');

      // Connect to Redis
      await connectRedis();
      console.log('✅ Connected to Redis');

      // Connect to database
      this.db = await connectDatabase();
      this.jobService = new BackgroundJobService(this.db);
      console.log('✅ Connected to database');

      // Setup job processors
      this.setupJobProcessors();

      // Setup recurring jobs
      this.setupRecurringJobs();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      console.log('✅ Background worker initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize background worker:', error);
      process.exit(1);
    }
  }

  /**
   * Setup job processors for each queue
   */
  private setupJobProcessors(): void {
    // Expired holds processor
    expiredHoldsQueue.process(
      WORKER_CONCURRENCY.expiredHolds,
      async (job: Job<ExpiredHoldsJobData>) => {
        const result = await this.jobService.processExpiredHolds(job);
        if (!result.success) {
          throw new Error(result.error || 'Job failed');
        }
        return result;
      }
    );

    // Notification cascade processor
    notificationCascadeQueue.process(
      WORKER_CONCURRENCY.cascade,
      async (job: Job<NotificationCascadeJobData>) => {
        const result = await this.jobService.processNotificationCascade(job);
        if (!result.success) {
          throw new Error(result.error || 'Job failed');
        }
        return result;
      }
    );

    // Retry notification processor
    retryNotificationQueue.process(
      WORKER_CONCURRENCY.retry,
      async (job: Job<RetryNotificationJobData>) => {
        const result = await this.jobService.retryFailedNotification(job);
        if (!result.success) {
          throw new Error(result.error || 'Job failed');
        }
        return result;
      }
    );

    // Cleanup processor
    cleanupQueue.process(
      WORKER_CONCURRENCY.cleanup,
      async (job: Job<CleanupJobData>) => {
        const result = await this.jobService.cleanupOldJobs(job);
        if (!result.success) {
          throw new Error(result.error || 'Job failed');
        }
        return result;
      }
    );

    console.log('✅ Job processors configured');
  }

  /**
   * Setup recurring jobs using cron-like scheduling
   */
  private setupRecurringJobs(): void {
    // Process expired holds every minute
    expiredHoldsQueue.add(
      'recurring-expired-holds',
      {},
      {
        repeat: { cron: '* * * * *' }, // Every minute
        removeOnComplete: 10,
        removeOnFail: 20,
      }
    );

    // Cleanup old jobs daily at 2 AM
    cleanupQueue.add(
      'daily-cleanup',
      { olderThanDays: 30 },
      {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        removeOnComplete: 5,
        removeOnFail: 10,
      }
    );

    console.log('✅ Recurring jobs scheduled');
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) {
        console.log('⚠️  Force shutdown...');
        process.exit(1);
      }

      this.isShuttingDown = true;
      console.log(`🛑 Received ${signal}, shutting down gracefully...`);

      try {
        // Stop accepting new jobs
        await Promise.all([
          expiredHoldsQueue.pause(),
          notificationCascadeQueue.pause(),
          retryNotificationQueue.pause(),
          cleanupQueue.pause(),
        ]);

        console.log('⏸️  Queues paused, waiting for active jobs to complete...');

        // Wait for active jobs to complete (with timeout)
        const timeout = 30000; // 30 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
          const activeJobs = await Promise.all([
            expiredHoldsQueue.getActive(),
            notificationCascadeQueue.getActive(),
            retryNotificationQueue.getActive(),
            cleanupQueue.getActive(),
          ]);

          const totalActive = activeJobs.reduce((sum, jobs) => sum + jobs.length, 0);
          
          if (totalActive === 0) {
            break;
          }

          console.log(`⏳ Waiting for ${totalActive} active jobs to complete...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Close queues
        await closeQueues();
        console.log('✅ Queues closed');

        // Close database connection
        if (this.db) {
          await this.db.destroy();
          console.log('✅ Database connection closed');
        }

        console.log('✅ Graceful shutdown completed');
        process.exit(0);

      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  /**
   * Health check for the worker
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    uptime: number;
    queues: any[];
    memory: NodeJS.MemoryUsage;
  }> {
    try {
      const { getQueueHealth } = await import('../config/queue');
      const queueHealth = await getQueueHealth();
      
      return {
        status: 'healthy',
        uptime: process.uptime(),
        queues: queueHealth,
        memory: process.memoryUsage(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        uptime: process.uptime(),
        queues: [],
        memory: process.memoryUsage(),
      };
    }
  }
}

// Start the worker if this file is run directly
if (require.main === module) {
  const worker = new BackgroundWorker();
  worker.initialize().catch((error) => {
    console.error('❌ Failed to start background worker:', error);
    process.exit(1);
  });
}

export default BackgroundWorker;