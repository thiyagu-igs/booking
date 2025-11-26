import db from '../../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { 
  Tenant, 
  User, 
  Staff, 
  Service, 
  WaitlistEntry, 
  Slot 
} from '../../models';

export async function setupTestDatabase(): Promise<void> {
  // Run migrations
  await db.migrate.latest();
  
  // Clear all test data
  await cleanupTestDatabase();
}

export async function cleanupTestDatabase(): Promise<void> {
  // Delete in reverse dependency order
  await db('audit_logs').del();
  await db('notifications').del();
  await db('calendar_events').del();
  await db('waitlist_entries').del();
  await db('slots').del();
  await db('services').del();
  await db('staff').del();
  await db('users').del();
  await db('tenants').del();
}

export async function createTestTenant(data: Partial<Tenant> = {}): Promise<Tenant> {
  const tenant: Partial<Tenant> = {
    id: uuidv4(),
    name: 'Test Business',
    timezone: 'America/New_York',
    ...data
  };
  
  await db('tenants').insert(tenant);
  return tenant as Tenant;
}

export async function createTestUser(tenantId: string, data: Partial<User> = {}): Promise<User> {
  const bcrypt = require('bcryptjs');
  const hashedPassword: string = await bcrypt.hash('testpassword123', 10);
  
  const user: Partial<User> = {
    id: uuidv4(),
    tenant_id: tenantId,
    email: 'test@example.com',
    password_hash: hashedPassword,
    role: 'admin',
    ...data
  };
  
  await db('users').insert(user);
  return user as User;
}

export async function createTestStaff(tenantId: string, data: Partial<Staff> = {}): Promise<Staff> {
  const staff: Partial<Staff> = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: 'Test Staff',
    role: 'Stylist',
    active: true,
    ...data
  };
  
  await db('staff').insert(staff);
  return staff as Staff;
}

export async function createTestService(tenantId: string, data: Partial<Service> = {}): Promise<Service> {
  const service: Partial<Service> = {
    id: uuidv4(),
    tenant_id: tenantId,
    name: 'Test Service',
    duration_minutes: 60,
    price: 50.00,
    active: true,
    ...data
  };
  
  await db('services').insert(service);
  return service as Service;
}

export async function createTestWaitlistEntry(tenantId: string, serviceId: string, data: Partial<WaitlistEntry> = {}): Promise<WaitlistEntry> {
  const entry: Partial<WaitlistEntry> = {
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
  
  await db('waitlist_entries').insert(entry);
  return entry as WaitlistEntry;
}

export async function createTestSlot(tenantId: string, staffId: string, serviceId: string, data: Partial<Slot> = {}): Promise<Slot> {
  const slot: Partial<Slot> = {
    id: uuidv4(),
    tenant_id: tenantId,
    staff_id: staffId,
    service_id: serviceId,
    start_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
    end_time: new Date(Date.now() + 3 * 60 * 60 * 1000),
    status: 'open',
    ...data
  };
  
  await db('slots').insert(slot);
  return slot as Slot;
}