import { Router, Request, Response } from 'express';
import { JobSchedulerService } from '../services/JobSchedulerService';
import { BackgroundJobService } from '../services/BackgroundJobService';
import { authenticate } from '../middleware/auth';
import { validateTenantAccess } from '../middleware/tenant';

const router = Router();

// Apply authentication and tenant validation to all routes
router.use(authenticate);
router.use(validateTenantAccess);

/**
 * Get queue health and status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.getQueueStatus();

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to get queue status',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      data: result.data
    });
  } catch (error: any) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Manually trigger expired holds check
 */
router.post('/expired-holds/trigger', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.body;
    const schedulerService = new JobSchedulerService();
    
    // If tenantId is provided, validate it matches the authenticated tenant
    const targetTenantId = tenantId || (req as any).tenantId;
    if (tenantId && tenantId !== (req as any).tenantId) {
      return res.status(403).json({
        error: 'Cannot trigger jobs for other tenants'
      });
    }

    const result = await schedulerService.scheduleExpiredHoldsCheck(targetTenantId);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to schedule expired holds check',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'Expired holds check scheduled',
      jobId: result.jobId
    });
  } catch (error: any) {
    console.error('Error triggering expired holds check:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Schedule notification cascade
 */
router.post('/cascade/trigger', async (req: Request, res: Response) => {
  try {
    const { slotId, previousEntryId, reason } = req.body;
    const tenantId = (req as any).tenantId;

    if (!slotId || !previousEntryId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: slotId, previousEntryId, reason'
      });
    }

    if (!['declined', 'expired'].includes(reason)) {
      return res.status(400).json({
        error: 'Reason must be either "declined" or "expired"'
      });
    }

    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.scheduleNotificationCascade(
      tenantId,
      slotId,
      previousEntryId,
      reason
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to schedule notification cascade',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'Notification cascade scheduled',
      jobId: result.jobId
    });
  } catch (error: any) {
    console.error('Error scheduling notification cascade:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Schedule notification retry
 */
router.post('/notifications/retry', async (req: Request, res: Response) => {
  try {
    const { notificationId, delayMs = 0 } = req.body;
    const tenantId = (req as any).tenantId;

    if (!notificationId) {
      return res.status(400).json({
        error: 'Missing required field: notificationId'
      });
    }

    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.scheduleNotificationRetry(
      tenantId,
      notificationId,
      0, // Start with retry count 0
      delayMs
    );

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to schedule notification retry',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'Notification retry scheduled',
      jobId: result.jobId
    });
  } catch (error: any) {
    console.error('Error scheduling notification retry:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Schedule cleanup job
 */
router.post('/cleanup/trigger', async (req: Request, res: Response) => {
  try {
    const { olderThanDays = 30 } = req.body;

    if (olderThanDays < 1 || olderThanDays > 365) {
      return res.status(400).json({
        error: 'olderThanDays must be between 1 and 365'
      });
    }

    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.scheduleCleanup(olderThanDays);

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to schedule cleanup',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'Cleanup job scheduled',
      jobId: result.jobId
    });
  } catch (error: any) {
    console.error('Error scheduling cleanup:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get job details
 */
router.get('/:queueName/:jobId', async (req: Request, res: Response) => {
  try {
    const { queueName, jobId } = req.params;
    const schedulerService = new JobSchedulerService();
    
    const result = await schedulerService.getJobDetails(queueName, jobId);

    if (!result.success) {
      return res.status(404).json({
        error: 'Job not found',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      data: result.data
    });
  } catch (error: any) {
    console.error('Error getting job details:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Retry a specific job
 */
router.post('/:queueName/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const { queueName, jobId } = req.params;
    const schedulerService = new JobSchedulerService();
    
    const result = await schedulerService.retryJob(queueName, jobId);

    if (!result.success) {
      return res.status(400).json({
        error: 'Failed to retry job',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: result.message
    });
  } catch (error: any) {
    console.error('Error retrying job:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Pause all queues (admin only)
 */
router.post('/pause', async (req: Request, res: Response) => {
  try {
    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.pauseAllQueues();

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to pause queues',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'All queues paused'
    });
  } catch (error: any) {
    console.error('Error pausing queues:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Resume all queues (admin only)
 */
router.post('/resume', async (req: Request, res: Response) => {
  try {
    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.resumeAllQueues();

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to resume queues',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'All queues resumed'
    });
  } catch (error: any) {
    console.error('Error resuming queues:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Clear failed jobs
 */
router.post('/failed/clear', async (req: Request, res: Response) => {
  try {
    const schedulerService = new JobSchedulerService();
    const result = await schedulerService.clearFailedJobs();

    if (!result.success) {
      return res.status(500).json({
        error: 'Failed to clear failed jobs',
        details: result.error
      });
    }

    res.json({
      status: 'success',
      message: 'Failed jobs cleared',
      data: result.cleared
    });
  } catch (error: any) {
    console.error('Error clearing failed jobs:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;