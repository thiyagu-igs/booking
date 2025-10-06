import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { CalendarEventRepository } from '../repositories/CalendarEventRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { logger } from '../config/logger';
import { CalendarEvent, Slot, Staff, Service } from '../models';

export interface CalendarEventData {
  slotId: string;
  staffId: string;
  customerName: string;
  customerEmail?: string;
  serviceName: string;
  startTime: Date;
  endTime: Date;
}

export interface CalendarSyncResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export class CalendarService {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;
  private calendarEventRepo: CalendarEventRepository;
  private staffRepo: StaffRepository;
  private slotRepo: SlotRepository;
  private serviceRepo: ServiceRepository;

  constructor(tenantId: string) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
    
    this.calendarEventRepo = new CalendarEventRepository(tenantId);
    this.staffRepo = new StaffRepository(tenantId);
    this.slotRepo = new SlotRepository(tenantId);
    this.serviceRepo = new ServiceRepository(tenantId);
  }

  /**
   * Generate OAuth 2.0 authorization URL
   */
  generateAuthUrl(staffId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: staffId, // Pass staff ID in state parameter
      prompt: 'consent' // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens and store them
   */
  async handleOAuthCallback(code: string, staffId: string): Promise<CalendarSyncResult> {
    try {
      const { tokens } = await this.oauth2Client.getAccessToken(code);
      
      if (!tokens.refresh_token) {
        throw new Error('No refresh token received. User may need to revoke access and re-authorize.');
      }

      // Get primary calendar ID
      this.oauth2Client.setCredentials(tokens);
      const calendarList = await this.calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);
      
      if (!primaryCalendar?.id) {
        throw new Error('Could not find primary calendar');
      }

      // Update staff record with calendar credentials
      await this.staffRepo.update(staffId, {
        google_calendar_id: primaryCalendar.id,
        google_refresh_token: tokens.refresh_token,
        calendar_sync_enabled_at: new Date(),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });

      logger.info(`Calendar sync enabled for staff ${staffId}`, {
        staffId,
        calendarId: primaryCalendar.id
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.staffRepo.update(staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: errorMessage
      });

      logger.error('Failed to handle OAuth callback', {
        staffId,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Create calendar event for a booked slot
   */
  async createEventForSlot(eventData: CalendarEventData): Promise<CalendarSyncResult> {
    try {
      const staff = await this.staffRepo.findById(eventData.staffId);
      if (!staff || !staff.google_refresh_token || !staff.google_calendar_id) {
        logger.warn(`Calendar sync not enabled for staff ${eventData.staffId}`);
        return { success: false, error: 'Calendar sync not enabled for staff member' };
      }

      // Set up OAuth client with stored refresh token
      this.oauth2Client.setCredentials({
        refresh_token: staff.google_refresh_token
      });

      // Create calendar event
      const event: calendar_v3.Schema$Event = {
        summary: `${eventData.serviceName} - ${eventData.customerName}`,
        description: `Booking through waitlist system\nCustomer: ${eventData.customerName}${eventData.customerEmail ? `\nEmail: ${eventData.customerEmail}` : ''}`,
        start: {
          dateTime: eventData.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: eventData.endTime.toISOString(),
          timeZone: 'UTC'
        },
        attendees: eventData.customerEmail ? [
          { email: eventData.customerEmail, displayName: eventData.customerName }
        ] : undefined
      };

      const response = await this.calendar.events.insert({
        calendarId: staff.google_calendar_id,
        requestBody: event
      });

      if (!response.data.id) {
        throw new Error('No event ID returned from Google Calendar');
      }

      // Store calendar event record
      await this.calendarEventRepo.create({
        slot_id: eventData.slotId,
        staff_id: eventData.staffId,
        google_event_id: response.data.id,
        google_calendar_id: staff.google_calendar_id,
        status: 'created'
      });

      // Update staff last sync time
      await this.staffRepo.update(eventData.staffId, {
        calendar_last_sync_at: new Date(),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });

      logger.info(`Calendar event created for slot ${eventData.slotId}`, {
        slotId: eventData.slotId,
        staffId: eventData.staffId,
        googleEventId: response.data.id
      });

      return { success: true, eventId: response.data.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update staff sync status on error
      await this.staffRepo.update(eventData.staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: errorMessage
      });

      logger.error('Failed to create calendar event', {
        slotId: eventData.slotId,
        staffId: eventData.staffId,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Delete calendar event when booking is cancelled
   */
  async deleteEventForSlot(slotId: string): Promise<CalendarSyncResult> {
    try {
      const calendarEvent = await this.calendarEventRepo.findBySlotId(slotId);
      if (!calendarEvent) {
        logger.warn(`No calendar event found for slot ${slotId}`);
        return { success: true }; // Not an error if no event exists
      }

      const staff = await this.staffRepo.findById(calendarEvent.staff_id);
      if (!staff || !staff.google_refresh_token) {
        logger.warn(`Cannot delete calendar event - no refresh token for staff ${calendarEvent.staff_id}`);
        return { success: false, error: 'No refresh token available for staff member' };
      }

      // Set up OAuth client with stored refresh token
      this.oauth2Client.setCredentials({
        refresh_token: staff.google_refresh_token
      });

      // Delete calendar event
      await this.calendar.events.delete({
        calendarId: calendarEvent.google_calendar_id,
        eventId: calendarEvent.google_event_id
      });

      // Update calendar event record
      await this.calendarEventRepo.update(calendarEvent.id, {
        status: 'deleted'
      });

      // Update staff last sync time
      await this.staffRepo.update(calendarEvent.staff_id, {
        calendar_last_sync_at: new Date(),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });

      logger.info(`Calendar event deleted for slot ${slotId}`, {
        slotId,
        staffId: calendarEvent.staff_id,
        googleEventId: calendarEvent.google_event_id
      });

      return { success: true, eventId: calendarEvent.google_event_id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to delete calendar event', {
        slotId,
        error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Disable calendar sync for a staff member
   */
  async disableCalendarSync(staffId: string): Promise<CalendarSyncResult> {
    try {
      await this.staffRepo.update(staffId, {
        google_calendar_id: null,
        google_refresh_token: null,
        calendar_sync_enabled_at: null,
        calendar_sync_status: 'disabled',
        calendar_sync_error: null
      });

      logger.info(`Calendar sync disabled for staff ${staffId}`, { staffId });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to disable calendar sync', { staffId, error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get calendar sync status for a staff member
   */
  async getCalendarSyncStatus(staffId: string): Promise<{
    enabled: boolean;
    status: string;
    lastSync?: Date;
    error?: string;
  }> {
    const staff = await this.staffRepo.findById(staffId);
    
    return {
      enabled: staff?.calendar_sync_status === 'enabled',
      status: staff?.calendar_sync_status || 'disabled',
      lastSync: staff?.calendar_last_sync_at,
      error: staff?.calendar_sync_error
    };
  }

  /**
   * Test calendar connection for a staff member
   */
  async testCalendarConnection(staffId: string): Promise<CalendarSyncResult> {
    try {
      const staff = await this.staffRepo.findById(staffId);
      if (!staff || !staff.google_refresh_token || !staff.google_calendar_id) {
        return { success: false, error: 'Calendar sync not configured' };
      }

      // Set up OAuth client with stored refresh token
      this.oauth2Client.setCredentials({
        refresh_token: staff.google_refresh_token
      });

      // Test by fetching calendar info
      const calendar = await this.calendar.calendars.get({
        calendarId: staff.google_calendar_id
      });

      if (!calendar.data.id) {
        throw new Error('Could not access calendar');
      }

      // Update staff sync status
      await this.staffRepo.update(staffId, {
        calendar_last_sync_at: new Date(),
        calendar_sync_status: 'enabled',
        calendar_sync_error: null
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await this.staffRepo.update(staffId, {
        calendar_sync_status: 'error',
        calendar_sync_error: errorMessage
      });

      return { success: false, error: errorMessage };
    }
  }
}