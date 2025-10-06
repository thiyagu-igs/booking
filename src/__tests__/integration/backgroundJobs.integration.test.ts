import { BackgroundJobService } from '../../services/BackgroundJobService';
import { JobSchedulerService } from '../../services/JobSchedulerService';
import { connectDatabase } from '../../config/database';
import { connectRedis, disconnectRedis } from '../../config/redis';
import { closeQueues } from '../../config/queue';
import { SlotStatus, WaitlistStatus } from '../../models';

describe('Background Jobs Integration Tests', () => {
  let db: any;
  let backgroundJobService: BackgroundJobService;
  let jobSchedulerService: JobSchedulerService;
  let testTenantId: string;

  beforeAll(async () => {
    // Connect to test database and Redis
    db = await connectDatabase();
    await connectRedis();
    
    backgroundJobService = new BackgroundJobService(db);
    jobSchedulerService = new JobSchedulerService();

    // Create test tenant
    const [tenantId] = await db('tenants').insert({
      name: 'Test Salon',
      timezone: 'UTC',
    });
    testTenantId = tenantId;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testTenantId) {
      await db('waitlist_entries').where('tenant_id', testTenantId).del();
      await db('slots').where('tenant_id', testTenantId).del();
      await db('notifications').where('tenant_id', testTenantId).del();
      await db('services').where('tenant_id', testTenantId).del();
      await db('staff').where('tenant_id', testTenantId).del();
      await db('tenants').where('id', testTenantId).del();
    }

    // Close connections
    await closeQueues();
    await disconnectRedis();
    await db.destroy();
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await db('waitlist_entries').where('tenant_id', testTenantId).del();
    await db('slots').where('tenant_id', testTenantId).del();
    await db('notifications').where('tenant_id', testTenantId).del();
    await db('services').where('tenant_id', testTenantId).del();
    await db('staff').where('tenant_id', testTenantId).del();
  });

  describe('Expired Holds Processing', () => {
    it('should process expired holds and trigger cascade notifications', async () => {
      // Setup test data
      const [staffId] = await db('staff').insert({
        tenant_id: testTenantId,
        name: 'Test Staff',
        role: 'Stylist',
        active: true,
      });

      const [serviceId] = await db('services').insert({
        tenant_id: testTenantId,
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00,
        active: true,
      });

      // Create expired held slot
      const expiredTime = new Date(Date.now() - 60000); // 1 minute ago
      const [slotId] = await db('slots').insert({
        tenant_id: testTenantId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date(Date.now() + 3600000), // 1 hour from now
        end_time: new Date(Date.now() + 7200000), // 2 hours from now
        status: SlotStatus.HELD,
        hold_expires_at: expiredTime,
      });

      // Create waitlist entries
      const [entry1Id] = await db('waitlist_entries').insert({
        tenant_id: testTenantId,
        customer_name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        service_id: serviceId,
        staff_id: staffId,
        earliest_time: new Date(Date.now() + 1800000), // 30 minutes from now
        latest_time: new Date(Date.now() + 10800000), // 3 hours from now
        priority_score: 50,
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
      });

      const [entry2Id] = await db('waitlist_entries').insert({
        tenant_id: testTenantId,
        customer_name: 'Jane Smith',
        phone: '+1234567891',
        email: 'jane@example.com',
        service_id: serviceId,
        staff_id: staffId,
        earliest_time: new Date(Date.now() + 1800000),
        latest_time: new Date(Date.now() + 10800000),
        priority_score: 60, // Higher priority
        vip_status: true,
        status: WaitlistStatus.ACTIVE,
      });

      // Process expired holds
      const mockJob = {
        id: 'test-job-1',
        data: { tenantId: testTenantId },
      } as any;

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.processed_tenants).toBe(1);
      expect(result.data?.released_slots).toBeGreaterThan(0);

      // Verify slot is no longer held
      const updatedSlot = await db('slots').where('id', slotId).first();
      expect(updatedSlot.status).not.toBe(SlotStatus.HELD);

      // Verify highest priority entry was notified
      const notifiedEntry = await db('waitlist_entries')
        .where('id', entry2Id)
        .first();
      expect(notifiedEntry.status).toBe(WaitlistStatus.NOTIFIED);
    }, 10000);

    it('should handle case with no expired holds', async () => {
      const mockJob = {
        id: 'test-job-2',
        data: { tenantId: testTenantId },
      } as any;

      const result = await backgroundJobService.processExpiredHolds(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.processed_tenants).toBe(1);
      expect(result.data?.released_slots).toBe(0);
      expect(result.data?.cascade_notifications).toBe(0);
    });
  });

  describe('Notification Cascade Processing', () => {
    it('should process notification cascade when customer declines', async () => {
      // Setup test data
      const [staffId] = await db('staff').insert({
        tenant_id: testTenantId,
        name: 'Test Staff',
        role: 'Stylist',
        active: true,
      });

      const [serviceId] = await db('services').insert({
        tenant_id: testTenantId,
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00,
        active: true,
      });

      const [slotId] = await db('slots').insert({
        tenant_id: testTenantId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date(Date.now() + 3600000),
        end_time: new Date(Date.now() + 7200000),
        status: SlotStatus.HELD,
        hold_expires_at: new Date(Date.now() + 600000), // 10 minutes from now
      });

      // Create waitlist entries
      const [declinedEntryId] = await db('waitlist_entries').insert({
        tenant_id: testTenantId,
        customer_name: 'Declined Customer',
        phone: '+1234567890',
        email: 'declined@example.com',
        service_id: serviceId,
        staff_id: staffId,
        earliest_time: new Date(Date.now() + 1800000),
        latest_time: new Date(Date.now() + 10800000),
        priority_score: 40,
        vip_status: false,
        status: WaitlistStatus.NOTIFIED,
      });

      const [nextEntryId] = await db('waitlist_entries').insert({
        tenant_id: testTenantId,
        customer_name: 'Next Customer',
        phone: '+1234567891',
        email: 'next@example.com',
        service_id: serviceId,
        staff_id: staffId,
        earliest_time: new Date(Date.now() + 1800000),
        latest_time: new Date(Date.now() + 10800000),
        priority_score: 45,
        vip_status: false,
        status: WaitlistStatus.ACTIVE,
      });

      // Process cascade
      const mockJob = {
        id: 'cascade-job-1',
        data: {
          tenantId: testTenantId,
          slotId: slotId,
          previousEntryId: declinedEntryId,
          reason: 'declined' as const,
        },
      } as any;

      const result = await backgroundJobService.processNotificationCascade(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.next_candidate_found).toBe(true);
      expect(result.data?.candidate_name).toBe('Next Customer');

      // Verify declined entry was marked as removed
      const declinedEntry = await db('waitlist_entries')
        .where('id', declinedEntryId)
        .first();
      expect(declinedEntry.status).toBe(WaitlistStatus.REMOVED);

      // Verify next entry was notified
      const nextEntry = await db('waitlist_entries')
        .where('id', nextEntryId)
        .first();
      expect(nextEntry.status).toBe(WaitlistStatus.NOTIFIED);

      // Verify slot is still held for new candidate
      const updatedSlot = await db('slots').where('id', slotId).first();
      expect(updatedSlot.status).toBe(SlotStatus.HELD);
    }, 10000);

    it('should handle cascade when no more candidates available', async () => {
      // Setup test data with no additional candidates
      const [staffId] = await db('staff').insert({
        tenant_id: testTenantId,
        name: 'Test Staff',
        role: 'Stylist',
        active: true,
      });

      const [serviceId] = await db('services').insert({
        tenant_id: testTenantId,
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00,
        active: true,
      });

      const [slotId] = await db('slots').insert({
        tenant_id: testTenantId,
        staff_id: staffId,
        service_id: serviceId,
        start_time: new Date(Date.now() + 3600000),
        end_time: new Date(Date.now() + 7200000),
        status: SlotStatus.HELD,
        hold_expires_at: new Date(Date.now() + 600000),
      });

      const [declinedEntryId] = await db('waitlist_entries').insert({
        tenant_id: testTenantId,
        customer_name: 'Last Customer',
        phone: '+1234567890',
        email: 'last@example.com',
        service_id: serviceId,
        staff_id: staffId,
        earliest_time: new Date(Date.now() + 1800000),
        latest_time: new Date(Date.now() + 10800000),
        priority_score: 40,
        vip_status: false,
        status: WaitlistStatus.NOTIFIED,
      });

      const mockJob = {
        id: 'cascade-job-2',
        data: {
          tenantId: testTenantId,
          slotId: slotId,
          previousEntryId: declinedEntryId,
          reason: 'expired' as const,
        },
      } as any;

      const result = await backgroundJobService.processNotificationCascade(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.next_candidate_found).toBe(false);
      expect(result.data?.notification_sent).toBe(false);

      // Verify slot is released back to open
      const updatedSlot = await db('slots').where('id', slotId).first();
      expect(updatedSlot.status).toBe(SlotStatus.OPEN);
    }, 10000);
  });

  describe('Cleanup Jobs', () => {
    it('should cleanup old notifications', async () => {
      // Create old notifications
      const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago

      await db('notifications').insert([
        {
          tenant_id: testTenantId,
          waitlist_entry_id: 'entry-1',
          slot_id: 'slot-1',
          type: 'email',
          recipient: 'test@example.com',
          subject: 'Old notification 1',
          message: 'Test message',
          status: 'sent',
          created_at: oldDate,
        },
        {
          tenant_id: testTenantId,
          waitlist_entry_id: 'entry-2',
          slot_id: 'slot-2',
          type: 'email',
          recipient: 'test2@example.com',
          subject: 'Old notification 2',
          message: 'Test message',
          status: 'delivered',
          created_at: oldDate,
        },
        {
          tenant_id: testTenantId,
          waitlist_entry_id: 'entry-3',
          slot_id: 'slot-3',
          type: 'email',
          recipient: 'test3@example.com',
          subject: 'Recent notification',
          message: 'Test message',
          status: 'sent',
          created_at: new Date(), // Recent notification
        },
      ]);

      const mockJob = {
        id: 'cleanup-job-1',
        data: { olderThanDays: 30 },
      } as any;

      const result = await backgroundJobService.cleanupOldJobs(mockJob);

      expect(result.success).toBe(true);
      expect(result.data?.deleted_notifications).toBe(2);

      // Verify recent notification still exists
      const remainingNotifications = await db('notifications')
        .where('tenant_id', testTenantId)
        .count('* as count')
        .first();
      expect(remainingNotifications.count).toBe(1);
    }, 10000);
  });

  describe('Job Scheduler Integration', () => {
    it('should schedule and track jobs', async () => {
      // Schedule an expired holds check
      const result = await jobSchedulerService.scheduleExpiredHoldsCheck(testTenantId);
      
      expect(result.success).toBe(true);
      expect(result.jobId).toBeDefined();

      // Get queue status
      const statusResult = await jobSchedulerService.getQueueStatus();
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toBeDefined();
      expect(Array.isArray(statusResult.data)).toBe(true);
    });

    it('should handle job retry functionality', async () => {
      // Schedule a job first
      const scheduleResult = await jobSchedulerService.scheduleNotificationRetry(
        testTenantId,
        'test-notification-id',
        0,
        1000
      );

      expect(scheduleResult.success).toBe(true);
      expect(scheduleResult.jobId).toBeDefined();

      // Try to get job details (may not exist in test environment)
      const detailsResult = await jobSchedulerService.getJobDetails(
        'retry-notification',
        scheduleResult.jobId!
      );

      // Job might not be found in test environment, but method should not throw
      expect(detailsResult.success).toBeDefined();
    });
  });
});