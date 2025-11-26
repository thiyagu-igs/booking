# Booking Management System Design

## Overview

This design document outlines the implementation of a comprehensive booking management system that enables staff to view, create, and manage bookings directly from the admin panel. The system will integrate with existing slot management, waitlist, and calendar synchronization features while providing a dedicated interface for booking operations.

The booking management system addresses the current limitation where bookings can only be created through the waitlist notification flow. This enhancement will support walk-in customers, phone reservations, and direct booking requests while maintaining data consistency and audit trails.

## Architecture

### System Components

The booking management system follows the existing layered architecture:

1. **Presentation Layer** (Frontend)
   - BookingsPage component for listing and filtering bookings
   - CreateBookingModal component for manual booking creation
   - BookingDetailsModal component for viewing booking information
   - Navigation integration for accessing booking features

2. **API Layer** (Backend Routes)
   - `/api/bookings` - RESTful endpoints for booking operations
   - Integration with existing authentication and tenant middleware

3. **Business Logic Layer** (Services)
   - BookingService - Core booking business logic
   - Integration with SlotService for slot management
   - Integration with CalendarService for calendar synchronization

4. **Data Access Layer** (Repositories)
   - BookingRepository - Database operations for bookings
   - Reuse existing SlotRepository, ServiceRepository, StaffRepository

5. **Database Layer**
   - Existing `bookings` table (already defined in migrations)
   - Relationships with slots, services, staff, and waitlist entries

### Data Flow

**Viewing Bookings:**
```
User → BookingsPage → API GET /bookings → BookingService → BookingRepository → Database
```

**Creating Manual Booking:**
```
User → CreateBookingModal → API POST /bookings → BookingService → SlotService.bookSlot → Database
                                                                  → CalendarService.createEvent
                                                                  → AuditLog
```

**Updating Booking Status:**
```
User → BookingDetailsModal → API PATCH /bookings/:id → BookingService → BookingRepository → Database
                                                                       → AuditLog
```

## Components and Interfaces

### Frontend Components

#### BookingsPage Component

**Purpose:** Main page for viewing and managing all bookings

**Props:** None (uses route context)

**State:**
```typescript
interface BookingsPageState {
  bookings: BookingWithDetails[]
  loading: boolean
  filters: BookingFilters
  selectedBooking: BookingWithDetails | null
  showCreateModal: boolean
  showDetailsModal: boolean
}

interface BookingFilters {
  search: string
  dateRange: { start: Date; end: Date }
  service: string
  staff: string
  status: BookingStatus | ''
  source: BookingSource | ''
}

interface BookingWithDetails {
  id: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  serviceName: string
  staffName: string
  startTime: Date
  endTime: Date
  status: BookingStatus
  bookingSource: BookingSource
  confirmedAt?: Date
  completedAt?: Date
  createdAt: Date
}
```

**Key Features:**
- Filterable and searchable booking list
- Date range picker for filtering bookings
- Status badges with color coding
- Quick actions (view details, mark completed, mark no-show, cancel)
- Responsive table layout with mobile support
- Real-time updates when bookings change

#### CreateBookingModal Component

**Purpose:** Modal dialog for creating manual bookings

**Props:**
```typescript
interface CreateBookingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (booking: Booking) => void
}
```

**State:**
```typescript
interface CreateBookingFormData {
  serviceId: string
  staffId: string | 'any'
  slotId: string
  customerName: string
  customerPhone: string
  customerEmail: string
  bookingSource: BookingSource
}

interface CreateBookingModalState {
  formData: CreateBookingFormData
  services: Service[]
  staff: Staff[]
  availableSlots: SlotWithDetails[]
  loading: boolean
  errors: Record<string, string>
  step: 'service' | 'slot' | 'customer'
}
```

**Workflow:**
1. Select service (required)
2. Select staff member or "any available" (optional)
3. View and select from available open slots
4. Enter customer information
5. Select booking source
6. Submit and create booking

#### BookingDetailsModal Component

**Purpose:** Modal dialog for viewing and managing booking details

**Props:**
```typescript
interface BookingDetailsModalProps {
  booking: BookingWithDetails
  isOpen: boolean
  onClose: () => void
  onUpdate: (booking: Booking) => void
}
```

**Actions Available:**
- Mark as completed (for confirmed bookings)
- Mark as no-show (for confirmed bookings)
- Cancel booking (for confirmed bookings)
- View full customer information
- View service and staff details
- View booking history and audit trail

### Backend API Endpoints

#### GET /api/bookings

**Purpose:** Retrieve bookings with filtering and pagination

