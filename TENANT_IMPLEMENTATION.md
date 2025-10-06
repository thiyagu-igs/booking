# Tenant ID Implementation

## Overview
The authentication system now properly handles tenant ID in all auth requests. This enables multi-tenant functionality where each organization has its own isolated data.

## Backend Changes
- ✅ `AuthService.ts` already requires `tenantId` in login/register
- ✅ `LoginCredentials` and `RegisterData` interfaces include `tenantId`
- ✅ Auth routes extract `tenantId` from request body
- ✅ Validation schemas require `tenantId` as UUID format

## Frontend Changes Made

### 1. Updated AuthContext (`frontend/src/contexts/AuthContext.tsx`)
- Added `tenantId` parameter to login function
- Added tenant ID validation using `TenantService.isValidTenantId()`
- Store selected tenant for future use
- Clear tenant data on logout
- Fixed response data structure (`response.data.data`)

### 2. Enhanced LoginPage (`frontend/src/pages/LoginPage.tsx`)
- Added tenant ID input field with validation
- Auto-detect tenant from URL subdomain or stored selection
- Better error handling for tenant-specific errors
- Integrated `TenantSelector` component for better UX

### 3. Created TenantService (`frontend/src/services/tenant.ts`)
- Auto-detect tenant from URL subdomain
- Store/retrieve tenant selection in localStorage
- Validate UUID format for tenant IDs
- Support for tenant discovery API

### 4. Created TenantSelector Component (`frontend/src/components/TenantSelector.tsx`)
- Dropdown with available tenants
- Manual tenant ID input
- Auto-complete functionality
- Click-outside to close dropdown

### 5. Sample Configuration (`frontend/src/config/tenants.ts`)
- Sample tenant data for development
- Helper functions for tenant lookup

## Usage

### Login Request Format
```javascript
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Register Request Format
```javascript
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "role": "staff",
  "tenantId": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Tenant Detection Methods

1. **URL Subdomain**: `demo.waitlist.com` → tenant ID for "demo"
2. **Stored Selection**: Previously selected tenant in localStorage
3. **Manual Input**: User enters tenant ID directly
4. **Development Default**: First sample tenant for localhost

## Sample Tenant IDs for Testing

- Demo Restaurant: `123e4567-e89b-12d3-a456-426614174000`
- Test Clinic: `987fcdeb-51a2-43d1-9f12-123456789abc`

## Security Notes

- Tenant ID must be valid UUID format
- Backend validates tenant existence and user access
- JWT tokens include tenant ID for request scoping
- All subsequent API calls are automatically tenant-scoped

## Development Setup

1. Use sample tenant IDs from `frontend/src/config/tenants.ts`
2. For localhost, the first sample tenant is auto-selected
3. For subdomain testing, update your hosts file:
   ```
   127.0.0.1 demo.localhost
   127.0.0.1 clinic.localhost
   ```

## Production Considerations

1. Replace sample tenant data with real tenant discovery API
2. Implement proper tenant validation on backend
3. Consider tenant-specific domains/subdomains
4. Add tenant management interface for admins