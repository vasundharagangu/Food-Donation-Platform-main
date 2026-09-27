# Notification Setup Guide

## Email Configuration

To enable email notifications, add these environment variables to your `.env` file:

```env
# Email Configuration (Gmail example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Gmail Setup:
1. Enable 2-factor authentication on your Gmail account
2. Generate an "App Password" for this application
3. Use the app password (not your regular password) in EMAIL_PASS

## SMS Configuration

To enable SMS notifications, add this environment variable to your `.env` file:

```env
# SMS Configuration (Fast2SMS)
FAST2SMS_API_KEY=your_fast2sms_api_key_here
```

### Fast2SMS Setup:
1. Sign up at https://www.fast2sms.com/
2. Get your API key from the dashboard
3. Add the API key to your `.env` file

## Points System

The system now awards points as follows:
- **25 points** for creating a donation
- **25 points** for creating a request  
- **25 points** for completing a delivery (base)
- **Up to 50 points** for ratings (rating × 5)
- **25 points** for providing feedback

## SMS Notifications

The system now sends SMS for:
1. **Request Accepted**: Both requester and acceptor get SMS with contact details
2. **Delivery Completed**: Requester, donor, and NGO get SMS notifications
3. **New Donations/Requests**: Nearby users get notified

## Testing Notifications

To test if notifications are working:
1. Make sure your `.env` file has the correct credentials
2. Create a donation or request
3. Check your email and phone for notifications
4. Check the server logs for any error messages

## Troubleshooting

If notifications are not working:
1. Check server logs for error messages
2. Verify your email/SMS credentials are correct
3. Ensure your email account allows "less secure apps" or use app passwords
4. Check if your SMS provider has any restrictions
