# Render Environment Variables Configuration

This document lists all environment variables that need to be configured in your Render dashboard for the GRFS Booking System.

## Required Environment Variables

### 1. Django Core Settings

| Variable Name | Value | Description | Required |
|--------------|-------|-------------|----------|
| `SECRET_KEY` | `your-secret-key-here` | Django secret key (generate a secure random string) | ✅ Yes |
| `DEBUG` | `False` | Set to False in production | ✅ Yes |
| `ALLOWED_HOSTS` | `yourdomain.com,www.yourdomain.com` | Comma-separated list of allowed hosts | ✅ Yes |
| `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` | Comma-separated list of allowed CORS origins | ✅ Yes |

### 2. Database Configuration

**Note:** These are automatically set by Render if you use the database from `render.yaml`. However, if you're setting up manually:

| Variable Name | Value | Description | Required |
|--------------|-------|-------------|----------|
| `DATABASE_URL` | Auto-set by Render | PostgreSQL connection string | ✅ Auto |
| `DB_ENGINE` | `postgresql` | Database engine type | ✅ Auto |
| `DB_NAME` | Auto-set by Render | Database name | ✅ Auto |
| `DB_USER` | Auto-set by Render | Database user | ✅ Auto |
| `DB_PASSWORD` | Auto-set by Render | Database password | ✅ Auto |
| `DB_HOST` | Auto-set by Render | Database host | ✅ Auto |
| `DB_PORT` | `5432` | Database port | ✅ Auto |

### 3. Email Configuration (Required for Email Notifications)

| Variable Name | Value | Description | Required |
|--------------|-------|-------------|----------|
| `EMAIL_BACKEND` | `django.core.mail.backends.smtp.EmailBackend` | Email backend (already set in render.yaml) | ✅ Yes |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP server hostname | ✅ Yes |
| `EMAIL_PORT` | `587` | SMTP port (587 for TLS, 465 for SSL) | ✅ Yes |
| `EMAIL_USE_TLS` | `True` | Use TLS encryption (already set in render.yaml) | ✅ Yes |
| `EMAIL_USE_SSL` | `False` | Use SSL encryption (already set in render.yaml) | ✅ Yes |
| `EMAIL_HOST_USER` | `your-email@gmail.com` | Your email address | ✅ Yes |
| `EMAIL_HOST_PASSWORD` | `your-app-password` | Your email password or app password | ✅ Yes |
| `DEFAULT_FROM_EMAIL` | `your-email@gmail.com` | Email address to send from | ✅ Yes |
| `SITE_URL` | `https://yourdomain.com` | Your site URL (used in email links) | ✅ Yes |

## How to Set Environment Variables in Render

1. Go to your Render dashboard
2. Select your web service (e.g., `grfs-booking-backend`)
3. Click on **Environment** in the left sidebar
4. Click **Add Environment Variable**
5. Enter the variable name and value
6. Click **Save Changes**

## Email Configuration Examples

### Gmail Setup (Recommended for Development/Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to [Google Account Settings](https://myaccount.google.com/)
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set these variables in Render**:
   ```
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USE_TLS=True
   EMAIL_USE_SSL=False
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx  (your 16-char app password)
   DEFAULT_FROM_EMAIL=your-email@gmail.com
   SITE_URL=https://yourdomain.com
   ```

### Production Email Setup (Custom Domain)

If you have your own domain and email service:

```
EMAIL_HOST=mail.yourdomain.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=noreply@yourdomain.com
EMAIL_HOST_PASSWORD=your-email-password
DEFAULT_FROM_EMAIL=noreply@yourdomain.com
SITE_URL=https://yourdomain.com
```

**Note:** Some email providers use:
- Port `465` with `EMAIL_USE_SSL=True` and `EMAIL_USE_TLS=False`
- Different hostname formats

Check your email provider's SMTP documentation for exact settings.

## Variables Already Configured in render.yaml

These variables are already set in `render.yaml` and don't need to be manually added (unless you want to override them):

- `EMAIL_BACKEND` (set to `django.core.mail.backends.smtp.EmailBackend`)
- `EMAIL_PORT` (set to `587`)
- `EMAIL_USE_TLS` (set to `True`)
- `EMAIL_USE_SSL` (set to `False`)
- Database variables (auto-set from database connection)

## Variables That Must Be Set Manually in Render

You **must** set these in the Render dashboard (they are marked as `sync: false` in render.yaml):

1. ✅ `SECRET_KEY` - Generate a secure random string
2. ✅ `DEBUG` - Set to `False`
3. ✅ `ALLOWED_HOSTS` - Your domain(s)
4. ✅ `CORS_ALLOWED_ORIGINS` - Your frontend URL(s)
5. ✅ `EMAIL_HOST` - Your SMTP server
6. ✅ `EMAIL_HOST_USER` - Your email address
7. ✅ `EMAIL_HOST_PASSWORD` - Your email password/app password
8. ✅ `DEFAULT_FROM_EMAIL` - Email to send from
9. ✅ `SITE_URL` - Your site URL

## Testing Email Configuration

After setting up email variables, you can test the configuration:

1. **Via Render Shell**:
   - Go to your service in Render
   - Click on **Shell** tab
   - Run: `cd room_booking && python manage.py shell`
   - Then run:
     ```python
     from django.core.mail import send_mail
     from django.conf import settings
     
     send_mail(
         'Test Email',
         'This is a test email from GRFS Booking System.',
         settings.DEFAULT_FROM_EMAIL,
         ['your-test-email@example.com'],
         fail_silently=False,
     )
     ```

2. **Check Logs**:
   - View your service logs in Render
   - Look for email sending errors or success messages

## Troubleshooting

### Emails Not Sending

1. **Verify all email variables are set** in Render dashboard
2. **Check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD** are not empty
3. **For Gmail**: Make sure you're using an App Password, not your regular password
4. **Check SMTP port**: Try 587 (TLS) or 465 (SSL)
5. **Check logs** in Render dashboard for error messages

### Common Errors

- **"SMTPAuthenticationError"**: Wrong email/password or need App Password for Gmail
- **"Connection refused"**: Wrong EMAIL_HOST or port blocked
- **"Timeout"**: Firewall blocking SMTP port
- **"Email not configured" warning**: Missing EMAIL_HOST_USER or EMAIL_HOST_PASSWORD

## Security Notes

- ⚠️ **Never commit** environment variables to git
- ✅ Use **App Passwords** for Gmail (not your main password)
- ✅ Use a **dedicated email account** for production (e.g., noreply@yourdomain.com)
- ✅ **Rotate passwords** regularly
- ✅ Enable **SPF/DKIM** records for your domain to improve deliverability

## Quick Checklist

Before deploying, ensure you have set:

- [ ] `SECRET_KEY`
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` (your domain)
- [ ] `CORS_ALLOWED_ORIGINS` (your frontend URL)
- [ ] `EMAIL_HOST`
- [ ] `EMAIL_HOST_USER`
- [ ] `EMAIL_HOST_PASSWORD`
- [ ] `DEFAULT_FROM_EMAIL`
- [ ] `SITE_URL`
