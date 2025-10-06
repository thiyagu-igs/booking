import express from 'express';
import { CalendarService } from '../services/CalendarService';
import { StaffRepository } from '../repositories/StaffRepository';
import { SlotRepository } from '../repositories/SlotRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { logger } from '../config/logger';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/calendar/auth/:staffId
 * Generate OAuth authorization URL for Google Calendar integration
 */
router.get('/auth/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    // Verify staff member exists and belongs to tenant
    const staffRepo = new StaffRepository(tenantId);
    const staff = await staffRepo.findById(staffId);
    
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const authUrl = calendarService.generateAuthUrl(staffId);

    res.json({ authUrl });
  } catch (error) {
    logger.error('Failed to generate calendar auth URL', { error });
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * POST /api/calendar/callback
 * Handle OAuth callback and store tokens
 */
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Authorization code and state are required' });
    }

    const staffId = state; // Staff ID was passed in state parameter
    const calendarService = new CalendarService(tenantId);
    const result = await calendarService.handleOAuthCallback(code, staffId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Calendar integration enabled successfully' });
  } catch (error) {
    logger.error('Failed to handle calendar OAuth callback', { error });
    res.status(500).json({ error: 'Failed to process authorization callback' });
  }
});

/**
 * GET /api/calendar/status/:staffId
 * Get calendar sync status for a staff member
 */
router.get('/status/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const status = await calendarService.getCalendarSyncStatus(staffId);

    res.json(status);
  } catch (error) {
    logger.error('Failed to get calendar sync status', { error });
    res.status(500).json({ error: 'Failed to get calendar sync status' });
  }
});

/**
 * POST /api/calendar/test/:staffId
 * Test calendar connection for a staff member
 */
router.post('/test/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const result = await calendarService.testCalendarConnection(staffId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Calendar connection test successful' });
  } catch (error) {
    logger.error('Failed to test calendar connection', { error });
    res.status(500).json({ error: 'Failed to test calendar connection' });
  }
});

/**
 * DELETE /api/calendar/sync/:staffId
 * Disable calendar sync for a staff member
 */
router.delete('/sync/:staffId', async (req, res) => {
  try {
    const { staffId } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const result = await calendarService.disableCalendarSync(staffId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ message: 'Calendar sync disabled successfully' });
  } catch (error) {
    logger.error('Failed to disable calendar sync', { error });
    res.status(500).json({ error: 'Failed to disable calendar sync' });
  }
});

/**
 * GET /api/calendar/events/stats
 * Get calendar sync statistics for the tenant
 */
router.get('/events/stats', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const stats = await calendarService['calendarEventRepo'].getSyncStats();

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get calendar sync stats', { error });
    res.status(500).json({ error: 'Failed to get calendar sync statistics' });
  }
});

/**
 * POST /api/calendar/events/cleanup
 * Clean up orphaned calendar events
 */
router.post('/events/cleanup', async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant ID not found' });
    }

    const calendarService = new CalendarService(tenantId);
    const cleanedUp = await calendarService['calendarEventRepo'].cleanupOrphanedEvents();

    res.json({ 
      message: `Cleaned up ${cleanedUp} orphaned calendar events`,
      cleanedUp 
    });
  } catch (error) {
    logger.error('Failed to cleanup calendar events', { error });
    res.status(500).json({ error: 'Failed to cleanup calendar events' });
  }
});

export default router;