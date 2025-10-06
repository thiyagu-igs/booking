# Background Job Processing System

This document describes the background job processing system implemented for the waitlist management system.

## Overview

The background job processing system handles asynchronous tasks that are critical for the waitlist management workflow:

1. **Expired Holds Processing** - Automatically releases expired slot holds and triggers cascade notifications
2. **Notification Cascade** - Handles the flow when customers decline or don't respond to slot offers
3. **Notification Retry** - Retries failed email notifications with exponential backoff
4. **Data Cleanup** - Removes old notifications and audit logs to maintain system performance

## Architecture

### Components

1. **Queue Configuration** (`src/config/queue.ts`)
   - Defines Redis-backed job queues using Bull
   - Configures job retry policies and cleanup settings
   - Sets up queue monitoring and health checks

2. **Background Job Service** (`src/services/BackgroundJobService.ts`)
   - Contains the business logic for processing each job type
   - Handles tenant-scoped operations
   - Provides comprehensive error handling and logging

3. **Job Scheduler Service** (`src/services/JobSchedulerService.ts`)
   - Provides API for scheduling jobs programmatically
   - Manages queue operations (pause, resume, cleanup)
   - Offers job monitoring and retry capabilities

4. **Background Worker** (`src/workers/backgroundWorker.ts`)
   - Main worker process that processes jobs from queues
   - Handles graceful shutdown and error recovery
   - Configures recurring jobs (expired holds check every minute)

5. **Job Management API** (`src/routes/jobs.ts`)
   - REST endpoints for monitoring and managing background jobs
   - Allows manual triggering of job processing
   - Provides queue health and statistics

## Job Types

### 1. Expired Holds Processing
- **Frequency**: Every minute (automated)
- **Purpose**: Find and release expired slot holds, notify next candidates
- **Scope**: Can process all tenants or specific tenant
- **Retry Policy**: 3 attempts with exponential backoff

### 2. Notification Cascade
- **Trigger**: When customer declines or hold expires
- **Purpose**: Notify the next highest-priority candidate
- **Data**: Slot ID, previous entry ID, reason (declined/expired)
- **Retry Policy**: 5 attempts with exponential backoff

### 3. Notification Retry
- **Trigger**: When email notification fails
- **Purpose**: Retry failed notifications with increasing delays
- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)

### 4. Cleanup Jobs
- **Frequency**: Daily at 2 AM (automated)
- **Purpose**: Remove old notifications and audit logs
- **Default Retention**: 30 days
- **Retry Policy**: 2 attempts with fixed delay

## API Endpoints

### Queue Management
- `GET /api/jobs/status` - Get queue health and statistics
- `POST /api/jobs/pause` - Pause all queues
- `POST /api/jobs/resume` - Resume all queues
- `POST /api/jobs/failed/clear` - Clear failed jobs

### Job Scheduling
- `POST /api/jobs/expired-holds/trigger` - Manually trigger expired holds check
- `POST /api/jobs/cascade/trigger` - Schedule notification cascade
- `POST /api/jobs/notifications/retry` - Retry failed notification
- `POST /api/jobs/cleanup/trigger` - Schedule cleanup job

### Job Monitoring
- `GET /api/jobs/:queueName/:jobId` - Get job details
- `POST /api/jobs/:queueName/:jobId/retry` - Retry specific job

## Configuration

### Environment Variables
- `REDIS_URL` - Redis connection URL
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)

### Queue Settings
- **Expired Holds**: 1 concurrent job, high priority
- **Notification Cascade**: 3 concurrent jobs, medium-high priority
- **Retry Notifications**: 2 concurrent jobs, medium priority
- **Cleanup**: 1 concurrent job, low priority

## Running the System

### Start Background Worker
```bash
npm run worker          # Production
npm run worker:dev      # Development with auto-restart
```

### Start Main Application
```bash
npm start              # Production
npm run dev            # Development
```

## Monitoring and Logging

### Queue Health Monitoring
The system provides comprehensive queue health metrics:
- Waiting jobs count
- Active jobs count
- Completed jobs count
- Failed jobs count
- Delayed jobs count
- Queue pause status

### Logging
All job processing includes detailed logging:
- Job start/completion times
- Processing duration
- Success/failure status
- Error details and stack traces
- Performance metrics

### Error Handling
- Automatic retry with exponential backoff
- Dead letter queue for permanently failed jobs
- Graceful degradation when external services fail
- Comprehensive error logging and alerting

## Testing

The system includes comprehensive tests:
- Unit tests for all services and job processors
- Integration tests for complete job workflows
- API endpoint tests for job management
- Mock implementations for testing without Redis

### Running Tests
```bash
npm test                                    # All tests
npm test -- --testPathPattern="queue"      # Queue tests only
npm test -- --testPathPattern="jobs"       # Job-related tests
```

## Performance Considerations

### Scalability
- Horizontal scaling: Multiple worker processes can run simultaneously
- Queue-based architecture prevents blocking operations
- Tenant-scoped processing allows for efficient resource utilization

### Resource Management
- Configurable concurrency limits prevent resource exhaustion
- Automatic cleanup of completed jobs maintains Redis memory usage
- Connection pooling for database operations

### Monitoring
- Queue metrics for performance monitoring
- Job processing duration tracking
- Failed job analysis and alerting

## Security

### Authentication
- All API endpoints require valid JWT authentication
- Tenant-scoped operations prevent cross-tenant access
- Admin-only endpoints for system management

### Data Protection
- Tenant isolation at the application level
- Secure token generation for confirmation links
- Rate limiting to prevent abuse

## Future Enhancements

### Phase 2 Features
- SMS/WhatsApp notification support via Twilio
- Advanced scheduling with cron expressions
- Job priority queues for urgent operations
- Real-time job status updates via WebSocket
- Advanced analytics and reporting
- Job workflow orchestration
- Multi-region deployment support

### Monitoring Improvements
- Integration with monitoring services (DataDog, New Relic)
- Custom metrics and alerting
- Performance dashboards
- Automated scaling based on queue depth