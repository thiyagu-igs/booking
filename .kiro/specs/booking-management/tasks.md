# Implementation Plan

**Note:** Backend Booking model, BookingStatus enum, and BookingSource enum are already defined in `src/models/index.ts`. The bookings database table already exists via migration `008_create_bookings_table.ts`.

- [x] 1. Create BookingRepository for data access





  - Implement BookingRepository class extending BaseRepository
  - Add findWithDetails method with joins for slots, services, and staff
  - Add findByIdWithDetails method for detailed booking view
  - Add findByDateRange, findToday, and findUpcoming methods
  - Add getBookingStats method for dashboard statistics
  - Add countByStatus and countBySource methods
  - _Requirements: 1.1, 1.4, 6.1, 6.2, 6.3, 6.4_

- [x] 2. Create BookingService for business logic





- [x] 2.1 Implement core BookingService class


  - Create BookingService class with constructor dependencies
  - Implement getBookings method with filtering support
  - Implement getBookingById method with full details
  - Implement getBookingStats method for dashboard
  - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 6.4_

- [x] 2.2 Implement manual booking creation

  - Add createManualBooking method with validation
  - Validate slot availability and status
  - Validate customer information
  - Use SlotService.bookSlot to mark slot as booked
  - Create booking record with transaction
  - Integrate with CalendarService for event creation
  - Add audit log entry for booking creation
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 2.3 Implement booking status management

  - Add updateBookingStatus method with validation
  - Implement validateStatusTransition private method
  - Add markAsCompleted method
  - Add markAsNoShow method with slot release
  - Add cancelBooking method with slot release and calendar deletion
  - Add audit log entries for all status changes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3. Create booking API endpoints





- [x] 3.1 Implement GET /api/bookings endpoint


  - Create bookings router file
  - Add GET /api/bookings route with authentication middleware
  - Implement query parameter parsing for filters
  - Add pagination support
  - Call BookingService.getBookings with filters
  - Return formatted response with bookings and pagination
  - Add error handling
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3.2 Implement POST /api/bookings endpoint


  - Add POST /api/bookings route with authentication
  - Create Joi validation schema for request body
  - Validate slot_id, customer_name, customer_phone, customer_email, booking_source
  - Call BookingService.createManualBooking
  - Return success response with created booking
  - Handle 400, 404, 409, and 500 errors
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

- [x] 3.3 Implement GET /api/bookings/:id endpoint


  - Add GET /api/bookings/:id route with authentication
  - Validate booking ID parameter
  - Call BookingService.getBookingById
  - Return detailed booking information with audit trail
  - Handle 404 error for booking not found
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3.4 Implement PATCH /api/bookings/:id endpoint


  - Add PATCH /api/bookings/:id route with authentication
  - Create Joi validation schema for status updates
  - Validate status transition
  - Call appropriate BookingService method based on status
  - Return updated booking
  - Handle validation and conflict errors
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3.5 Implement GET /api/bookings/stats endpoint


  - Add GET /api/bookings/stats route with authentication
  - Parse date range query parameters
  - Call BookingService.getBookingStats
  - Return formatted statistics response
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3.6 Register bookings router in main application


  - Import bookings router in src/index.ts
  - Register router with /api/bookings prefix
  - Ensure authentication middleware is applied
  - _Requirements: 7.4_

- [x] 4. Create BookingsPage frontend component




- [x] 4.1 Create BookingsPage component structure


  - Create frontend/src/pages/BookingsPage.tsx file
  - Set up component state for bookings, filters, loading, and modals
  - Implement useEffect hook to load bookings on mount
  - Create loadBookings function to fetch from API
  - Add loading spinner for initial load
  - _Requirements: 1.1, 7.1, 7.2, 7.3, 7.4_

- [x] 4.2 Implement booking list table


  - Create responsive table with columns for customer, service, staff, date/time, status, source, actions
  - Implement status badge component with color coding
  - Add booking source badge display
  - Format dates and times using date-fns
  - Add empty state message when no bookings found
  - _Requirements: 1.1, 1.5_

- [x] 4.3 Implement filtering and search


  - Create filter controls for search, date range, service, staff, status, source
  - Add date range picker component
  - Implement filter state management
  - Add applyFilters function to filter bookings client-side or trigger API call
  - Add clear filters button
  - _Requirements: 1.2, 1.3_

- [x] 4.4 Implement quick actions


  - Add action buttons for view details, mark completed, mark no-show, cancel
  - Implement handleMarkCompleted function with API call
  - Implement handleMarkNoShow function with API call
  - Implement handleCancelBooking function with confirmation dialog
  - Show success/error toast notifications
  - Refresh booking list after actions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 4.5 Add create booking button


  - Add "Create Booking" button to page header
  - Implement onClick handler to open CreateBookingModal
  - _Requirements: 2.1_

- [x] 5. Create CreateBookingModal component





- [x] 5.1 Create modal structure and form state


  - Create frontend/src/components/CreateBookingModal.tsx file
  - Set up modal component with isOpen, onClose, onSuccess props
  - Create form state for serviceId, staffId, slotId, customer info, booking source
  - Add step state for multi-step form (service → slot → customer)
  - Load services and staff on modal open
  - _Requirements: 2.1, 2.2_

