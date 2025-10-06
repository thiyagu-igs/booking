import { knex } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

export async function setupTestDatabase(): Promise<void> {
  // Run migrations
  await knex.migrate.latest();
  
  // Clear all test data
  await cleanupTestDatabase();
}

export async function cleanupTestDatabase(): Promise<void> {
  // Delete in reverse dependency order
  await knex('audit_logs').del();
  await knex('notifications').del();
  await knex('calendar_events').del();
  await knex('waitlist_entries').del();
  await knex('slots').del();
  await knex('services').del();
  await knex('staff').del();
  await knex('users').del();
  await knex('tenants').del();
}

export async function createTestTenant(data: Partial<any> = {}): Promise<any> {
  const tenant = {
    id: uuidv4(),
    name: 'Test Business',
    timezone: 'America/New_York',
    ...data
  };
  
  await knex('tenants').insert(tenant);
  return tenant;
}

export async function createTestUser(tenantId: string, data: Partial<any> = {}): Promise<any> {
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  
  const user = {
    id: uuidv4(),
    tenant_id: tenantId,
    email: 'test@example.com',
    password_hash: hashedPassword,
    role: 'admin',
    ...data
  };
  
  await knex('users').insert(user);
  return user;
}

export async function createTestStaff(tenantId: string, data: Partial<any> = {}): Promise<any> {
  const staff = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: 'Test Staff',
    role: 'Stylist',
    active: true,
    ...data
  };
  
  await knex('staff').insert(staff);
  return staff;
}

export async function createTestService(tenantId: string, data: Partial<any> = {}): Promise<any> {
  const service = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: 'Test Service',
    duration_minutes: 60,
    price: 50.00,
    active: true,
    ...data
  };
  
  await knex('services').insert(service);
  return service;
}

export async function createTestWaitlistEntry(tenantId: string, serviceId: string, data: Partial<any> = {}): Promise<any> {
  const entry = {
    id: uuidv4(),
    tenant_id: tenantId,
    customer_name: 'Test Customer',
    phone: '+1234567890',
    email: 'customer@example.com',
    service_id: serviceId,
    earliest_time: new Date(Date.now() + 60 * 60 * 1000),
    latest_time: new Date(Date.now() + 4 * 60 * 60 * 1000),
    priority_score: 50,
    status: 'active',
    ...data
  };
  
  await knex('waitlist_entries').insert(entry);
  return entry;
}

export async function createTestSlot(tenantId: string, staffId: string, serviceId: string, data: Partial<any> = {}): Promise<any> {
  const slot = {
    id: uuidv4(),
    tenant_id: tenantId,
    staff_id: staffId,
    service_id: serviceId,
    start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
    end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
    status: 'open',
    ...data
  };
  
  await knex('slots').insert(slot);
  return slot;
}