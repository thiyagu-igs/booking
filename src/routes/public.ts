import express from 'express';
import { z } from 'zod';
import { WaitlistRepository } from '../repositories/WaitlistRepository';
import { ServiceRepository } from '../repositories/ServiceRepository';
import { StaffRepository } from '../repositories/StaffRepository';
import { TenantRepository } from '../repositories/TenantRepository';
import { NotificationService } from '../services/NotificationService';
import { validateRequest } from '../middleware/validation';
import { logger } from '../config/logger';

const router = express.Router();

// Validation schemas
const joinWaitlistSchema = z.object({
  tenant_id: z.string().uuid(),
  customer_name: z.string().min(1).max(255),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional(),
  service_id: z.string().uuid(),
  staff_id: z.string().uuid().optional(),
  earliest_time: z.string().datetime(),
  latest_time: z.string().datetime(),
});

const sendOTPSchema = z.object({
  tenant_id: z.string().uuid(),
  phone: z.string().min(10).max(20),
});

const verifyOTPSchema = z.object({
  tenant_id: z.string().uuid(),
  phone: z.string().min(10).max(20),
  otp_code: z.string().length(6),
});

// Get available tenants for auth screen
router.get('/tenants', async (req, res) => {
  try {
    const tenantRepo = new TenantRepository('system'); // Use system context for public access
    const tenants = await tenantRepo.findAll();
    
    // Return only public tenant information
    const publicTenants = tenants.map(tenant => ({
      id: tenant.id,
      name: tenant.name,
      timezone: tenant.timezone
    }));
    
    res.json({
      success: true,
      data: publicTenants
    });
  } catch (error) {
    logger.error('Error fetching tenants:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Get business information for customer-facing page
router.get('/business/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const tenantRepo = new TenantRepository(tenantId);
    const business = await tenantRepo.findById(tenantId);
    
    if (!business) {
      return res.status(404).json({
        error: { message: 'Business not found' }
      });
    }

    // Return public business information
    res.json({
      id: business.id,
      name: business.name,
      description: business.description,
      address: business.address,
      phone: business.phone,
      hours: business.hours,
      rating: business.rating,
      logo: business.logo_url
    });
  } catch (error) {
    logger.error('Error fetching business info:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Get services for a tenant (public)
router.get('/services', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id || typeof tenant_id !== 'string') {
      return res.status(400).json({
        error: { message: 'tenant_id is required' }
      });
    }

    const serviceRepo = new ServiceRepository(tenant_id);
    const services = await serviceRepo.findAll({ active: true });
    
    res.json(services);
  } catch (error) {
    logger.error('Error fetching services:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Get staff for a tenant (public)
router.get('/staff', async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    if (!tenant_id || typeof tenant_id !== 'string') {
      return res.status(400).json({
        error: { message: 'tenant_id is required' }
      });
    }

    const staffRepo = new StaffRepository(tenant_id);
    const staff = await staffRepo.findAll({ active: true });
    
    res.json(staff);
  } catch (error) {
    logger.error('Error fetching staff:', error);
    res.status(500).json({
      error: { message: 'Internal server error' }
    });
  }
});

// Send OTP for phone verification
router.post('/send-otp', validateRequest(sendOTPSchema), async (req, res) => {
  try {
    const { tenant_id, phone } = req.body;
    
    // Generate 6-digit OTP
    const otp_code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP in cache with 5-minute expiry
    const redis = req.app.locals.redis;
    const otpKey = `otp:${tenant_id}:${phone}`;
    await redis.setex(otpKey, 300, otp_code); // 5 minutes
    
    // Send OTP via SMS (using notification service)
    const notificationService = new NotificationService(tenant_id);
    await notificationService.sendSMS(phone, `Your verification code is: ${otp_code}. Valid for 5 minutes.`);
    
    logger.info(`OTP sent to ${phone} for tenant ${tenant_id}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error sending OTP:', error);
    res.status(500).json({
      error: { message: 'Failed to send verification code' }
    });
  }
});

// Verify OTP
router.post('/verify-otp', validateRequest(verifyOTPSchema), async (req, res) => {
  try {
    const { tenant_id, phone, otp_code } = req.body;
    
    // Check OTP from cache
    const redis = req.app.locals.redis;
    const otpKey = `otp:${tenant_id}:${phone}`;
    const storedOTP = await redis.get(otpKey);
    
    if (!storedOTP || storedOTP !== otp_code) {
      return res.status(400).json({
        error: { message: 'Invalid or expired verification code' }
      });
    }
    
    // Mark phone as verified
    const verifiedKey = `verified:${tenant_id}:${phone}`;
    await redis.setex(verifiedKey, 3600, 'true'); // 1 hour
    
    // Clean up OTP
    await redis.del(otpKey);
    
    logger.info(`Phone ${phone} verified for tenant ${tenant_id}`);
    
    res.json({ success: true });
  } catch (error) {
    logger.error('Error verifying OTP:', error);
    res.status(500).json({
      error: { message: 'Failed to verify code' }
    });
  }
});

// Join waitlist (public endpoint)
router.post('/waitlist', validateRequest(joinWaitlistSchema), async (req, res) => {
  try {
    const { tenant_id, customer_name, phone, email, service_id, staff_id, earliest_time, latest_time } = req.body;
    
    // Check if phone is verified
    const redis = req.app.locals.redis;
    const verifiedKey = `verified:${tenant_id}:${phone}`;
    const isVerified = await redis.get(verifiedKey);
    
    if (!isVerified) {
      return res.status(400).json({
        error: { message: 'Phone number not verified' }
      });
    }
    
    const waitlistRepo = new WaitlistRepository(tenant_id);
    
    // Check if customer already has 3 active entries
    const activeEntries = await waitlistRepo.findByPhone(phone, 'active');
    if (activeEntries.length >= 3) {
      return res.status(400).json({
        error: { 
          message: 'Maximum 3 active waitlist entries allowed per phone number',
          code: 'WAITLIST_LIMIT_EXCEEDED'
        }
      });
    }
    
    // Calculate priority score
    const priorityScore = await waitlistRepo.calculatePriorityScore({
      vip_status: false, // Default for public signups
      service_match: true,
      staff_preference: !!staff_id,
      time_window_match: true,
      recency_bonus: 0
    });
    
    // Create waitlist entry
    const entry = await waitlistRepo.create({
      customer_name,
      phone,
      email,
      service_id,
      staff_id,
      earliest_time: new Date(earliest_time),
      latest_time: new Date(latest_time),
      priority_score: priorityScore,
      status: 'active'
    });
    
    logger.info(`Customer ${customer_name} joined waitlist for tenant ${tenant_id}`);
    
    res.status(201).json({
      id: entry.id,
      priority_score: priorityScore,
      position: activeEntries.length + 1
    });
  } catch (error) {
    logger.error('Error joining waitlist:', error);
    res.status(500).json({
      error: { message: 'Failed to join waitlist' }
    });
  }
});

export default router;