import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { testConnection, closeConnection } from './database/connection';
import { connectRedis, disconnectRedis } from './config/redis';
import db from './database/connection';
import authRoutes from './routes/auth';
import demoRoutes from './routes/demo';
import waitlistRoutes from './routes/waitlist';
import slotRoutes from './routes/slots';
import servicesRoutes from './routes/services';
import staffRoutes from './routes/staff';
import settingsRoutes from './routes/settings';
import notificationRoutes from './routes/notifications';
import jobRoutes from './routes/jobs';
import analyticsRoutes from './routes/analytics';
import calendarRoutes from './routes/calendar';
import auditRoutes from './routes/audit';
import webhookRoutes from './routes/webhooks';
import whatsappTemplateRoutes from './routes/whatsapp-templates';
import publicRoutes from './routes/public';
import pushRoutes from './routes/push';
import bookingsRoutes from './routes/bookings';

// Security middleware
import { 
  securityHeaders, 
  sanitizeInput, 
  preventSQLInjection, 
  limitRequestSize,
  apiRateLimit,
  initializeRateLimiting
} from './middleware/security';
import { monitoringService } from './services/MonitoringService';
import { DatabaseBackupService } from './scripts/backup';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(preventSQLInjection);
app.use(limitRequestSize(10 * 1024 * 1024)); // 10MB limit

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API rate limiting
app.use('/api/', apiRateLimit);

// Make database available to routes
app.locals.db = db;

// Health check endpoint with monitoring data
app.get('/health', async (req, res) => {
  try {
    const healthStatus = await monitoringService.getHealthStatus();
    res.json({
      ...healthStatus,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Security monitoring endpoint (admin only)
app.get('/api/security/status', async (req, res) => {
  try {
    const metrics = monitoringService.getMetricsHistory(24);
    const alerts = monitoringService.getAlertsHistory(24);
    
    res.json({
      metrics: metrics.slice(-10), // Last 10 metrics
      alerts,
      summary: {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        highAlerts: alerts.filter(a => a.severity === 'high').length
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get security status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/whatsapp-templates', whatsappTemplateRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/bookings', bookingsRoutes);

// Serve static files from frontend build in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendPath));
  
  // Handle React Router - send all non-API requests to index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API route not found' });
    }
  });
} else {
  // Development API info route
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Waitlist Management System API',
      version: '1.0.0',
      frontend: 'Run `npm run dev:frontend` to start the frontend development server'
    });
  });
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler for API routes only (frontend routes handled above)
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Connect to Redis
    await connectRedis();
    
    // Initialize rate limiting
    await initializeRateLimiting();
    
    // Start monitoring
    monitoringService.startMonitoring(5); // Every 5 minutes
    
    // Initialize backup service if enabled
    if (process.env.ENABLE_AUTO_BACKUP === 'true') {
      const backupService = new DatabaseBackupService();
      await backupService.scheduleBackups();
      console.log('Automatic database backups enabled');
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('Security hardening enabled');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await disconnectRedis();
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await disconnectRedis();
  await closeConnection();
  process.exit(0);
});

// Export app for testing
export { app };

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}