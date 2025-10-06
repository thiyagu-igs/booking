import Queue, { Queue as QueueType } from 'bull';
import { redisConfig } from './redis';

// Check if Redis should be mocked
const MOCK_REDIS = process.env.MOCK_REDIS === 'true' || process.env.NODE_ENV === 'test';

// Mock queue implementation
class MockQueue {
  private name: string;
  private jobs: any[] = [];
  private processors: Map<string, Function> = new Map();

  constructor(name: string, options?: any) {
    this.name = name;
    console.log(`🔧 Created Mock Queue: ${name}`);
  }

  async add(jobName: string, data: any, options?: any): Promise<any> {
    const job = {
      id: Date.now(),
      name: jobName,
      data,
      opts: options,
      progress: () => {},
      log: () => {},
    };
    
    this.jobs.push(job);
    
    // Process immediately if processor exists
    const processor = this.processors.get('*') || this.processors.get(jobName);
    if (processor) {
      setTimeout(() => {
        try {
          processor(job);
        } catch (error) {
          console.error(`Mock queue ${this.name} job failed:`, error);
        }
      }, 0);
    }
    
    return job;
  }

  process(concurrency: number | string, processor?: Function): void;
  process(processor: Function): void;
  process(concurrencyOrProcessor: number | string | Function, processor?: Function): void {
    const actualProcessor = typeof concurrencyOrProcessor === 'function' 
      ? concurrencyOrProcessor 
      : processor;
    
    if (actualProcessor) {
      this.processors.set('*', actualProcessor);
    }
  }

  async getWaiting(): Promise<any[]> { return []; }
  async getActive(): Promise<any[]> { return []; }
  async getCompleted(): Promise<any[]> { return this.jobs.slice(-10); }
  async getFailed(): Promise<any[]> { return []; }
  async getDelayed(): Promise<any[]> { return []; }
  async isPaused(): Promise<boolean> { return false; }
  async pause(): Promise<void> {}
  async resume(): Promise<void> {}
  async close(): Promise<void> {}

  on(event: string, callback: Function): void {
    // Mock event handlers - do nothing
  }
}

// Job types
export enum JobType {
  PROCESS_EXPIRED_HOLDS = 'process_expired_holds',
  NOTIFICATION_CASCADE = 'notification_cascade',
  RETRY_FAILED_NOTIFICATION = 'retry_failed_notification',
  CLEANUP_OLD_JOBS = 'cleanup_old_jobs'
}

// Job data interfaces
export interface ExpiredHoldsJobData {
  tenantId?: string; // If specified, process only for this tenant
}

export interface NotificationCascadeJobData {
  tenantId: string;
  slotId: string;
  previousEntryId: string;
  reason: 'declined' | 'expired';
}

export interface RetryNotificationJobData {
  tenantId: string;
  notificationId: string;
  retryCount: number;
}

export interface CleanupJobData {
  olderThanDays: number;
}

// Create job queues with Redis configuration or mock queues
const createQueue = <T>(name: string, options: any) => {
  if (MOCK_REDIS) {
    return new MockQueue(name, options) as any;
  }
  return new Queue<T>(name, { redis: redisConfig, ...options });
};

export const expiredHoldsQueue = createQueue<ExpiredHoldsJobData>('expired-holds', {
  defaultJobOptions: {
    removeOnComplete: 50, // Keep last 50 completed jobs
    removeOnFail: 100,    // Keep last 100 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 second delay
    },
  },
});

export const notificationCascadeQueue = createQueue<NotificationCascadeJobData>('notification-cascade', {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second delay
    },
  },
});

export const retryNotificationQueue = createQueue<RetryNotificationJobData>('retry-notification', {
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
    attempts: 1, // Don't retry the retry job itself
    delay: 0,
  },
});

export const cleanupQueue = createQueue<CleanupJobData>('cleanup', {
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 20,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000,
    },
  },
});

// Queue monitoring and health check
export interface QueueHealth {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export async function getQueueHealth(): Promise<QueueHealth[]> {
  const queues = [
    { name: 'expired-holds', queue: expiredHoldsQueue },
    { name: 'notification-cascade', queue: notificationCascadeQueue },
    { name: 'retry-notification', queue: retryNotificationQueue },
    { name: 'cleanup', queue: cleanupQueue },
  ];

  const healthData: QueueHealth[] = [];

  for (const { name, queue } of queues) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed(),
    ]);

    healthData.push({
      name,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: await queue.isPaused(),
    });
  }

  return healthData;
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    expiredHoldsQueue.close(),
    notificationCascadeQueue.close(),
    retryNotificationQueue.close(),
    cleanupQueue.close(),
  ]);
}

// Queue event logging
function setupQueueLogging(queue: QueueType<any>, name: string) {
  queue.on('completed', (job: any) => {
    console.log(`[${name}] Job ${job.id} completed successfully`);
  });

  queue.on('failed', (job: any, err: any) => {
    console.error(`[${name}] Job ${job.id} failed:`, err.message);
  });

  queue.on('stalled', (job: any) => {
    console.warn(`[${name}] Job ${job.id} stalled`);
  });

  queue.on('error', (error: any) => {
    console.error(`[${name}] Queue error:`, error);
  });
}

// Setup logging for all queues
setupQueueLogging(expiredHoldsQueue, 'ExpiredHolds');
setupQueueLogging(notificationCascadeQueue, 'NotificationCascade');
setupQueueLogging(retryNotificationQueue, 'RetryNotification');
setupQueueLogging(cleanupQueue, 'Cleanup');