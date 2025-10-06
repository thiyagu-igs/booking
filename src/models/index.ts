// Core data models for the waitlist management system

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  created_at: Date;
  updated_at?: Date;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'staff' | 'manager';
  active: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface Staff {
  id: string;
  tenant_id: string;
  name: string;
  role?: string;
  active: boolean;
  google_calendar_id?: string;
  google_refresh_token?: string;
  calendar_sync_enabled_at?: Date;
  calendar_last_sync_at?: Date;
  calendar_sync_status: 'disabled' | 'enabled' | 'error';
  calendar_sync_error?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Service {
  id: string;
  tenant_id: string;
  name: string;
  duration_minutes: number;
  price?: number;
  active: boolean;
  created_at: Date;
  updated_at?: Date;
}

export interface Slot {
  id: string;
  tenant_id: string;
  staff_id: string;
  service_id: string;
  start_time: Date;
  end_time: Date;
  status: 'open' | 'held' | 'booked' | 'canceled';
  hold_expires_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface WaitlistEntry {
  id: string;
  tenant_id: string;
  customer_name: string;
  phone: string;
  email?: string;
  service_id: string;
  staff_id?: string;
  earliest_time: Date;
  latest_time: Date;
  priority_score: number;
  vip_status: boolean;
  status: 'active' | 'notified' | 'confirmed' | 'removed';
  notification_channels?: NotificationType[];
  preferred_channel: NotificationType;
  created_at: Date;
  updated_at?: Date;
}

export interface Notification {
  id: string;
  tenant_id: string;
  waitlist_entry_id: string;
  slot_id: string;
  type: 'email' | 'sms' | 'whatsapp';
  recipient: string;
  subject?: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at?: Date;
  delivered_at?: Date;
  error_message?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Booking {
  id: string;
  tenant_id: string;
  slot_id: string;
  waitlist_entry_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  status: 'confirmed' | 'completed' | 'no_show' | 'canceled';
  booking_source: 'waitlist' | 'direct' | 'walk_in';
  confirmed_at?: Date;
  completed_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface CalendarEvent {
  id: string;
  tenant_id: string;
  slot_id: string;
  staff_id: string;
  google_event_id: string;
  google_calendar_id: string;
  status: 'created' | 'updated' | 'deleted' | 'error';
  sync_error?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface WhatsAppTemplate {
  id: string;
  tenant_id: string;
  template_name: string;
  template_language: string;
  template_category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'pending' | 'approved' | 'rejected' | 'disabled';
  template_components: WhatsAppTemplateComponents;
  rejection_reason?: string;
  submitted_at?: Date;
  approved_at?: Date;
  active: boolean;
  created_at: Date;
  updated_at?: Date;
}

export interface WhatsAppTemplateComponents {
  header?: {
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: {
      header_text?: string[];
    };
  };
  body: {
    text: string;
    example?: {
      body_text?: string[][];
    };
  };
  footer?: {
    text: string;
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  actor_type: 'user' | 'system';
  actor_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at: Date;
}

// Enums for better type safety
export enum SlotStatus {
  OPEN = 'open',
  HELD = 'held',
  BOOKED = 'booked',
  CANCELED = 'canceled'
}

export enum WaitlistStatus {
  ACTIVE = 'active',
  NOTIFIED = 'notified',
  CONFIRMED = 'confirmed',
  REMOVED = 'removed'
}

export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp'
}

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed'
}

export enum BookingStatus {
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
  CANCELED = 'canceled'
}

export enum BookingSource {
  WAITLIST = 'waitlist',
  DIRECT = 'direct',
  WALK_IN = 'walk_in'
}

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  MANAGER = 'manager'
}

export enum CalendarSyncStatus {
  DISABLED = 'disabled',
  ENABLED = 'enabled',
  ERROR = 'error'
}

export enum CalendarEventStatus {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  ERROR = 'error'
}

export enum WhatsAppTemplateStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  DISABLED = 'disabled'
}

export enum WhatsAppTemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION'
}