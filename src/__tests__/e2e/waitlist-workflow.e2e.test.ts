import request from 'supertest';
import { app } from '../../index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import { createTestTenant, createTestUser } from '../helpers/fixtures';

describe('End-to-End Waitlist Workflow', () => {
  let tenantId: string;
  let authToken: string;
  let staffId: string;
  let serviceId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test tenant and user
    const tenant = await createTestTenant();
    tenantId = tenant.id;
    
    const user = await createTestUser(tenantId);
    
    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    // Create test staff and service for each test
    const staffResponse = await request(app)
      .post('/api/staff')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Staff',
        role: 'Stylist'
      });
    staffId = staffResponse.body.id;

    const serviceResponse = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00
      });
    serviceId = serviceResponse.body.id;
  });

  describe('Complete Waitlist Flow: Signup → Slot Opens → Notification → Confirmation → Booking', () => {
    it('should complete the full waitlist workflow successfully', async () => {
      // Step 1: Customer joins waitlist
      const waitlistResponse = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
          consent: true
        });

      expect(waitlistResponse.status).toBe(201);
      const waitlistEntryId = waitlistResponse.body.id;

      // Step 2: Business owner creates a slot
      const slotTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
      const slotResponse = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: slotTime.toISOString(),
          end_time: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString()
        });

      expect(slotResponse.status).toBe(201);
      const slotId = slotResponse.body.id;

      // Step 3: Mark slot as open (triggers waitlist matching)
      const openSlotResponse = await request(app)
        .post(`/api/slots/${slotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(openSlotResponse.status).toBe(200);
      expect(openSlotResponse.body.candidates_notified).toBe(1);

      // Step 4: Verify slot is held
      const slotStatusResponse = await request(app)
        .get(`/api/slots/${slotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(slotStatusResponse.body.status).toBe('held');
      expect(slotStatusResponse.body.hold_expires_at).toBeTruthy();

      // Step 5: Verify waitlist entry status updated
      const waitlistStatusResponse = await request(app)
        .get(`/api/waitlist/${waitlistEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(waitlistStatusResponse.body.status).toBe('notified');

      // Step 6: Simulate customer confirmation (get token from notification)
      // In real scenario, token would be in email. Here we'll generate it directly
      const tokenResponse = await request(app)
        .get(`/api/waitlist/${waitlistEntryId}/token`)
        .set('Authorization', `Bearer ${authToken}`);

      const confirmToken = tokenResponse.body.token;

      // Step 7: Customer confirms the slot
      const confirmResponse = await request(app)
        .post(`/api/confirm/${confirmToken}`);

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.message).toContain('confirmed');

      // Step 8: Verify final states
      const finalSlotResponse = await request(app)
        .get(`/api/slots/${slotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalSlotResponse.body.status).toBe('booked');

      const finalWaitlistResponse = await request(app)
        .get(`/api/waitlist/${waitlistEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalWaitlistResponse.body.status).toBe('confirmed');
    });

    it('should handle decline and cascade to next candidate', async () => {
      // Create two waitlist entries
      const waitlist1Response = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          consent: true,
          vip_status: true // Higher priority
        });

      const waitlist2Response = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'Jane Smith',
          phone: '+1234567891',
          email: 'jane@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          consent: true
        });

      const waitlistEntry1Id = waitlist1Response.body.id;
      const waitlistEntry2Id = waitlist2Response.body.id;

      // Create and open slot
      const slotTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const slotResponse = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: slotTime.toISOString(),
          end_time: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString()
        });

      const slotId = slotResponse.body.id;

      await request(app)
        .post(`/api/slots/${slotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      // First customer (VIP) should be notified
      const waitlist1Status = await request(app)
        .get(`/api/waitlist/${waitlistEntry1Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(waitlist1Status.body.status).toBe('notified');

      // Get decline token and decline
      const tokenResponse = await request(app)
        .get(`/api/waitlist/${waitlistEntry1Id}/token`)
        .set('Authorization', `Bearer ${authToken}`);

      const declineToken = tokenResponse.body.token;

      const declineResponse = await request(app)
        .post(`/api/decline/${declineToken}`);

      expect(declineResponse.status).toBe(200);

      // Wait a moment for cascade processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second customer should now be notified
      const waitlist2Status = await request(app)
        .get(`/api/waitlist/${waitlistEntry2Id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(waitlist2Status.body.status).toBe('notified');

      // Slot should still be held
      const slotStatus = await request(app)
        .get(`/api/slots/${slotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(slotStatus.body.status).toBe('held');
    });

    it('should handle expired holds and release slots', async () => {
      // Create waitlist entry
      const waitlistResponse = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          consent: true
        });

      const waitlistEntryId = waitlistResponse.body.id;

      // Create and open slot
      const slotTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const slotResponse = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: slotTime.toISOString(),
          end_time: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString()
        });

      const slotId = slotResponse.body.id;

      await request(app)
        .post(`/api/slots/${slotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      // Manually expire the hold by updating database
      // This simulates the background job processing
      await request(app)
        .post('/api/test/expire-holds')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ slot_id: slotId });

      // Verify slot is back to open
      const slotStatus = await request(app)
        .get(`/api/slots/${slotId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(slotStatus.body.status).toBe('open');

      // Verify waitlist entry is back to active
      const waitlistStatus = await request(app)
        .get(`/api/waitlist/${waitlistEntryId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(waitlistStatus.body.status).toBe('active');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should prevent double booking attempts', async () => {
      // Create waitlist entry
      const waitlistResponse = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          consent: true
        });

      const waitlistEntryId = waitlistResponse.body.id;

      // Create and open slot
      const slotTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const slotResponse = await request(app)
        .post('/api/slots')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          staff_id: staffId,
          service_id: serviceId,
          start_time: slotTime.toISOString(),
          end_time: new Date(slotTime.getTime() + 60 * 60 * 1000).toISOString()
        });

      const slotId = slotResponse.body.id;

      await request(app)
        .post(`/api/slots/${slotId}/open`)
        .set('Authorization', `Bearer ${authToken}`);

      // Get confirmation token
      const tokenResponse = await request(app)
        .get(`/api/waitlist/${waitlistEntryId}/token`)
        .set('Authorization', `Bearer ${authToken}`);

      const confirmToken = tokenResponse.body.token;

      // First confirmation should succeed
      const firstConfirm = await request(app)
        .post(`/api/confirm/${confirmToken}`);

      expect(firstConfirm.status).toBe(200);

      // Second confirmation attempt should fail
      const secondConfirm = await request(app)
        .post(`/api/confirm/${confirmToken}`);

      expect(secondConfirm.status).toBe(400);
      expect(secondConfirm.body.error.code).toBe('SLOT_ALREADY_BOOKED');
    });

    it('should handle expired confirmation tokens', async () => {
      // Create waitlist entry
      const waitlistResponse = await request(app)
        .post('/api/waitlist')
        .send({
          customer_name: 'John Doe',
          phone: '+1234567890',
          email: 'john@example.com',
          service_id: serviceId,
          staff_id: staffId,
          earliest_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          consent: true
        });

      const waitlistEntryId = waitlistResponse.body.id;

      // Create expired token (simulate by creating token with past expiry)
      const expiredTokenResponse = await request(app)
        .post('/api/test/create-expired-token')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          waitlist_entry_id: waitlistEntryId,
          slot_id: 'test-slot-id'
        });

      const expiredToken = expiredTokenResponse.body.token;

      // Attempt to confirm with expired token
      const confirmResponse = await request(app)
        .post(`/api/confirm/${expiredToken}`);

      expect(confirmResponse.status).toBe(400);
      expect(confirmResponse.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });
});