# Requirements Document

## Introduction

This document defines the requirements for a comprehensive booking management system that allows staff to view, create, and manage bookings directly from the admin panel. Currently, bookings can only be created through the waitlist notification flow when customers confirm slots. This feature will enable staff to manually create bookings for walk-ins, phone reservations, or direct requests, as well as view and manage all bookings in a centralized interface.

## Glossary

- **Booking System**: The software component that manages appointment bookings
- **Staff User**: An authenticated user with access to the admin panel
- **Booking**: A confirmed appointment for a customer at a specific time slot
- **Slot**: A time period available for booking with a specific service and staff member
- **Customer**: A person who books or receives a service
- **Admin Panel**: The staff-facing web interface for managing the business
- **Walk-in Customer**: A customer who arrives without a prior booking
- **Booking Source**: The origin of a booking (waitlist, manual, phone, walk-in)

## Requirements

### Requirement 1

**User Story:** As a staff member, I want to view all bookings in a centralized interface, so that I can see the complete schedule and manage appointments effectively

#### Acceptance Criteria

1. WHEN the Staff User navigates to the bookings page, THE Booking System SHALL display a list of all bookings with customer name, service, staff member, date, time, status, and booking source
2. THE Booking System SHALL provide filter options for date range, service, staff member, status, and booking source
3. THE Booking System SHALL provide search functionality to find bookings by customer name, phone number, or email
4. THE Booking System SHALL sort bookings by date and time in ascending order by default
5. THE Booking System SHALL display booking status with visual indicators (confirmed, completed, cancelled, no-show)

### Requirement 2

**User Story:** As a staff member, I want to manually create a new booking, so that I can accommodate walk-in customers, phone reservations, and direct requests

#### Acceptance Criteria

1. WHEN the Staff User clicks the create booking button, THE Booking System SHALL display a booking creation form
2. THE Booking System SHALL require the Staff User to select a service before displaying available slots
3. THE Booking System SHALL display only open and available slots for the selected service
4. THE Booking System SHALL allow the Staff User to optionally select a specific staff member or choose "any available"
5. THE Booking System SHALL require customer name and phone number as mandatory fields
6. THE Booking System SHALL accept customer email as an optional field
7. THE Booking System SHALL allow the Staff User to select the booking source (manual, phone, walk-in)
8. WHEN the Staff User submits the form with valid data, THE Booking System SHALL create the booking and mark the slot as booked
9. WHEN the booking is created successfully, THE Booking System SHALL display a success message and redirect to the bookings list

### Requirement 3

**User Story:** As a staff member, I want to view detailed information about a booking, so that I can access all relevant customer and appointment details

#### Acceptance Criteria

1. WHEN the Staff User clicks on a booking in the list, THE Booking System SHALL display a detailed view with all booking information
2. THE Booking System SHALL display customer contact information (name, phone, email)
3. THE Booking System SHALL display service details (name, duration, staff member)
4. THE Booking System SHALL display appointment date and time
5. THE Booking System SHALL display booking source and creation timestamp
6. THE Booking System SHALL display booking status and any status change history

### Requirement 4

**User Story:** As a staff member, I want to cancel a booking, so that I can handle customer cancellations and free up the slot for others

#### Acceptance Criteria

1. WHEN the Staff User views a booking with status "confirmed", THE Booking System SHALL display a cancel button
2. WHEN the Staff User clicks the cancel button, THE Booking System SHALL prompt for confirmation
3. WHEN the Staff User confirms cancellation, THE Booking System SHALL update the booking status to "cancelled"
4. WHEN a booking is cancelled, THE Booking System SHALL release the associated slot and mark it as open
5. THE Booking System SHALL record the cancellation timestamp and actor in the audit log

### Requirement 5

**User Story:** As a staff member, I want to mark a booking as completed or no-show, so that I can track appointment outcomes and maintain accurate records

#### Acceptance Criteria

1. WHEN the Staff User views a booking with status "confirmed", THE Booking System SHALL display options to mark as completed or no-show
2. WHEN the Staff User marks a booking as completed, THE Booking System SHALL update the booking status to "completed"
3. WHEN the Staff User marks a booking as no-show, THE Booking System SHALL update the booking status to "no-show"
4. THE Booking System SHALL record the status change timestamp and actor in the audit log
5. THE Booking System SHALL prevent status changes for bookings that are already completed, cancelled, or marked as no-show

### Requirement 6

**User Story:** As a staff member, I want to see booking statistics on the dashboard, so that I can quickly understand booking activity and trends

#### Acceptance Criteria

1. THE Booking System SHALL display total bookings count for today on the dashboard
2. THE Booking System SHALL display upcoming bookings count for the next 7 days on the dashboard
3. THE Booking System SHALL display completed bookings count for the current month on the dashboard
4. THE Booking System SHALL display no-show rate percentage for the current month on the dashboard
5. THE Booking System SHALL update dashboard statistics in real-time when bookings are created or modified

### Requirement 7

**User Story:** As a staff member, I want the bookings page to be accessible from the main navigation, so that I can easily access booking management features

#### Acceptance Criteria

1. THE Booking System SHALL add a "Bookings" navigation item to the main menu
2. WHEN the Staff User clicks the "Bookings" navigation item, THE Booking System SHALL navigate to the bookings management page
3. THE Booking System SHALL highlight the active navigation item when on the bookings page
4. THE Booking System SHALL display the bookings page only to authenticated staff users
