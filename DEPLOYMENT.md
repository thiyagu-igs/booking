# Deployment Guide

This guide covers deploying the Waitlist Management System with the React frontend.

## Production Build

### 1. Install All Dependencies
```bash
npm run install:all
```

### 2. Build Frontend and Backend
```bash
npm run build:all
```

### 3. Set Environment Variables
Create a `.env` file with production values:

```env
NODE_ENV=production
PORT=8000
DB_HOST=your-mysql-host
DB_USER=your-mysql-user
DB_PASSWORD=your-mysql-password
DB_NAME=waitlist_management
REDIS_URL=redis://your-redis-host:6379
SENDGRID_API_KEY=your-sendgrid-api-key
JWT_SECRET=your-jwt-secret
```

### 4. Run Database Migrations
```bash
npm run migrate
```

### 5. Start Production Server
```bash
npm start
```

The server will serve both the API and the React frontend on the same port.

## Docker Deployment

### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production
RUN cd frontend && npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Build backend
RUN npm run build

# Expose port
EXPOSE 8000

# Start server
CMD ["npm", "start"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
      - DB_USER=waitlist
      - DB_PASSWORD=password
      - DB_NAME=waitlist_management
      - REDIS_URL=redis://redis:6379
      - SENDGRID_API_KEY=${SENDGRID_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - mysql
      - redis

  mysql:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=rootpassword
      - MYSQL_DATABASE=waitlist_management
      - MYSQL_USER=waitlist
      - MYSQL_PASSWORD=password
    volumes:
      - mysql_data:/var/lib/mysql

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  mysql_data:
  redis_data:
```

## Cloud Deployment

### Render.com
1. Connect your GitHub repository
2. Set build command: `npm run build:all`
3. Set start command: `npm start`
4. Add environment variables in Render dashboard
5. Add MySQL and Redis add-ons

### Railway
1. Connect GitHub repository
2. Set build command: `npm run build:all`
3. Set start command: `npm start`
4. Configure environment variables
5. Add MySQL and Redis services

### Heroku
1. Create Heroku app
2. Add buildpacks:
   - `heroku/nodejs`
3. Set environment variables
4. Add add-ons:
   - `JawsDB MySQL`
   - `Heroku Redis`
5. Deploy from GitHub

## Environment Configuration

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `8000` |
| `DB_HOST` | MySQL host | `localhost` |
| `DB_USER` | MySQL username | `waitlist` |
| `DB_PASSWORD` | MySQL password | `password` |
| `DB_NAME` | Database name | `waitlist_management` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `SENDGRID_API_KEY` | SendGrid API key | `SG.xxx` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |

### Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_PORT` | MySQL port | `3306` |
| `SENDGRID_FROM_EMAIL` | Default sender email | `noreply@yourdomain.com` |
| `SENDGRID_FROM_NAME` | Default sender name | `Waitlist System` |

## Post-Deployment Setup

### 1. Create Initial Tenant
Use the demo endpoint to create your first tenant:

```bash
curl -X POST https://your-domain.com/api/demo/setup \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Your Business Name",
    "email": "admin@yourbusiness.com",
    "password": "secure-password"
  }'
```

### 2. Configure SendGrid
1. Verify your sender email in SendGrid
2. Set up domain authentication (recommended)
3. Configure email templates in the dashboard

### 3. Test the System
1. Access the dashboard at your domain
2. Log in with the admin credentials
3. Configure business hours, services, and staff
4. Test the waitlist flow

## Monitoring and Maintenance

### Health Checks
- API health: `GET /health`
- Queue health: `GET /api/jobs/health`

### Logs
Monitor application logs for:
- Database connection issues
- Redis connection problems
- SendGrid delivery failures
- Background job errors

### Backup Strategy
1. **Database**: Regular MySQL backups
2. **Redis**: Backup for job queue persistence
3. **Environment**: Secure backup of environment variables

### Updates
1. Test updates in staging environment
2. Run database migrations: `npm run migrate`
3. Rebuild frontend: `npm run build:frontend`
4. Restart application server

## Troubleshooting

### Common Issues

1. **Frontend not loading**
   - Check if `frontend/dist` exists
   - Verify build completed successfully
   - Check server logs for static file errors

2. **API errors**
   - Verify database connection
   - Check Redis connectivity
   - Validate environment variables

3. **Email not sending**
   - Verify SendGrid API key
   - Check sender email verification
   - Review SendGrid activity logs

4. **Background jobs not processing**
   - Check Redis connection
   - Verify worker process is running
   - Review job queue health endpoint

### Performance Optimization

1. **Database**
   - Add indexes for frequently queried columns
   - Monitor slow query log
   - Consider read replicas for high traffic

2. **Redis**
   - Monitor memory usage
   - Configure appropriate eviction policies
   - Consider Redis Cluster for scaling

3. **Frontend**
   - Enable gzip compression
   - Configure CDN for static assets
   - Implement service worker for caching

## Security Checklist

- [ ] HTTPS enabled
- [ ] Strong JWT secret
- [ ] Database credentials secured
- [ ] SendGrid API key protected
- [ ] Rate limiting configured
- [ ] Input validation enabled
- [ ] CORS properly configured
- [ ] Security headers set (helmet.js)
- [ ] Regular security updates
- [ ] Audit logs enabled