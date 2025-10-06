# Google Calendar Integration

The waitlist management system includes optional Google Calendar integration that automatically creates and manages calendar events for booked slots.

## Features

- **Automatic Event Creation**: When a slot is booked through the waitlist, a calendar event is automatically created
- **Event Deletion**: When a booking is cancelled, the corresponding calendar event is deleted
- **Fallback Mechanism**: If calendar sync fails, the system continues with internal slot management
- **Per-Staff Configuration**: Each staff member can individually enable/disable calendar sync
- **Error Monitoring**: Track sync status and errors for each staff member
- **Customer Information**: Calendar events include customer name, email, and service details

## Setup

### 1. Google Cloud Console Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2. OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure the OAuth consent screen if prompted
4. Select "Web application" as the application type
5. Add authorized redirect URIs:
   - For development: `http://localhost:3000/auth/google/callback`
   - For production: `https://yourdomain.com/auth/google/callback`
6. Save the Client ID and Client Secret

### 3. Environment Variables

Add the following environment variables to your `.env` file:

```env
# Google Calendar Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 4. Database Migration

Run the database migrations to add calendar integration fields:

```bash
npm run migrate
```

This will create:
- Calendar integration fields in the `staff` table
- A new `calendar_events` table for tracking synced events

## Usage

### Enabling Calendar Sync for Staff

1. Navigate to the staff management section in the dashboard
2. For each staff member, click "Connect Google Calendar"
3. Complete the OAuth authorization flow
4. The staff member's calendar will now sync automatically

### API Endpoints

#### Generate OAuth URL
```http
GET /api/calendar/auth/:staffId
```

#### Handle OAuth Callback
```http
POST /api/calendar/callback
Content-Type: application/json

{
  "code": "authorization_code",
  "state": "staff_id"
}
```

#### Get Sync Status
```http
GET /api/calendar/status/:staffId
```

#### Test Connection
```http
POST /api/calendar/test/:staffId
```

#### Disable Sync
```http
DELETE /api/calendar/sync/:staffId
```

#### Get Sync Statistics
```http
GET /api/calendar/events/stats
```

#### Cleanup Orphaned Events
```http
POST /api/calendar/events/cleanup
```

## How It Works

### Booking Flow with Calendar Integration

1. **Slot Booking**: When a slot is booked through the waitlist system
2. **Event Creation**: The system automatically creates a Google Calendar event
3. **Event Details**: The event includes:
   - Service name and customer name as the title
   - Customer email and booking details in the description
   - Correct start and end times
   - Customer as an attendee (if email provided)
4. **Tracking**: A record is created in the `calendar_events` table
5. **Fallback**: If calendar creation fails, the booking still succeeds

### Cancellation Flow

1. **Slot Cancellation**: When a booking is cancelled
2. **Event Deletion**: The corresponding Google Calendar event is deleted
3. **Status Update**: The calendar event record is marked as deleted
4. **Fallback**: If calendar deletion fails, the cancellation still succeeds

### Error Handling

- **Network Errors**: Retries with exponential backoff
- **Authentication Errors**: Updates staff sync status to "error"
- **API Limits**: Respects Google Calendar API rate limits
- **Fallback**: Always falls back to internal slot management

## Monitoring

### Sync Status

Each staff member has a calendar sync status:
- `disabled`: Calendar sync is not enabled
- `enabled`: Calendar sync is working normally
- `error`: There's an issue with calendar sync

### Statistics

Track calendar integration performance:
- Total events synced
- Events created, updated, deleted
- Sync errors
- Orphaned events (events for deleted slots)

### Cleanup

The system provides cleanup functionality for:
- Orphaned calendar events (events for deleted slots)
- Failed sync attempts
- Expired authentication tokens

## Troubleshooting

### Common Issues

1. **"No refresh token received"**
   - The user needs to revoke access and re-authorize
   - Ensure `prompt: 'consent'` is used in the OAuth flow

2. **"Could not find primary calendar"**
   - The user's Google account may not have a primary calendar
   - Check calendar permissions in Google Calendar settings

3. **"Access denied" errors**
   - The refresh token may have expired
   - The user needs to re-authorize calendar access

4. **Events not appearing in calendar**
   - Check the staff member's calendar sync status
   - Verify the calendar ID is correct
   - Test the calendar connection

### Debugging

1. Check staff calendar sync status:
   ```http
   GET /api/calendar/status/:staffId
   ```

2. Test calendar connection:
   ```http
   POST /api/calendar/test/:staffId
   ```

3. View sync statistics:
   ```http
   GET /api/calendar/events/stats
   ```

4. Check application logs for calendar-related errors

### Re-authorization

If a staff member's calendar sync stops working:

1. Disable calendar sync for the staff member
2. Have them re-authorize by clicking "Connect Google Calendar"
3. Complete the OAuth flow again
4. Test the connection

## Security Considerations

- **Token Storage**: Refresh tokens are stored encrypted in the database
- **Scope Limitation**: Only calendar read/write permissions are requested
- **Tenant Isolation**: Calendar events are isolated by tenant
- **Error Logging**: Sensitive information is not logged in error messages
- **HTTPS Required**: OAuth flow requires HTTPS in production

## Limitations

- **Google Account Required**: Staff members need Google accounts
- **Internet Dependency**: Requires internet connection for calendar sync
- **API Limits**: Subject to Google Calendar API rate limits
- **Single Calendar**: Each staff member can sync with one primary calendar
- **Event Ownership**: Events are created by the application, not the staff member

## Future Enhancements

- Support for multiple calendars per staff member
- Two-way sync (import existing calendar events)
- Calendar availability checking
- Bulk calendar operations
- Calendar sharing and permissions management