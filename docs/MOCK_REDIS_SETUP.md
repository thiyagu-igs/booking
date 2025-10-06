# Mock Redis Setup

This document explains how to run the waitlist management system without Redis using the built-in mock Redis functionality.

## When to Use Mock Redis

- **Development environments** where Redis is not available
- **Staging environments** for quick testing without infrastructure setup
- **CI/CD pipelines** where you want to test application logic without external dependencies
- **Local development** when you don't want to install Redis

## Configuration

### Environment Variable

Set the `MOCK_REDIS` environment variable to `true`:

```bash
MOCK_REDIS=true
```

### Using .env.staging

A pre-configured staging environment file is provided:

```bash
# Copy the staging environment
cp .env.staging .env

# Or run with staging config directly
npm run dev:staging
```

## What Mock Redis Provides

### ✅ Supported Features

- **Basic key-value operations**: `get`, `set`, `incr`, `expire`, `ttl`
- **Rate limiting**: Mock implementation that allows all requests (with warnings)
- **Background job queues**: Jobs are processed immediately in-memory
- **Application startup**: No Redis connection errors
- **Graceful degradation**: All Redis-dependent features continue to work

### ⚠️ Limitations

- **No persistence**: Data is lost when the application restarts
- **No clustering**: Single-process only, no distributed functionality
- **No rate limiting enforcement**: All rate limit checks pass (logged as warnings)
- **Simplified job processing**: Jobs execute immediately, no delayed/scheduled jobs
- **No monitoring persistence**: System metrics are not stored

## Running with Mock Redis

### Development Mode

```bash
# Set environment variable
export MOCK_REDIS=true

# Start the application
npm run dev

# Start the worker (optional, jobs will process in main app)
npm run worker:dev
```

### Staging Mode

```bash
# Use pre-configured staging environment
npm run dev:staging

# Or manually
NODE_ENV=staging MOCK_REDIS=true npm run dev
```

### Production Warning

**⚠️ Never use `MOCK_REDIS=true` in production!**

Mock Redis is designed for development and testing only. Production environments should always use a real Redis instance for:
- Data persistence
- Performance
- Reliability
- Proper rate limiting
- Distributed job processing

## Logs and Indicators

When mock Redis is active, you'll see these log messages:

```
🔧 Using Mock Redis (MOCK_REDIS=true)
🔧 Created Mock Queue: expired-holds
🔧 Created Mock Queue: notification-cascade
🔧 MonitoringService using Mock Redis
🔧 Rate limiting disabled in mock Redis mode
```

## Switching Back to Real Redis

1. Set `MOCK_REDIS=false` or remove the environment variable
2. Ensure Redis server is running
3. Update `REDIS_URL` to point to your Redis instance
4. Restart the application

## Testing

Mock Redis is automatically enabled during test runs (`NODE_ENV=test`), so no additional configuration is needed for testing.

## Troubleshooting

### Application Won't Start

If the application fails to start even with `MOCK_REDIS=true`:

1. Check that the environment variable is properly set
2. Verify no syntax errors in configuration files
3. Check application logs for other connection issues (database, etc.)

### Background Jobs Not Processing

With mock Redis:
- Jobs execute immediately when added
- No job persistence between restarts
- No delayed job scheduling
- Check console logs for job execution messages

### Rate Limiting Not Working

This is expected behavior with mock Redis:
- All rate limit checks return "allowed"
- Warning messages are logged
- For testing rate limits, use a real Redis instance