# Waitlist Management System

A multi-tenant SaaS application for service-based businesses to manage waitlists and fill last-minute cancellations automatically.

## Features

- Multi-tenant architecture with application-level data isolation
- Automated waitlist matching and notifications
- Priority-based customer ranking
- Email notifications with confirmation links
- Real-time slot management
- Business dashboard for monitoring
- Analytics and reporting
- Google Calendar integration (optional)

## Tech Stack

- **Backend**: Node.js with Express.js and TypeScript
- **Database**: MySQL 8.0+ with connection pooling
- **Cache**: Redis for sessions and rate limiting
- **Notifications**: SendGrid for email (Twilio for SMS/WhatsApp in Phase 2)
- **Authentication**: JWT tokens with tenant-scoped permissions
- **Validation**: Joi for schema validation
- **Testing**: Jest with TypeScript support

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Redis 6+
- SendGrid account (for email notifications)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd waitlist-management-system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your MySQL and other service configurations
```

4. Set up the database:
```bash
# Create databases
mysql -u root -p -e "CREATE DATABASE waitlist_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE DATABASE waitlist_management_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Run migrations
npm run migrate
```

5. Build the project:
```bash
npm run build
```

6. Start the development server:
```bash
npm run dev
```

## Database Schema

The system uses MySQL with application-level tenant isolation. All tables include a `tenant_id` column and queries are automatically filtered by tenant context. Key tables include:

- `tenants` - Business accounts with timezone settings
- `staff` - Staff members per tenant with roles
- `services` - Services offered with duration and pricing
- `slots` - Available time slots with status tracking
- `waitlist_entries` - Customer waitlist entries with priority scoring
- `notifications` - Message delivery tracking and status
- `bookings` - Confirmed appointments with source tracking
- `audit_logs` - Complete system activity audit trail

### Tenant Isolation

Data isolation is implemented at the application layer using the repository pattern:
- All repositories automatically filter by `tenant_id`
- JWT tokens contain tenant context
- Middleware extracts tenant information and creates scoped repositories
- No cross-tenant data access is possible

## Project Structure

```
src/
├── config/           # Configuration files
├── database/         # Database connection and migrations
│   └── migrations/   # Database schema migrations
├── models/           # TypeScript interfaces and enums
├── repositories/     # Data access layer with tenant isolation
├── validation/       # Joi validation schemas
└── index.ts         # Application entry point
```

## API Endpoints (To be implemented in future tasks)

### Waitlist Management
- `POST /api/waitlist` - Add customer to waitlist
- `GET /api/waitlist` - Get waitlist entries with filtering
- `DELETE /api/waitlist/:id` - Remove from waitlist

### Slot Management
- `POST /api/slots` - Create new slot
- `POST /api/slots/:id/open` - Mark slot as available and trigger matching
- `GET /api/slots` - Get slots with filters

### Confirmation
- `POST /api/confirm/:token` - Confirm slot booking
- `POST /api/decline/:token` - Decline slot offer

## Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start           # Start production server

# Database
npm run migrate     # Run database migrations
npm run migrate:rollback  # Rollback last migration
npm run migrate:make <name>  # Create new migration

# Testing
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
```

## Environment Variables

Key environment variables (see `.env.example` for complete list):

```bash
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=waitlist_management
DB_USER=root
DB_PASSWORD=password

# JWT
JWT_SECRET=your-secret-key-min-32-chars
JWT_EXPIRES_IN=24h

# Redis
REDIS_URL=redis://localhost:6379

# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Deployment

The application is designed to be deployed on platforms like Render, Fly.io, or Railway with MySQL and Redis add-ons. Docker support will be added in future tasks.

## Development Status

✅ **Task 1 Complete**: Project structure and database foundation
- Node.js + TypeScript configuration
- MySQL database with connection pooling
- Application-level tenant isolation with repository pattern
- Complete database schema with migrations
- Data validation with Joi schemas

🔄 **Next Tasks**: Authentication, core services, and API endpoints

## License

MIT