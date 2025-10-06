import {
  tenantSchema,
  updateTenantSchema,
  staffSchema,
  updateStaffSchema,
  serviceSchema,
  updateServiceSchema,
  slotSchema,
  updateSlotSchema,
  waitlistEntrySchema,
  updateWaitlistEntrySchema,
  notificationSchema,
  bookingSchema,
  updateBookingSchema,
  paginationSchema,
  dateRangeSchema,
  validateSchema
} from '../../validation/schemas';

describe('Validation Schemas', () => {
  describe('tenantSchema', () => {
    it('should validate valid tenant data', () => {
      const validTenant = {
        name: 'Test Salon',
        timezone: 'America/New_York'
      };

      const { error, value } = validateSchema(tenantSchema, validTenant);

      expect(error).toBeUndefined();
      expect(value).toEqual(validTenant);
    });

    it('should use default timezone if not provided', () => {
      const tenantWithoutTimezone = {
        name: 'Test Salon'
      };

      const { error, value } = validateSchema(tenantSchema, tenantWithoutTimezone);

      expect(error).toBeUndefined();
      expect(value?.timezone).toBe('UTC');
    });

    it('should reject invalid timezone', () => {
      const invalidTenant = {
        name: 'Test Salon',
        timezone: 'Invalid/Timezone'
      };

      const { error } = validateSchema(tenantSchema, invalidTenant);

      expect(error).toBeDefined();
      expect(error).toContain('timezone');
    });

    it('should reject empty name', () => {
      const invalidTenant = {
        name: '',
        timezone: 'UTC'
      };

      const { error } = validateSchema(tenantSchema, invalidTenant);

      expect(error).toBeDefined();
      expect(error).toContain('name');
    });

    it('should reject missing name', () => {
      const invalidTenant = {
        timezone: 'UTC'
      };

      const { error } = validateSchema(tenantSchema, invalidTenant);

      expect(error).toBeDefined();
      expect(error).toContain('name');
    });
  });

  describe('staffSchema', () => {
    it('should validate valid staff data', () => {
      const validStaff = {
        name: 'John Doe',
        role: 'Stylist',
        active: true
      };

      const { error, value } = validateSchema(staffSchema, validStaff);

      expect(error).toBeUndefined();
      expect(value).toEqual(validStaff);
    });

    it('should use default active status', () => {
      const staffWithoutActive = {
        name: 'John Doe',
        role: 'Stylist'
      };

      const { error, value } = validateSchema(staffSchema, staffWithoutActive);

      expect(error).toBeUndefined();
      expect(value?.active).toBe(true);
    });

    it('should allow optional role', () => {
      const staffWithoutRole = {
        name: 'John Doe',
        active: true
      };

      const { error, value } = validateSchema(staffSchema, staffWithoutRole);

      expect(error).toBeUndefined();
      expect(value?.name).toBe('John Doe');
    });

    it('should reject empty name', () => {
      const invalidStaff = {
        name: '',
        role: 'Stylist'
      };

      const { error } = validateSchema(staffSchema, invalidStaff);

      expect(error).toBeDefined();
      expect(error).toContain('name');
    });
  });

  describe('serviceSchema', () => {
    it('should validate valid service data', () => {
      const validService = {
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00,
        active: true
      };

      const { error, value } = validateSchema(serviceSchema, validService);

      expect(error).toBeUndefined();
      expect(value).toEqual(validService);
    });

    it('should use default active status', () => {
      const serviceWithoutActive = {
        name: 'Haircut',
        duration_minutes: 60,
        price: 50.00
      };

      const { error, value } = validateSchema(serviceSchema, serviceWithoutActive);

      expect(error).toBeUndefined();
      expect(value?.active).toBe(true);
    });

    it('should allow optional price', () => {
      const serviceWithoutPrice = {
        name: 'Consultation',
        duration_minutes: 30,
        active: true
      };

      const { error, value } = validateSchema(serviceSchema, serviceWithoutPrice);

      expect(error).toBeUndefined();
      expect(value?.name).toBe('Consultation');
    });

    it('should reject invalid duration', () => {
      const invalidService = {
        name: 'Haircut',
        duration_minutes: 0,
        price: 50.00
      };

      const { error } = validateSchema(serviceSchema, invalidService);

      expect(error).toBeDefined();
      expect(error).toContain('duration_minutes');
    });

    it('should reject duration over 24 hours', () => {
      const invalidService = {
        name: 'Haircut',
        duration_minutes: 1500, // Over 24 hours
        price: 50.00
      };

      const { error } = validateSchema(serviceSchema, invalidService);

      expect(error).toBeDefined();
      expect(error).toContain('duration_minutes');
    });

    it('should reject negative price', () => {
      const invalidService = {
        name: 'Haircut',
        duration_minutes: 60,
        price: -10.00
      };

      const { error } = validateSchema(serviceSchema, invalidService);

      expect(error).toBeDefined();
      expect(error).toContain('price');
    });
  });

  describe('slotSchema', () => {
    it('should validate valid slot data', () => {
      const validSlot = {
        staff_id: '550e8400-e29b-41d4-a716-446655440000',
        service_id: '550e8400-e29b-41d4-a716-446655440001',
        start_time: '2024-01-15T10:00:00.000Z',
        end_time: '2024-01-15T11:00:00.000Z',
        status: 'open'
      };

      const { error, value } = validateSchema(slotSchema, validSlot);

      expect(error).toBeUndefined();
      expect(value?.status).toBe('open');
    });

    it('should use default status', () => {
      const slotWithoutStatus = {
        staff_id: '550e8400-e29b-41d4-a716-446655440000',
        service_id: '550e8400-e29b-41d4-a716-446655440001',
        start_time: '2024-01-15T10:00:00.000Z',
        end_time: '2024-01-15T11:00:00.000Z'
      };

      const { error, value } = validateSchema(slotSchema, slotWithoutStatus);

      expect(error).toBeUndefined();
      expect(value?.status).toBe('open');
    });

    it('should reject invalid UUID for staff_id', () => {
      const invalidSlot = {
        staff_id: 'invalid-uuid',
        service_id: '550e8400-e29b-41d4-a716-446655440001',
        start_time: '2024-01-15T10:00:00.000Z',
        end_time: '2024-01-15T11:00:00.000Z'
      };

      const { error } = validateSchema(slotSchema, invalidSlot);

      expect(error).toBeDefined();
      expect(error).toContain('staff_id');
    });

    it('should reject end_time before start_time', () => {
      const invalidSlot = {
        staff_id: '550e8400-e29b-41d4-a716-446655440000',
        service_id: '550e8400-e29b-41d4-a716-446655440001',
        start_time: '2024-01-15T11:00:00.000Z',
        end_time: '2024-01-15T10:00:00.000Z'
      };

      const { error } = validateSchema(slotSchema, invalidSlot);

      expect(error).toBeDefined();
      expect(error).toContain('end_time');
    });

    it('should reject invalid status', () => {
      const invalidSlot = {
        staff_id: '550e8400-e29b-41d4-a716-446655440000',
        service_id: '550e8400-e29b-41d4-a716-446655440001',
        start_time: '2024-01-15T10:00:00.000Z',
        end_time: '2024-01-15T11:00:00.000Z',
        status: 'invalid_status'
      };

      const { error } = validateSchema(slotSchema, invalidSlot);

      expect(error).toBeDefined();
      expect(error).toContain('status');
    });
  });

  describe('waitlistEntrySchema', () => {
    it('should validate valid waitlist entry data', () => {
      const validEntry = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        email: 'jane@example.com',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        staff_id: '550e8400-e29b-41d4-a716-446655440001',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z',
        vip_status: false
      };

      const { error, value } = validateSchema(waitlistEntrySchema, validEntry);

      expect(error).toBeUndefined();
      expect(value?.customer_name).toBe('Jane Doe');
      expect(value?.phone).toBe('+1234567890');
      expect(value?.vip_status).toBe(false);
    });

    it('should use default vip_status', () => {
      const entryWithoutVip = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        email: 'jane@example.com',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z'
      };

      const { error, value } = validateSchema(waitlistEntrySchema, entryWithoutVip);

      expect(error).toBeUndefined();
      expect(value?.vip_status).toBe(false);
    });

    it('should allow optional staff_id', () => {
      const entryWithoutStaff = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        email: 'jane@example.com',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z'
      };

      const { error, value } = validateSchema(waitlistEntrySchema, entryWithoutStaff);

      expect(error).toBeUndefined();
      expect(value?.customer_name).toBe('Jane Doe');
    });

    it('should allow optional email', () => {
      const entryWithoutEmail = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z'
      };

      const { error, value } = validateSchema(waitlistEntrySchema, entryWithoutEmail);

      expect(error).toBeUndefined();
      expect(value?.customer_name).toBe('Jane Doe');
    });

    it('should reject invalid phone format', () => {
      const invalidEntry = {
        customer_name: 'Jane Doe',
        phone: '0123456789', // Invalid format (starts with 0)
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z'
      };

      const { error } = validateSchema(waitlistEntrySchema, invalidEntry);

      expect(error).toBeDefined();
      expect(error).toContain('Phone number');
    });

    it('should reject latest_time before earliest_time', () => {
      const invalidEntry = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T17:00:00.000Z',
        latest_time: '2024-01-15T09:00:00.000Z'
      };

      const { error } = validateSchema(waitlistEntrySchema, invalidEntry);

      expect(error).toBeDefined();
      expect(error).toContain('latest_time');
    });

    it('should reject invalid email format', () => {
      const invalidEntry = {
        customer_name: 'Jane Doe',
        phone: '+1234567890',
        email: 'invalid-email',
        service_id: '550e8400-e29b-41d4-a716-446655440000',
        earliest_time: '2024-01-15T09:00:00.000Z',
        latest_time: '2024-01-15T17:00:00.000Z'
      };

      const { error } = validateSchema(waitlistEntrySchema, invalidEntry);

      expect(error).toBeDefined();
      expect(error).toContain('email');
    });
  });

  describe('paginationSchema', () => {
    it('should validate valid pagination data', () => {
      const validPagination = {
        page: 2,
        limit: 50,
        sort_by: 'created_at',
        sort_order: 'desc'
      };

      const { error, value } = validateSchema(paginationSchema, validPagination);

      expect(error).toBeUndefined();
      expect(value).toEqual(validPagination);
    });

    it('should use default values', () => {
      const emptyPagination = {};

      const { error, value } = validateSchema(paginationSchema, emptyPagination);

      expect(error).toBeUndefined();
      expect(value?.page).toBe(1);
      expect(value?.limit).toBe(20);
      expect(value?.sort_order).toBe('asc');
    });

    it('should reject page less than 1', () => {
      const invalidPagination = {
        page: 0
      };

      const { error } = validateSchema(paginationSchema, invalidPagination);

      expect(error).toBeDefined();
      expect(error).toContain('page');
    });

    it('should reject limit over 100', () => {
      const invalidPagination = {
        limit: 150
      };

      const { error } = validateSchema(paginationSchema, invalidPagination);

      expect(error).toBeDefined();
      expect(error).toContain('limit');
    });

    it('should reject invalid sort_order', () => {
      const invalidPagination = {
        sort_order: 'invalid'
      };

      const { error } = validateSchema(paginationSchema, invalidPagination);

      expect(error).toBeDefined();
      expect(error).toContain('sort_order');
    });
  });

  describe('dateRangeSchema', () => {
    it('should validate valid date range', () => {
      const validRange = {
        start_date: '2024-01-01T00:00:00.000Z',
        end_date: '2024-01-31T23:59:59.000Z'
      };

      const { error, value } = validateSchema(dateRangeSchema, validRange);

      expect(error).toBeUndefined();
      expect(value?.start_date).toBeInstanceOf(Date);
      expect(value?.end_date).toBeInstanceOf(Date);
    });

    it('should allow optional dates', () => {
      const emptyRange = {};

      const { error, value } = validateSchema(dateRangeSchema, emptyRange);

      expect(error).toBeUndefined();
      expect(value).toEqual({});
    });

    it('should reject end_date before start_date', () => {
      const invalidRange = {
        start_date: '2024-01-31T00:00:00.000Z',
        end_date: '2024-01-01T00:00:00.000Z'
      };

      const { error } = validateSchema(dateRangeSchema, invalidRange);

      expect(error).toBeDefined();
      expect(error).toContain('end_date');
    });
  });

  describe('validateSchema helper', () => {
    it('should return error message for validation failures', () => {
      const invalidData = {
        name: '', // Empty name should fail
        timezone: 'UTC'
      };

      const { error, value } = validateSchema(tenantSchema, invalidData);

      expect(error).toBeDefined();
      expect(typeof error).toBe('string');
      expect(value).toBeUndefined();
    });

    it('should return value for successful validation', () => {
      const validData = {
        name: 'Test Tenant',
        timezone: 'UTC'
      };

      const { error, value } = validateSchema(tenantSchema, validData);

      expect(error).toBeUndefined();
      expect(value).toEqual(validData);
    });

    it('should strip unknown properties', () => {
      const dataWithExtra = {
        name: 'Test Tenant',
        timezone: 'UTC',
        extraProperty: 'should be removed'
      };

      const { error, value } = validateSchema(tenantSchema, dataWithExtra);

      expect(error).toBeUndefined();
      expect(value).not.toHaveProperty('extraProperty');
      expect(value?.name).toBe('Test Tenant');
    });
  });
});