**Query Parameters:**
```typescript
interface GetBookingsQuery {
  start_date?: string // ISO date
  end_date?: string // ISO date
  service_id?: string
  staff_id?: string
  status?: BookingStatus
  source?: BookingSource
  search?: string // Search by customer name, phone, or email
  page?: number
  limit?: number
}
```

**Response:**
```typescript
interface GetBookingsResponse {
  success: boolean
  bookings: BookingWithDetails[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

#### POST /api/bookings

**Purpose:** Create a new manual booking

**Request Body:**
```typescript
interface CreateBookingRequest {
  slot_id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  booking_source: BookingSource
}
```

**Validation:**
- slot_id: Required, must be valid UUID, slot must exist and be open
- customer_name: Required, 2-100 characters
- customer_phone: Required, valid phone format
- customer_email: Optional, valid email format if provided
- booking_source: Required, must be 'direct', 'walk_in', or 'manual'

**Response:**
```typescript
interface CreateBookingResponse {
  success: boolean
  booking: BookingWithDetails
  message: string
}
```

**Error Responses:**
- 400: Invalid request data or slot not available
- 404: Slot not found
- 409: Slot already booked (race condition)
- 500: Server error

#### GET /api/bookings/:id

**Purpose:** Get detailed information about a specific booking

**Response:**
```typescript
interface GetBookingResponse {
  success: boolean
  booking: BookingWithDetails & {
    slotDetails: {
      startTime: Date
      endTime: Date
      status: SlotStatus
    }
    serviceDetails: {
      name: string
      duration: number
      price?: number
    }
    staffDetails: {
      name: string
      role?: string
    }
    auditTrail: AuditLog[]
  }
}
```

#### PATCH /api/bookings/:id

**Purpose:** Update booking status

**Request Body:**
```typescript
interface UpdateBookingRequest {
  status: BookingStatus
}
```

**Validation:**
- Only certain status transitions are allowed:
  - confirmed → completed
  - confirmed → no_show
  - confirmed → canceled
- Cannot update already completed, canceled, or no-show bookings

**Response:**
```typescript
interface UpdateBookingResponse {
  success: boolean
  booking: BookingWithDetails
  message: string
}
```

#### GET /api/bookings/stats

**Purpose:** Get booking statistics for dashboard

**Query Parameters:**
```typescript
interface GetBookingStatsQuery {
  start_date?: string // ISO date
  end_date?: string // ISO date
}
```

**Response:**
```typescript
interface GetBookingStatsResponse {
  success: boolean
  stats: {
    totalBookings: number
    todayBookings: number
    upcomingBookings: number
    completedBookings: number
    noShowCount: number
    noShowRate: number
    canceledBookings: number
    bySource: {
      waitlist: number
      direct: number
      walk_in: number
    }
    byStatus: {
      confirmed: number
      completed: number
      no_show: number
      canceled: number
    }
  }
}
```

### Backend Services

#### BookingService

**Purpose:** Business logic for booking operations

**Methods:**

```typescript
class BookingService {
  constructor(
    private bookingRepo: BookingRepository,
    private slotService: SlotService,
    private serviceRepo: ServiceRepository,
    private staffRepo: StaffRepository,
    private tenantId: string
  )

  // Get bookings with filtering
  async getBookings(filters: BookingFilters): Promise<BookingWithDetails[]>

  // Get booking by ID with full details
  async getBookingById(bookingId: string): Promise<BookingWithDetails | null>

  // Create manual booking
  async createManualBooking(data: CreateManualBookingData): Promise<Booking>

  // Update booking status
  async updateBookingStatus(
    bookingId: string,
    status: BookingStatus,
    actorId: string
  ): Promise<Booking>

  // Cancel booking and release slot
  async cancelBooking(bookingId: string, actorId: string): Promise<Booking>

  // Mark booking as completed
  async markAsCompleted(bookingId: string, actorId: string): Promise<Booking>

  // Mark booking as no-show
  async markAsNoShow(bookingId: string, actorId: string): Promise<Booking>

  // Get booking statistics
  async getBookingStats(startDate: Date, endDate: Date): Promise<BookingStats>

  // Validate booking status transition
  private validateStatusTransition(
    currentStatus: BookingStatus,
    newStatus: BookingStatus
  ): boolean
}
```

**Business Rules:**

1. **Booking Creation:**
   - Slot must be in "open" status
   - Slot must be in the future
   - Customer phone is required
   - Booking source must be specified
   - Slot is marked as "booked" atomically
   - Calendar event is created if calendar sync is enabled
   - Audit log entry is created

2. **Status Transitions:**
   - confirmed → completed (valid)
   - confirmed → no_show (valid)
   - confirmed → canceled (valid)
   - All other transitions are invalid

3. **Cancellation:**
   - Only confirmed bookings can be canceled
   - Slot is released and marked as "open"
   - Calendar event is deleted if it exists
   - Audit log entry is created

4. **Completion:**
   - Only confirmed bookings can be marked as completed
   - Slot remains in "booked" status
   - Audit log entry is created

5. **No-Show:**
   - Only confirmed bookings can be marked as no-show
   - Slot is released and marked as "open"
   - No-show is tracked for analytics
   - Audit log entry is created

### Backend Repositories

#### BookingRepository

**Purpose:** Data access layer for bookings

**Methods:**

```typescript
class BookingRepository extends BaseRepository<Booking> {
  protected tableName = 'bookings'

