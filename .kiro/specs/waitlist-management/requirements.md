# Requirements Document

## Introduction

The Waitlist Management System is designed to help service-based businesses (salons, clinics, trainers, small labs, repair shops) fill last-minute openings and reduce no-shows by maintaining a dynamic waitlist of customers who can be automatically notified when slots become available. The system prioritizes customers based on service match, staff preferences, time windows, and VIP status, then handles the entire booking confirmation process automatically.

## Requirements

### Requirement 1

**User Story:** As a business owner, I want to create and manage my business profile with services, staff, and operating hours, so that the waitlist system can match customers to appropriate slots.

#### Acceptance Criteria

1. WHEN a business owner creates their profile THEN the system SHALL store business name, timezone, operating hours, and creation timestamp
2. WHEN a business owner adds staff members THEN the system SHALL store staff name, role, and active status linked to the business
3. WHEN a business owner defines services THEN the system SHALL store service name, duration in minutes, price, and active status
4. IF a business owner deactivates a staff member or service THEN the system SHALL prevent new waitlist entries for that staff/service while preserving historical data

### Requirement 2

**User Story:** As a customer, I want to join a waitlist for services when no immediate slots are available, so that I can be automatically notified when a suitable slot opens up.

#### Acceptance Criteria

1. WHEN a customer submits a waitlist form THEN the system SHALL capture name, phone, email, preferred service, optional staff preference, earliest acceptable time, latest acceptable time, and consent
2. WHEN a customer joins the waitlist THEN the system SHALL assign a priority score based on VIP status, service match, staff preference, time window, and recency
3. IF a customer tries to join more than 3 active waitlists for the same business THEN the system SHALL reject the request
4. WHEN a customer first signs up with a new phone number THEN the system SHALL require phone verification via OTP

### Requirement 3

**User Story:** As a business owner, I want to mark slots as open and have the system automatically notify the best-matched waitlist customers, so that I can fill cancellations quickly without manual work.

#### Acceptance Criteria

1. WHEN a business owner marks a slot as open THEN the system SHALL identify all waitlist entries where service matches and time window overlaps
2. WHEN candidates are identified THEN the system SHALL rank them by priority score with created_at as tiebreaker
3. WHEN the top candidate is selected THEN the system SHALL send notification via email with confirm and decline links
4. WHEN a notification is sent THEN the system SHALL hold the slot for 10 minutes and start a countdown timer
5. IF no matching waitlist entries exist THEN the system SHALL keep the slot open and display it in the dashboard

### Requirement 4

**User Story:** As a waitlist customer, I want to quickly confirm or decline offered slots through simple links, so that I can secure bookings without complex interactions.

#### Acceptance Criteria

1. WHEN a customer receives a notification THEN the system SHALL provide unique confirm and decline links with 15-minute expiry
2. WHEN a customer clicks confirm within the hold period THEN the system SHALL book the slot and remove them from active waitlists
3. WHEN a customer clicks decline or the hold expires THEN the system SHALL notify the next highest-priority candidate
4. WHEN a customer confirms after hold expiry THEN the system SHALL show "slot no longer available" message and return them to waitlist
5. WHEN customers click email links THEN the system SHALL process these as confirm/decline actions

### Requirement 5

**User Story:** As a business owner, I want to view my schedule and manage waitlist activities through a dashboard, so that I can monitor and control the automated booking process.

#### Acceptance Criteria

1. WHEN a business owner accesses the dashboard THEN the system SHALL display open slots, pending holds, and today's bookings
2. WHEN a business owner views the waitlist THEN the system SHALL show active entries with filter and edit capabilities
3. WHEN a business owner accesses settings THEN the system SHALL allow configuration of hours, services, staff, message templates, and hold duration
4. WHEN a business owner views logs THEN the system SHALL display message history with delivery status and customer responses

### Requirement 6

**User Story:** As a business owner, I want to see analytics about my waitlist performance, so that I can understand how effectively the system is filling my schedule and generating revenue.

#### Acceptance Criteria

1. WHEN a business owner views analytics THEN the system SHALL display fill rate as percentage of open slots booked through waitlist
2. WHEN analytics are calculated THEN the system SHALL show median time to fill slots in minutes
3. WHEN revenue metrics are displayed THEN the system SHALL sum the value of slots booked through the waitlist system
4. WHEN no-show tracking is enabled THEN the system SHALL calculate percentage of waitlist bookings that resulted in no-shows

### Requirement 7

**User Story:** As a system administrator, I want to ensure data security and prevent abuse, so that customer information is protected and the system isn't exploited by spam or malicious users.

#### Acceptance Criteria

1. WHEN any API endpoint is accessed THEN the system SHALL require HTTPS and valid JWT authentication with tenant_id
2. WHEN database operations occur THEN the system SHALL enforce row-level security based on tenant_id
3. WHEN notifications are sent THEN the system SHALL rate limit to maximum 25 per hour per business
4. WHEN state changes occur THEN the system SHALL log all actions with actor, timestamp, and metadata for audit purposes
5. WHEN confirm/decline tokens are generated THEN the system SHALL use cryptographically signed tokens with 15-minute expiry

### Requirement 8

**User Story:** As a business owner, I want the system to integrate with my existing Google Calendar, so that bookings automatically appear in my calendar without duplicate data entry.

#### Acceptance Criteria

1. WHEN a business owner enables calendar sync THEN the system SHALL authenticate via OAuth and store calendar_id per staff member
2. WHEN a slot is booked through waitlist THEN the system SHALL create corresponding calendar event
3. WHEN a booking is cancelled THEN the system SHALL delete the associated calendar event
4. IF calendar sync fails THEN the system SHALL fall back to internal slot management without disrupting core functionality