- [x] 5.2 Implement service and staff selection step


  - Create service dropdown with all active services
  - Create staff dropdown with "Any Available" option and all active staff
  - Add validation for required service selection
  - Implement handleServiceChange to load available slots
  - Add "Next" button to proceed to slot selection
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 5.3 Implement slot selection step


  - Fetch available open slots for selected service and staff
  - Display slots in a grid or list with date, time, staff name
  - Add slot selection radio buttons or cards
  - Show "No available slots" message if none found
  - Add "Back" and "Next" buttons for navigation
  - _Requirements: 2.3_

- [x] 5.4 Implement customer information step


  - Create form fields for customer name (required), phone (required), email (optional)
  - Add validation for name (2-100 chars), phone format, email format
  - Create booking source dropdown (manual, phone, walk-in)
  - Display inline validation errors
  - Add "Back" and "Create Booking" buttons
  - _Requirements: 2.5, 2.6, 2.7_

- [x] 5.5 Implement form submission


  - Create handleSubmit function to call POST /api/bookings
  - Show loading state during submission
  - Handle success: show toast, call onSuccess callback, close modal
  - Handle errors: display error messages, handle 409 conflict
  - Reset form state on close
  - _Requirements: 2.8, 2.9_

- [x] 6. Create BookingDetailsModal component





- [x] 6.1 Create modal structure


  - Create frontend/src/components/BookingDetailsModal.tsx file
  - Set up modal with booking prop, isOpen, onClose, onUpdate props
  - Display booking information in organized sections
  - _Requirements: 3.1_

- [x] 6.2 Display booking details

  - Show customer information section (name, phone, email)
  - Show service details section (name, duration, staff)
  - Show appointment details section (date, time, status)
  - Show booking metadata section (source, created at, confirmed at)
  - Format dates and times consistently
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6.3 Implement action buttons

  - Add "Mark as Completed" button for confirmed bookings
  - Add "Mark as No-Show" button for confirmed bookings
  - Add "Cancel Booking" button for confirmed bookings
  - Disable buttons based on current status
  - Implement onClick handlers to call PATCH /api/bookings/:id
  - Show confirmation dialog for destructive actions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6.4 Handle status updates

  - Call onUpdate callback after successful status change
  - Show success toast notification
  - Close modal or refresh details
  - Handle errors and display error messages
  - _Requirements: 4.5, 5.4, 5.5_

- [x] 7. Add bookings navigation menu item





  - Update frontend/src/components/Layout.tsx or navigation component
  - Add "Bookings" menu item with CalendarDaysIcon
  - Link to /bookings route
  - Add active state highlighting
  - _Requirements: 7.1, 7.2, 7.3_

- [ ] 8. Add bookings route to App.tsx
  - Import BookingsPage component in frontend/src/App.tsx
  - Add Route for /bookings path
  - Ensure route is protected by authentication
  - _Requirements: 7.1, 7.4_

- [ ] 9. Update Dashboard with booking statistics
- [ ] 9.1 Update dashboard API to include booking stats
  - Modify GET /api/dashboard/stats endpoint
  - Add BookingService.getBookingStats call
  - Include booking statistics in response
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9.2 Update Dashboard component to display booking stats
  - Update frontend/src/pages/Dashboard.tsx
  - Add booking statistics to stat cards
  - Display today's bookings count
  - Display upcoming bookings count
  - Display no-show rate
  - Update stat cards styling and icons
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 10. Add API service methods for bookings
  - Create or update frontend/src/services/api.ts
  - Add getBookings method with filter parameters
  - Add createBooking method
  - Add getBookingById method
  - Add updateBookingStatus method
  - Add getBookingStats method
  - Add proper TypeScript types for all methods
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1_

- [ ] 11. Create TypeScript types for bookings
  - Create or update frontend/src/types/booking.ts
  - Define Booking interface
  - Define BookingWithDetails interface
  - Define BookingFilters interface
  - Define CreateBookingRequest interface
  - Define BookingStats interface
  - Export BookingStatus and BookingSource enums
  - _Requirements: 1.1, 2.1, 3.1, 6.1_

- [ ]* 12. Write integration tests for booking API
  - Create test file for booking endpoints
  - Test POST /api/bookings with valid data
  - Test POST /api/bookings with invalid data
  - Test POST /api/bookings with unavailable slot (409 conflict)
  - Test GET /api/bookings with various filters
  - Test PATCH /api/bookings/:id for status updates
  - Test GET /api/bookings/stats
  - Test authentication and tenant isolation
  - _Requirements: All_

- [ ]* 13. Write unit tests for BookingService
  - Create test file for BookingService
  - Test createManualBooking with valid data
  - Test createManualBooking with invalid slot
  - Test updateBookingStatus with valid transitions
  - Test updateBookingStatus with invalid transitions
  - Test cancelBooking
  - Test markAsCompleted
  - Test markAsNoShow
  - Test getBookingStats
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4_