  // Find bookings with details (joins with slots, services, staff)
  async findWithDetails(filters: BookingFilters): Promise<BookingWithDetails[]>

  // Find booking by ID with full details
  async findByIdWithDetails(bookingId: string): Promise<BookingWithDetails | null>

  // Find bookings by slot ID
  async findBySlotId(slotId: string): Promise<Booking[]>

  // Find bookings by customer phone
  async findByCustomerPhone(phone: string): Promise<Booking[]>

  // Find bookings by date range
  async findByDateRange(startDate: Date, endDate: Date): Promise<Booking[]>

  // Get booking statistics
  async getBookingStats(startDate: Date, endDate: Date): Promise<BookingStats>

  // Count bookings by status
  async countByStatus(status: BookingStatus): Promise<number>

  // Count bookings by source
  async countBySource(source: BookingSource): Promise<number>

  // Find upcoming bookings (next 7 days)
  async findUpcoming(days: number = 7): Promise<Booking[]>

  // Find today's bookings
  async findToday(): Promise<Booking[]>
}
```

## Data Models

### Booking Model (Existing)

The `bookings` table already exists in the database schema:

```typescript
interface Booking {
  id: string // UUID
  tenant_id: string // UUID
  slot_id: string // UUID, foreign key to slots
  waitlist_entry_id?: string // UUID, foreign key to waitlist_entries (nullable)
  customer_name: string
  customer_phone: string
  customer_email?: string
  status: BookingStatus // 'confirmed' | 'completed' | 'no_show' | 'canceled'
  booking_source: BookingSource // 'waitlist' | 'direct' | 'walk_in'
  confirmed_at?: Date
  completed_at?: Date
  created_at: Date
  updated_at?: Date
}
```

**Relationships:**
- `slot_id` → `slots.id` (many-to-one)
- `waitlist_entry_id` → `waitlist_entries.id` (many-to-one, nullable)
- `tenant_id` → `tenants.id` (many-to-one)

**Indexes:**
- Primary key: `id`
- Foreign keys: `tenant_id`, `slot_id`, `waitlist_entry_id`
- Query optimization: `(tenant_id, status)`, `(tenant_id, booking_source)`, `(tenant_id, created_at)`

## Error Handling

### Frontend Error Handling

**Network Errors:**
- Display toast notification with error message
- Provide retry option for failed requests
- Show loading states during operations

**Validation Errors:**
- Display inline error messages on form fields
- Highlight invalid fields
- Prevent form submission until errors are resolved

**Conflict Errors (409):**
- Show user-friendly message: "This slot is no longer available"
- Refresh available slots list
- Allow user to select a different slot

### Backend Error Handling

**Validation Errors (400):**
```typescript
{
  success: false,
  error: 'Validation failed',
  details: {
    field: 'customer_phone',
    message: 'Invalid phone number format'
  }
}
```

**Not Found Errors (404):**
```typescript
{
  success: false,
  error: 'Booking not found'
}
```

**Conflict Errors (409):**
```typescript
{
  success: false,
  error: 'Slot is no longer available',
  message: 'This slot has been booked by another customer'
}
```

**Server Errors (500):**
```typescript
{
  success: false,
  error: 'Internal server error',
  message: 'An unexpected error occurred. Please try again.'
}
```

### Error Recovery

1. **Race Conditions:** Use database transactions to prevent double-booking
2. **Calendar Sync Failures:** Log error but don't fail booking creation
3. **Audit Log Failures:** Log error but don't fail the operation
4. **Network Timeouts:** Implement retry logic with exponential backoff

## Testing Strategy

### Unit Tests

**Backend Services:**
- BookingService.createManualBooking()
  - Test successful booking creation
  - Test validation errors
  - Test slot not available error
  - Test calendar sync integration
- BookingService.updateBookingStatus()
  - Test valid status transitions
  - Test invalid status transitions
  - Test audit log creation
- BookingService.cancelBooking()
  - Test successful cancellation
  - Test slot release
  - Test calendar event deletion

**Backend Repositories:**
- BookingRepository.findWithDetails()
  - Test filtering by date range
  - Test filtering by status
  - Test filtering by source
  - Test search functionality
- BookingRepository.getBookingStats()
  - Test statistics calculation
  - Test date range filtering

**Frontend Components:**
- CreateBookingModal
  - Test form validation
  - Test service selection
  - Test slot selection
  - Test customer information input
  - Test successful submission
- BookingsPage
  - Test booking list rendering
  - Test filtering functionality
  - Test search functionality
  - Test status updates

### Integration Tests

**API Endpoints:**
- POST /api/bookings
  - Test end-to-end booking creation
  - Test authentication and authorization
  - Test tenant isolation
  - Test concurrent booking attempts (race conditions)
- PATCH /api/bookings/:id
  - Test status updates
  - Test audit trail creation
  - Test slot status changes
- GET /api/bookings
  - Test filtering and pagination
  - Test search functionality
  - Test performance with large datasets

**Database Operations:**
- Test transaction rollback on errors
- Test foreign key constraints
- Test cascade operations
- Test index performance

### Manual Testing Checklist

**Booking Creation:**
- [ ] Create booking for walk-in customer
- [ ] Create booking for phone reservation
- [ ] Create booking with email
- [ ] Create booking without email
- [ ] Verify slot is marked as booked
- [ ] Verify calendar event is created
- [ ] Verify audit log entry

**Booking Management:**
- [ ] View booking list with filters
- [ ] Search bookings by customer name
- [ ] Search bookings by phone number
- [ ] Filter by date range
- [ ] Filter by service
- [ ] Filter by staff
- [ ] Filter by status
- [ ] Filter by source

**Status Updates:**
- [ ] Mark booking as completed
- [ ] Mark booking as no-show
- [ ] Cancel booking
- [ ] Verify slot is released on cancellation
- [ ] Verify slot is released on no-show
- [ ] Verify audit log entries

**Dashboard Integration:**
- [ ] Verify booking statistics display
- [ ] Verify today's bookings count
- [ ] Verify upcoming bookings count
- [ ] Verify no-show rate calculation

**Navigation:**
- [ ] Access bookings page from main menu
- [ ] Verify active navigation highlight
- [ ] Verify authentication requirement

## Implementation Notes

### Phase 1: Backend Foundation
1. Create BookingRepository with core methods
2. Create BookingService with business logic
3. Implement API endpoints for booking operations
4. Add validation and error handling
5. Create unit tests for services and repositories

### Phase 2: Frontend UI
1. Create BookingsPage component
2. Create CreateBookingModal component
3. Create BookingDetailsModal component
4. Add navigation menu item
5. Implement filtering and search
6. Add loading and error states

### Phase 3: Integration
1. Integrate with SlotService for slot management
2. Integrate with CalendarService for calendar sync
3. Add audit logging for all operations
4. Test end-to-end workflows
5. Handle edge cases and race conditions

### Phase 4: Dashboard Enhancement
1. Add booking statistics to dashboard
2. Update dashboard API to include booking metrics
3. Add booking-related widgets
4. Test dashboard performance

### Security Considerations

1. **Authentication:** All booking endpoints require authentication
2. **Authorization:** Users can only access bookings for their tenant
3. **Input Validation:** Validate all user inputs on both frontend and backend
4. **SQL Injection:** Use parameterized queries (handled by Knex.js)
5. **XSS Prevention:** Sanitize user inputs before display
6. **Rate Limiting:** Implement rate limiting on booking creation endpoint
7. **Audit Trail:** Log all booking operations for accountability

### Performance Considerations

1. **Database Indexes:** Ensure proper indexes on frequently queried columns
2. **Pagination:** Implement pagination for booking list to handle large datasets
3. **Caching:** Consider caching booking statistics for dashboard
4. **Query Optimization:** Use joins efficiently to minimize database queries
5. **Lazy Loading:** Load booking details only when needed
6. **Debouncing:** Debounce search input to reduce API calls

### Accessibility

1. **Keyboard Navigation:** Ensure all interactive elements are keyboard accessible
2. **Screen Readers:** Add ARIA labels and roles for screen reader support
3. **Color Contrast:** Ensure sufficient color contrast for status badges
4. **Focus Management:** Manage focus properly in modals
5. **Error Announcements:** Announce errors to screen readers

### Mobile Responsiveness

1. **Responsive Tables:** Use responsive table design for mobile devices
2. **Touch Targets:** Ensure touch targets are large enough (44x44px minimum)
3. **Modal Sizing:** Ensure modals fit on mobile screens
4. **Form Layout:** Stack form fields vertically on mobile
5. **Navigation:** Ensure navigation menu works on mobile devices
