import Joi from 'joi';

// Common validation patterns
const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });
const phoneSchema = Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).message('Phone number must be in valid international format');
const emailSchema = Joi.string().email();
const timezoneSchema = Joi.string().valid(
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney', 'America/Toronto', 'America/Vancouver'
);

// Tenant validation
export const tenantSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  timezone: timezoneSchema.default('UTC')
});

export const updateTenantSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  timezone: timezoneSchema
}).min(1);

// Staff validation
export const staffSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  role: Joi.string().max(100).optional(),
  active: Joi.boolean().default(true)
});

export const updateStaffSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  role: Joi.string().max(100).allow(null),
  active: Joi.boolean()
}).min(1);

// Service validation
export const serviceSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  duration_minutes: Joi.number().integer().min(1).max(1440).required(), // Max 24 hours
  price: Joi.number().precision(2).min(0).optional(),
  active: Joi.boolean().default(true)
});

export const updateServiceSchema = Joi.object({
  name: Joi.string().min(1).max(255),
  duration_minutes: Joi.number().integer().min(1).max(1440),
  price: Joi.number().precision(2).min(0).allow(null),
  active: Joi.boolean()
}).min(1);

// Slot validation
export const slotSchema = Joi.object({
  staff_id: uuidSchema.required(),
  service_id: uuidSchema.required(),
  start_time: Joi.date().iso().required(),
  end_time: Joi.date().iso().greater(Joi.ref('start_time')).required(),
  status: Joi.string().valid('open', 'held', 'booked', 'canceled').default('open'),
  hold_expires_at: Joi.date().iso().optional()
});

export const updateSlotSchema = Joi.object({
  staff_id: uuidSchema,
  service_id: uuidSchema,
  start_time: Joi.date().iso(),
  end_time: Joi.date().iso(),
  status: Joi.string().valid('open', 'held', 'booked', 'canceled'),
  hold_expires_at: Joi.date().iso().allow(null)
}).min(1);

// Waitlist entry validation
export const waitlistEntrySchema = Joi.object({
  customer_name: Joi.string().min(1).max(255).required(),
  phone: phoneSchema.required(),
  email: emailSchema.optional(),
  service_id: uuidSchema.required(),
  staff_id: uuidSchema.optional(),
  earliest_time: Joi.date().iso().required(),
  latest_time: Joi.date().iso().greater(Joi.ref('earliest_time')).required(),
  vip_status: Joi.boolean().default(false),
  notification_channels: Joi.array().items(
    Joi.string().valid('email', 'sms', 'whatsapp')
  ).min(1).max(3).optional(),
  preferred_channel: Joi.string().valid('email', 'sms', 'whatsapp').default('email')
});

export const updateWaitlistEntrySchema = Joi.object({
  customer_name: Joi.string().min(1).max(255),
  phone: phoneSchema,
  email: emailSchema.allow(null),
  service_id: uuidSchema,
  staff_id: uuidSchema.allow(null),
  earliest_time: Joi.date().iso(),
  latest_time: Joi.date().iso(),
  vip_status: Joi.boolean(),
  status: Joi.string().valid('active', 'notified', 'confirmed', 'removed'),
  notification_channels: Joi.array().items(
    Joi.string().valid('email', 'sms', 'whatsapp')
  ).min(1).max(3).optional(),
  preferred_channel: Joi.string().valid('email', 'sms', 'whatsapp')
}).min(1);

// Notification validation
export const notificationSchema = Joi.object({
  waitlist_entry_id: uuidSchema.required(),
  slot_id: uuidSchema.required(),
  type: Joi.string().valid('email', 'sms', 'whatsapp').required(),
  recipient: Joi.string().min(1).max(255).required(),
  subject: Joi.string().max(500).optional(),
  message: Joi.string().min(1).required()
});

// Booking validation
export const bookingSchema = Joi.object({
  slot_id: uuidSchema.required(),
  waitlist_entry_id: uuidSchema.optional(),
  customer_name: Joi.string().min(1).max(255).required(),
  customer_phone: phoneSchema.required(),
  customer_email: emailSchema.optional(),
  booking_source: Joi.string().valid('waitlist', 'direct', 'walk_in').required(),
  status: Joi.string().valid('confirmed', 'completed', 'no_show', 'canceled').default('confirmed')
});

export const updateBookingSchema = Joi.object({
  customer_name: Joi.string().min(1).max(255),
  customer_phone: phoneSchema,
  customer_email: emailSchema.allow(null),
  status: Joi.string().valid('confirmed', 'completed', 'no_show', 'canceled')
}).min(1);

// Query parameter validation
export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort_by: Joi.string().optional(),
  sort_order: Joi.string().valid('asc', 'desc').default('asc')
});

export const dateRangeSchema = Joi.object({
  start_date: Joi.date().iso().optional(),
  end_date: Joi.date().iso().min(Joi.ref('start_date')).optional()
});

// Validation helper function
export const validateSchema = <T>(schema: Joi.ObjectSchema<T>, data: any): { error?: string; value?: T } => {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { error: errorMessage };
  }
  
  return { value };
};