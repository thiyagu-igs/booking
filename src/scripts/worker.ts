#!/usr/bin/env ts-node

/**
 * Background Worker Script
 * 
 * This script starts the background worker process that handles:
 * - Processing expired slot holds
 * - Notification cascades
 * - Retry failed notifications
 * - Cleanup old data
 * 
 * Usage:
 *   npm run worker
 *   or
 *   ts-node src/scripts/worker.ts
 */

import BackgroundWorker from '../workers/backgroundWorker';

console.log('🚀 Starting Waitlist Management Background Worker...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Redis URL:', process.env.REDIS_URL || 'redis://localhost:6379');
console.log('Database:', process.env.DB_NAME || 'waitlist_management');

const worker = new BackgroundWorker();

worker.initialize().catch((error) => {
  console.error('❌ Failed to start background worker:', error);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});