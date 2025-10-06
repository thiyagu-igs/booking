# Authentication System

This document describes the authentication and authorization system implemented for the Waitlist Management System.

## Overview

The authentication system provides:
- JWT-based stateless authentication
- Tenant-scoped authorization
- Role-based access control (RBAC)
- Password strength validation
- Secure password hashing with bcrypt

## Architecture

### Components

1. **AuthService** - Core authentication logic
2. **UserRepository** - Database operations for users
3. **AuthMiddleware** - Express middleware for authentication/authorization
4. **Validation Schemas** - Request validation using Joi

### Security Features

- **JWT Tokens**: Stateless authentication with configurable expiration
- **Password Hashing**: bcrypt with 12 salt rounds
- **Tenant Isolation**: All database queries are automatically scoped to tenant
- **Role-Based Access**: Admin, Manager, and Staff roles with different permissions
- **Input Validation**: Comprehensive validation for all auth endpoints

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new user.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "name": "John Doe",
  "role": "staff",
  "tenantId": "tenant-uuid"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "tenant_id": "tenant-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "staff",
      "active": true,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt-token-here"
  }
}
```

#### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!",
  "tenantId": "tenant-uuid"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user-uuid",
      "tenant_id": "tenant-uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "staff",
      "active": true,
      "last_login_at": "2024-01-01T00:00:00.000Z"
    },
    "token": "jwt-token-here"
  }
}
```

#### POST /api/auth/verify
Verify JWT token validity.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Response:**
```json
{
  "message": "Token is valid",
  "data": {
    "user": {
      "userId": "user-uuid",
      "tenantId": "tenant-uuid",
      "email": "user@example.com",
      "role": "staff"
    }
  }
}
```

#### GET /api/auth/me
Get current user profile.

**Headers:**
```
Authorization: Bearer jwt-token-here
```

**Response:**
```json
{
  "message": "User profile retrieved successfully",
  "data": {
    "id": "user-uuid",
    "tenant_id": "tenant-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "staff",
    "active": true,
    "last_login_at": "2024-01-01T00:00:00.000Z",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

## Middleware Usage

### Authentication Middleware

```typescript
import { authenticate } from '../middleware/auth';

// Require authentication for this route
router.get('/protected', authenticate, (req, res) => {
  // req.user contains the authenticated user info
  // req.tenantId contains the tenant ID
  // req.repositories contains tenant-scoped repositories
  res.json({ user: req.user });
});
```

### Role-Based Authorization

```typescript
import { authenticate, requireAdmin, requireManager } from '../middleware/auth';

// Admin only
router.get('/admin-only', authenticate, requireAdmin, (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Manager or Admin
router.get('/manager-access', authenticate, requireManager, (req, res) => {
  res.json({ message: 'Manager/Admin access granted' });
});

// Custom role check
import { requireRole } from '../middleware/auth';

router.get('/staff-only', authenticate, requireRole('staff'), (req, res) => {
  res.json({ message: 'Staff access granted' });
});
```

### Optional Authentication

```typescript
import { optionalAuth } from '../middleware/auth';

// Authentication is optional - sets user context if token provided
router.get('/optional-auth', optionalAuth, (req, res) => {
  if (req.user) {
    res.json({ message: 'Authenticated user', user: req.user });
  } else {
    res.json({ message: 'Anonymous user' });
  }
});
```

## Tenant Isolation

All database operations are automatically scoped to the authenticated user's tenant:

```typescript
router.get('/my-data', authenticate, async (req, res) => {
  // These repositories are automatically scoped to req.user.tenantId
  const users = await req.repositories.user.findActiveUsers();
  const tenant = await req.repositories.tenant.findById(req.tenantId);
  
  res.json({ users, tenant });
});
```

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character

## User Roles

### Staff
- Basic access to waitlist and booking features
- Can view and manage their assigned slots
- Cannot modify system settings

### Manager  
- All staff permissions
- Can manage staff members
- Can modify business settings
- Can view analytics and reports

### Admin
- All manager permissions
- Can manage user accounts
- Can access system administration features
- Full access to all tenant data

## Environment Variables

```env
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
```

## Security Considerations

1. **JWT Secret**: Use a strong, randomly generated secret in production
2. **HTTPS**: Always use HTTPS in production to protect tokens in transit
3. **Token Storage**: Store tokens securely on the client side
4. **Token Expiration**: Configure appropriate token expiration times
5. **Password Policy**: Enforce strong password requirements
6. **Rate Limiting**: Implement rate limiting on auth endpoints (recommended)

## Testing

The authentication system includes comprehensive unit tests:

```bash
# Run authentication tests
npm test -- --testPathPattern="auth"

# Run integration tests
npm test -- --testPathPattern="auth-integration"
```

## Error Handling

The system provides detailed error responses:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters long",
      "value": "short"
    }
  ]
}
```

Common error codes:
- `UNAUTHORIZED` - Missing or invalid authentication
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Invalid request data
- `USER_EXISTS` - Email already registered
- `LOGIN_FAILED` - Invalid credentials
- `INVALID_TOKEN` - Token verification failed

## Usage Examples

See the demo routes in `/api/demo/` for working examples of:
- Public endpoints
- Protected endpoints  
- Role-based access control
- Tenant-scoped data access