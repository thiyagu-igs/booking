import { Job } from 'bull';
import { SlotRepository } from '../repositories/SlotRepository';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { NotificationService } from './NotificationService';
import { SlotService } from './SlotService';
import { WaitlistService } from './WaitlistService';
import { SlotStatus, WaitlistStatus } from '../models';
import {
  ExpiredHoldsJobData,
  NotificationCascadeJobData,
  RetryNotificationJobData,
  CleanupJobData,
} from '../config/queue';

export interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface ExpiredHoldsResult {
  processed_tenants: number;
  released_slots: number;
  cascade_notifications: number;
  errors: string[];
}

export interface CascadeResult {
  next_candidate_found: boolean;
  notification_sent: boolean;
  candidate_name?: string;
  error?: string;
}

export class BackgroundJobService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Process expired slot holds across all tenants or specific tenant
   */
  async processExpiredHolds(job: Job<ExpiredHoldsJobData>): Promise<JobResult> {
    const { tenantId } = job.data;
    const startTime = Date.now();
    
    try {
      console.log(`[ExpiredHolds] Starting job ${job.id}${tenantId ? ` for tenant ${tenantId}` : ' for all tenants'}`);
      
      let tenantsToProcess: string[];
      
      if (tenantId) {
        // Process specific tenant
        tenantsToProcess = [tenantId];
      } else {
        // Get all active tenants
        const tenants = await this.db('tenants')
          .select('id')
          .where('active', true);
        tenantsToProcess = tenants.map((t: any) => t.id);
      }

      const result: ExpiredHoldsResult = {
        processed_tenants: 0,
        released_slots: 0,
        cascade_notifications: 0,
        errors: []
      };

      for (const currentTenantId of tenantsToProcess) {
        try {
          // Create tenant-scoped repositories
          const slotRepo = new SlotRepository(currentTenantId);
          const waitlistRepo = new WaitlistRepository(currentTenantId);
          const serviceRepo = new ServiceRepository(currentTenantId);
          const staffRepo = new StaffRepository(currentTenantId);
          const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
          
          const slotService = new SlotService(
            slotRepo,
            waitlistRepo,
            serviceRepo,
            staffRepo,
            waitlistService,
            currentTenantId
          );

          // Process expired holds for this tenant
          const tenantResult = await slotService.processExpiredHolds();
          
          result.processed_tenants++;
          result.released_slots += tenantResult.released_count;
          result.cascade_notifications += tenantResult.cascade_notifications;

          console.log(`[ExpiredHolds] Tenant ${currentTenantId}: Released ${tenantResult.released_count} slots, sent ${tenantResult.cascade_notifications} cascade notifications`);

        } catch (tenantError: any) {
          const errorMsg = `Tenant ${currentTenantId}: ${tenantError.message}`;
          result.errors.push(errorMsg);
          console.error(`[ExpiredHolds] ${errorMsg}`);
        }
      }

      const duration = Date.now() - startTime;
      const message = `Processed ${result.processed_tenants} tenants, released ${result.released_slots} slots, sent ${result.cascade_notifications} notifications in ${duration}ms`;
      
      console.log(`[ExpiredHolds] Job ${job.id} completed: ${message}`);

      return {
        success: true,
        message,
        data: result
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = `Job failed after ${duration}ms: ${error.message}`;
      
      console.error(`[ExpiredHolds] Job ${job.id} failed:`, error);

      return {
        success: false,
        message: errorMsg,
        error: error.message
      };
    }
  }

  /**
   * Handle notification cascade when customer declines or hold expires
   */
  async processNotificationCascade(job: Job<NotificationCascadeJobData>): Promise<JobResult> {
    const { tenantId, slotId, previousEntryId, reason } = job.data;
    const startTime = Date.now();

    try {
      console.log(`[NotificationCascade] Starting job ${job.id} for slot ${slotId}, reason: ${reason}`);

      // Create tenant-scoped repositories and services
      const slotRepo = new SlotRepository(tenantId);
      const waitlistRepo = new WaitlistRepository(tenantId);
      const serviceRepo = new ServiceRepository(tenantId);
      const staffRepo = new StaffRepository(tenantId);
      
      const waitlistService = new WaitlistService(waitlistRepo, serviceRepo, staffRepo);
      const slotService = new SlotService(slotRepo, waitlistRepo, serviceRepo, staffRepo, waitlistService, tenantId);
      const notificationService = new NotificationService(this.db, tenantId);

      // Get slot details
      const slot = await slotRepo.findById(slotId);
      if (!slot) {
        throw new Error(`Slot ${slotId} not found`);
      }

      // Update previous entry status based on reason
      if (reason === 'declined') {
        await waitlistRepo.updateStatus(previousEntryId, WaitlistStatus.REMOVED);
      }

      // Find next candidate
      const nextCandidate = await slotService.handleCascadeNotification(slotId);
      
      const result: CascadeResult = {
        next_candidate_found: !!nextCandidate,
        notification_sent: false
      };

      if (nextCandidate) {
        result.candidate_name = nextCandidate.customer_name;

        // Get additional data for notification
        const service = await serviceRepo.findById(slot.service_id);
        const staff = await staffRepo.findById(slot.staff_id);
        const tenant = await this.db('tenants').where('id', tenantId).first();

        if (service && staff && tenant) {
          // Send notification to next candidate
          const notificationResult = await notificationService.sendNotification(
            nextCandidate,
            slot,
            service,
            staff,
            tenant.name
          );

          result.notification_sent = notificationResult.success;
          
          if (!notificationResult.success) {
            result.error = notificationResult.error;
          }
        } else {
          result.error = 'Missing required data for notification';
        }
      }

      const duration = Date.now() - startTime;
      const message = `Cascade processed for slot ${slotId}: ${result.next_candidate_found ? `notified ${result.candidate_name}` : 'no candidates found'} in ${duration}ms`;
      
      console.log(`[NotificationCascade] Job ${job.id} completed: ${message}`);

      return {
        success: true,
        message,
        data: result
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = `Cascade job failed after ${duration}ms: ${error.message}`;
      
      console.error(`[NotificationCascade] Job ${job.id} failed:`, error);

      return {
        success: false,
        message: errorMsg,
        error: error.message
      };
    }
  }

  /**
   * Retry failed notification with exponential backoff
   */
  async retryFailedNotification(job: Job<RetryNotificationJobData>): Promise<JobResult> {
    const { tenantId, notificationId, retryCount } = job.data;
    const startTime = Date.now();

    try {
      console.log(`[RetryNotification] Starting job ${job.id} for notification ${notificationId}, attempt ${retryCount + 1}`);

      const notificationService = new NotificationService(this.db, tenantId);
      
      // Retry the notification
      const result = await notificationService.retryFailedNotification(notificationId, retryCount);
      
      const duration = Date.now() - startTime;
      const message = `Retry ${result.success ? 'succeeded' : 'failed'} for notification ${notificationId} in ${duration}ms`;
      
      console.log(`[RetryNotification] Job ${job.id} completed: ${message}`);

      return {
        success: result.success,
        message,
        data: { notificationId, retryCount, result },
        error: result.error
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = `Retry job failed after ${duration}ms: ${error.message}`;
      
      console.error(`[RetryNotification] Job ${job.id} failed:`, error);

      return {
        success: false,
        message: errorMsg,
        error: error.message
      };
    }
  }

  /**
   * Cleanup old completed and failed jobs
   */
  async cleanupOldJobs(job: Job<CleanupJobData>): Promise<JobResult> {
    const { olderThanDays } = job.data;
    const startTime = Date.now();

    try {
      console.log(`[Cleanup] Starting job ${job.id} to clean jobs older than ${olderThanDays} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Clean up old notifications
      const deletedNotifications = await this.db('notifications')
        .where('created_at', '<', cutoffDate)
        .whereIn('status', ['sent', 'delivered', 'failed'])
        .del();

      // Clean up old audit logs (if they exist)
      let deletedAuditLogs = 0;
      try {
        deletedAuditLogs = await this.db('audit_logs')
          .where('created_at', '<', cutoffDate)
          .del();
      } catch (error) {
        // Audit logs table might not exist yet
        console.log('[Cleanup] Audit logs table not found, skipping');
      }

      const duration = Date.now() - startTime;
      const message = `Cleaned up ${deletedNotifications} notifications and ${deletedAuditLogs} audit logs older than ${olderThanDays} days in ${duration}ms`;
      
      console.log(`[Cleanup] Job ${job.id} completed: ${message}`);

      return {
        success: true,
        message,
        data: {
          deleted_notifications: deletedNotifications,
          deleted_audit_logs: deletedAuditLogs,
          cutoff_date: cutoffDate
        }
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = `Cleanup job failed after ${duration}ms: ${error.message}`;
      
      console.error(`[Cleanup] Job ${job.id} failed:`, error);

      return {
        success: false,
        message: errorMsg,
        error: error.message
      };
    }
  }

  /**
   * Get job processing statistics
   */
  async getJobStats(hours: number = 24): Promise<{
    expired_holds: { completed: number; failed: number; avg_duration_ms: number };
    notification_cascade: { completed: number; failed: number; avg_duration_ms: number };
    retry_notification: { completed: number; failed: number; avg_duration_ms: number };
    cleanup: { completed: number; failed: number; avg_duration_ms: number };
  }> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    // This would typically be stored in a job_stats table
    // For now, return mock data structure
    return {
      expired_holds: { completed: 0, failed: 0, avg_duration_ms: 0 },
      notification_cascade: { completed: 0, failed: 0, avg_duration_ms: 0 },
      retry_notification: { completed: 0, failed: 0, avg_duration_ms: 0 },
      cleanup: { completed: 0, failed: 0, avg_duration_ms: 0 }
    };
  }
}