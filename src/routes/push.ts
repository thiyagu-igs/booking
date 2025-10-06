import express from 'express';
import { z } from 'zod';
import webpush from 'web-push';
import { validateRequest } from '../middleware/validation';
import { authenticate } from '../middleware/auth';
import { logger } from '../config/logger';

const router = express.Router();

// Configure web-push with VAPID keys
const vapidEmail = process.env.VAPID_EMAIL || 'admin@waitlist.com';
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'TZkI9PmdkJpikcMwRiL3OsZfC_jK9sIg9Igd3K2UjObg3TzLxC9y49f3S8vU4jYre8avyNTISWVeU5YDh4HPb-w';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'H1_bcXi84HW2idE5Jsd1_pGgGJeoWlAY_QWGzZFX5wU';

webpush.setVapidDetails(
  'mailto:' + vapidEmail,
  vapidPublicKey,
  vapidPrivateKey
);

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string()
    })
  })
});

const sendNotificationSchema = z.object({
  title: z.string(),
  body: z.string(),
  data: z.record(z.any()).optional(),
  actions: z.array(z.object({
    action: z.string(),
    title: z.string()
  })).optional()
});

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({
    publicKey: vapidPublicKey
  });
});

// Subscribe to push notifications
router.post('/subscribe', authenticate, validateRequest(subscribeSchema), async (req, res) => {
  try {
    const { subscription } = req.body;
    const { user_id, tenant_id } = req.user!;
    
    // Store subscription in database
    const db = req.app.locals.db;
    await db('push_subscriptions').insert({
      id: require('uuid').v4(),
      user_id,
      tenant_id,
      endpoint: subscription.endpoint,
      p256dh_key: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
      created_at: new Date()
    }).onConflict(['user_id', 'endpoint']).merge();
    
    logger.info(`Push subscription created for user ${user_id}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error subscribing to push notifications:', error);
    res.status(500).json({
      error: { message: 'Failed to subscribe to notifications' }
    });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', authenticate, validateRequest(subscribeSchema), async (req, res) => {
  try {
    const { subscription } = req.body;
    const { user_id } = req.user!;
    
    // Remove subscription from database
    const db = req.app.locals.db;
    await db('push_subscriptions')
      .where({ user_id, endpoint: subscription.endpoint })
      .del();
    
    logger.info(`Push subscription removed for user ${user_id}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({
      error: { message: 'Failed to unsubscribe from notifications' }
    });
  }
});

// Send push notification to user
router.post('/send/:userId', authenticate, validateRequest(sendNotificationSchema), async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, body, data, actions } = req.body;
    const { tenant_id } = req.user!;
    
    // Get user's push subscriptions
    const db = req.app.locals.db;
    const subscriptions = await db('push_subscriptions')
      .where({ user_id: userId, tenant_id })
      .select('endpoint', 'p256dh_key', 'auth_key');
    
    if (subscriptions.length === 0) {
      return res.status(404).json({
        error: { message: 'No push subscriptions found for user' }
      });
    }
    
    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: data || {},
      actions: actions || []
    });
    
    // Send to all user's subscriptions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        };
        
        await webpush.sendNotification(pushSubscription, payload);
        return { success: true, endpoint: sub.endpoint };
      } catch (error) {
        logger.error(`Failed to send push notification to ${sub.endpoint}:`, error);
        
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          await db('push_subscriptions')
            .where({ endpoint: sub.endpoint })
            .del();
        }
        
        return { success: false, endpoint: sub.endpoint, error: error.message };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successful = results.filter(r => r.success).length;
    
    logger.info(`Push notification sent to ${successful}/${results.length} subscriptions for user ${userId}`);
    
    res.json({
      success: true,
      sent: successful,
      total: results.length,
      results
    });
  } catch (error) {
    logger.error('Error sending push notification:', error);
    res.status(500).json({
      error: { message: 'Failed to send notification' }
    });
  }
});

// Send push notification to all users in tenant
router.post('/broadcast', authenticate, validateRequest(sendNotificationSchema), async (req, res) => {
  try {
    const { title, body, data, actions } = req.body;
    const { tenant_id } = req.user!;
    
    // Get all push subscriptions for tenant
    const db = req.app.locals.db;
    const subscriptions = await db('push_subscriptions')
      .where({ tenant_id })
      .select('endpoint', 'p256dh_key', 'auth_key');
    
    if (subscriptions.length === 0) {
      return res.status(404).json({
        error: { message: 'No push subscriptions found for tenant' }
      });
    }
    
    // Prepare notification payload
    const payload = JSON.stringify({
      title,
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: data || {},
      actions: actions || []
    });
    
    // Send to all subscriptions
    const sendPromises = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key
          }
        };
        
        await webpush.sendNotification(pushSubscription, payload);
        return { success: true, endpoint: sub.endpoint };
      } catch (error) {
        logger.error(`Failed to send push notification to ${sub.endpoint}:`, error);
        
        // Remove invalid subscriptions
        if (error.statusCode === 410) {
          await db('push_subscriptions')
            .where({ endpoint: sub.endpoint })
            .del();
        }
        
        return { success: false, endpoint: sub.endpoint, error: error.message };
      }
    });
    
    const results = await Promise.all(sendPromises);
    const successful = results.filter(r => r.success).length;
    
    logger.info(`Broadcast push notification sent to ${successful}/${results.length} subscriptions for tenant ${tenant_id}`);
    
    res.json({
      success: true,
      sent: successful,
      total: results.length,
      results
    });
  } catch (error) {
    logger.error('Error broadcasting push notification:', error);
    res.status(500).json({
      error: { message: 'Failed to broadcast notification' }
    });
  }
});

export default router;