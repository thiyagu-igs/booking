# SMS and WhatsApp Notification Setup Guide

This guide explains how to set up SMS and WhatsApp notifications for the waitlist management system using Twilio.

## Prerequisites

1. **Twilio Account**: Sign up at [twilio.com](https://www.twilio.com)
2. **Phone Number**: Purchase a Twilio phone number that supports SMS
3. **WhatsApp Business Account**: Set up WhatsApp Business API through Twilio

## Environment Configuration

Add the following environment variables to your `.env` file:

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=+1234567890

# Base URL for confirmation links
BASE_URL=http://localhost:3000
```

## Database Setup

Run the database migrations to add the new tables and fields:

```bash
npm run migrate
```

This will create:
- `whatsapp_templates` table for managing WhatsApp message templates
- New fields in `waitlist_entries` for notification channel preferences

## Features

### Multi-Channel Notifications

The system now supports three notification channels:
- **Email** (existing)
- **SMS** (new)
- **WhatsApp** (new)

### Notification Channel Selection

When creating a waitlist entry, customers can specify:
- `notification_channels`: Array of preferred channels (e.g., `["sms", "email"]`)
- `preferred_channel`: Primary channel to try first (e.g., `"sms"`)

### Fallback Logic

The system implements intelligent fallback:
1. Try the preferred channel first
2. If it fails, try other channels in the notification_channels array
3. Automatically filter out channels that aren't properly configured

### SMS Features

- **Confirmation Responses**: Customers can reply "YES" or "NO" to SMS notifications
- **Help Messages**: Automatic help responses for unrecognized replies
- **Rate Limiting**: Respects existing notification rate limits
- **Template Customization**: SMS messages include business branding and clear CTAs

### WhatsApp Features

- **Template Management**: Full CRUD operations for WhatsApp message templates
- **Meta Approval Workflow**: Submit templates to Meta for approval
- **Rich Messaging**: Support for headers, footers, and quick reply buttons
- **Template Validation**: Ensures templates meet WhatsApp requirements

## API Endpoints

### Waitlist Management

```http
POST /api/waitlist
Content-Type: application/json
Authorization: Bearer <token>

{
  "customer_name": "John Doe",
  "phone": "+1234567890",
  "email": "john@example.com",
  "service_id": "service-123",
  "earliest_time": "2024-01-15T10:00:00Z",
  "latest_time": "2024-01-15T18:00:00Z",
  "notification_channels": ["sms", "email"],
  "preferred_channel": "sms"
}
```

### WhatsApp Template Management

```http
# Get all templates
GET /api/whatsapp-templates

# Create new template
POST /api/whatsapp-templates
{
  "templateName": "waitlist_notification",
  "templateLanguage": "en",
  "templateCategory": "UTILITY",
  "templateComponents": {
    "body": {
      "text": "Hi {{1}}, a slot is available for {{2}}."
    }
  }
}

# Submit for approval
POST /api/whatsapp-templates/{id}/submit

# Update status (webhook from Meta)
PUT /api/whatsapp-templates/{id}/status
{
  "status": "approved"
}
```

### Webhook Endpoints

```http
# Twilio SMS webhook
POST /api/webhooks/twilio/sms

# Twilio WhatsApp webhook  
POST /api/webhooks/twilio/whatsapp

# SendGrid delivery tracking
POST /api/webhooks/sendgrid/events
```

## Twilio Webhook Configuration

Configure these webhook URLs in your Twilio console:

1. **SMS Webhook**: `https://yourdomain.com/api/webhooks/twilio/sms`
2. **WhatsApp Webhook**: `https://yourdomain.com/api/webhooks/twilio/whatsapp`

## WhatsApp Template Setup

1. **Create Default Template**:
   ```http
   POST /api/whatsapp-templates/default/waitlist
   ```

2. **Submit for Approval**:
   ```http
   POST /api/whatsapp-templates/{id}/submit
   ```

3. **Wait for Meta Approval**: Templates must be approved by Meta before use

4. **Update Status**: Use webhook or manual API call to update approval status

## Testing

### SMS Testing

1. Create a waitlist entry with SMS preference
2. Trigger a notification (slot becomes available)
3. Reply "YES" or "NO" to the SMS
4. Verify booking confirmation/decline

### WhatsApp Testing

1. Create approved WhatsApp template
2. Create waitlist entry with WhatsApp preference
3. Trigger notification
4. Test responses through WhatsApp

### Integration Tests

Run the test suite:

```bash
# Test multi-channel notifications
npm test -- --testPathPattern="NotificationService.multichannel"

# Test webhook endpoints
npm test -- --testPathPattern="webhooks"

# Test WhatsApp templates
npm test -- --testPathPattern="WhatsAppTemplateService"

# Integration tests
npm test -- --testPathPattern="sms-whatsapp-integration"
```

## Troubleshooting

### Common Issues

1. **Twilio Authentication Errors**
   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
   - Check phone number format (+1234567890)

2. **WhatsApp Template Rejection**
   - Review Meta's template guidelines
   - Ensure proper variable formatting ({{1}}, {{2}})
   - Avoid promotional content in UTILITY templates

3. **SMS Delivery Issues**
   - Verify phone number is SMS-capable
   - Check rate limits and quotas
   - Ensure webhook URLs are accessible

4. **Database Migration Errors**
   - Check database permissions
   - Verify connection settings
   - Run migrations individually if needed

### Monitoring

- Check notification delivery rates in analytics
- Monitor webhook response times
- Track template approval status
- Review error logs for failed deliveries

## Security Considerations

1. **Webhook Validation**: Verify Twilio signatures (implement if needed)
2. **Rate Limiting**: Existing rate limits apply to all channels
3. **Data Privacy**: SMS/WhatsApp messages contain PII - ensure compliance
4. **Access Control**: Template management requires authentication

## Performance

- **Fallback Logic**: Minimal latency impact (~100ms per failed channel)
- **Database Impact**: New fields indexed for optimal query performance  
- **Rate Limits**: Shared across all notification channels
- **Caching**: Template data cached to reduce database queries

## Future Enhancements

- Push notifications support
- Voice call fallback
- Multi-language template support
- Advanced analytics and reporting
- A/B testing for message templates