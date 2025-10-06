import { createTestTenant, createTestUser, createTestStaff, createTestService } from './database';

export { createTestTenant, createTestUser, createTestStaff, createTestService };

export const mockSendGridResponse = {
  statusCode: 202,
  body: '',
  headers: {}
};

export const mockGoogleCalendarEvent = {
  id: 'test-event-id',
  summary: 'Test Appointment',
  start: { dateTime: new Date().toISOString() },
  end: { dateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  htmlLink: 'https://calendar.google.com/event/test'
};

export const mockRedisClient = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  exists: jest.fn()
};

export function createMockRequest(data: any = {}, user: any = null, tenantId: string = 'test-tenant') {
  return {
    body: data,
    params: {},
    query: {},
    headers: {},
    user,
    tenantId,
    ...data
  };
}

export function createMockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

export const testTenantData = {
  id: 'test-tenant-id',
  name: 'Test Business',
  timezone: 'America/New_York'
};

export const testUserData = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: 'admin'
};

export const testStaffData = {
  id: 'test-staff-id',
  name: 'Test Staff',
  role: 'Stylist',
  active: true
};

export const testServiceData = {
  id: 'test-service-id',
  name: 'Haircut',
  duration_minutes: 60,
  price: 50.00,
  active: true
};

export const testWaitlistEntryData = {
  id: 'test-waitlist-id',
  customer_name: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  service_id: 'test-service-id',
  staff_id: 'test-staff-id',
  earliest_time: new Date(Date.now() + 60 * 60 * 1000),
  latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000),
  priority_score: 50,
  status: 'active'
};

export const testSlotData = {
  id: 'test-slot-id',
  staff_id: 'test-staff-id',
  service_id: 'test-service-id',
  start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
  end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
  status: 'open'
};