"""
Email utility functions for sending notifications
"""
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def send_account_creation_email(user):
    """Send email confirmation when a new account is created"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping account creation email to {user.email}")
    return
    
    try:
        subject = 'Welcome to GRFS Booking System - Account Created'
        message = f"""
Hello {user.first_name or user.username},

Thank you for registering with the GRFS Booking System!

Your account has been created and is currently pending approval. 
You will receive an email notification once an administrator has reviewed and approved your account.

Account Details:
- Username: {user.username}
- Email: {user.email}
- Name: {user.first_name} {user.last_name}

Once approved, you'll be able to log in and start booking rooms.

If you have any questions, please contact the administrator.

Best regards,
GRFS Booking System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Account creation email sent to {user.email}")
    except Exception as e:
        logger.error(f"Failed to send account creation email to {user.email}: {str(e)}")


def send_account_approval_email(user, approved=True):
    """Send email when account is approved or denied"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping account approval email to {user.email}")
    return
    
    try:
        if approved:
            subject = 'GRFS Booking System - Account Approved'
            message = f"""
Hello {user.first_name or user.username},

Great news! Your account has been approved by an administrator.

You can now log in to the GRFS Booking System and start booking rooms.

Login at: {settings.SITE_URL}/login

If you have any questions, please contact the administrator.

Best regards,
GRFS Booking System
            """
        else:
            subject = 'GRFS Booking System - Account Denied'
            message = f"""
Hello {user.first_name or user.username},

We regret to inform you that your account registration has been denied.

If you believe this is an error or would like to appeal this decision, 
please contact the administrator.

Best regards,
GRFS Booking System
            """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Account approval email sent to {user.email} (approved: {approved})")
    except Exception as e:
        logger.error(f"Failed to send account approval email to {user.email}: {str(e)}")


def send_booking_creation_email(booking):
    """Send email confirmation when a booking is created"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping booking creation email for booking {booking.id}")
    return
    
    try:
        user = booking.user
        rooms = booking.rooms.all()
        room_names = ', '.join([f"{room.name} (Floor {room.floor.name})" for room in rooms])
        
        # Format datetime
        start_str = booking.start_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.start_datetime else 'N/A'
        end_str = booking.end_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.end_datetime else 'N/A'
        
        status_message = "pending approval" if booking.status == "Pending" else "approved"
        
        subject = f'GRFS Booking Confirmation - {status_message.title()}'
        message = f"""
Hello {user.first_name or user.username},

Your room booking has been created successfully!

Booking Details:
- Rooms: {room_names}
- Start Time: {start_str}
- End Time: {end_str}
- Status: {booking.status}

{"Your booking is pending approval. You will receive an email once it has been reviewed." if booking.status == "Pending" else "Your booking has been automatically approved!"}

You can view and manage your bookings at: {settings.SITE_URL}/dashboard

If you need to make changes or cancel this booking, please do so through the dashboard.

Best regards,
GRFS Booking System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Booking creation email sent to {user.email} for booking {booking.id}")
    except Exception as e:
        logger.error(f"Failed to send booking creation email: {str(e)}")


def send_booking_update_email(booking, updated_by_admin=False, old_data=None):
    """Send email when a booking is updated"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping booking update email for booking {booking.id}")
    return
    
    try:
        user = booking.user
        rooms = booking.rooms.all()
        room_names = ', '.join([f"{room.name} (Floor {room.floor.name})" for room in rooms])
        
        # Format datetime
        start_str = booking.start_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.start_datetime else 'N/A'
        end_str = booking.end_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.end_datetime else 'N/A'
        
        updated_by = "an administrator" if updated_by_admin else "you"
        
        # Build change details if old_data is provided
        changes = []
        if old_data:
            if old_data.get('start_datetime') != booking.start_datetime:
                old_start = old_data.get('start_datetime').strftime('%B %d, %Y at %I:%M %p') if old_data.get('start_datetime') else 'N/A'
                changes.append(f"Start time changed from {old_start} to {start_str}")
            if old_data.get('end_datetime') != booking.end_datetime:
                old_end = old_data.get('end_datetime').strftime('%B %d, %Y at %I:%M %p') if old_data.get('end_datetime') else 'N/A'
                changes.append(f"End time changed from {old_end} to {end_str}")
            if old_data.get('status') != booking.status:
                changes.append(f"Status changed from {old_data.get('status')} to {booking.status}")
        
        changes_text = "\n".join([f"- {change}" for change in changes]) if changes else "Details updated"
        
        subject = 'GRFS Booking Updated'
        message = f"""
Hello {user.first_name or user.username},

Your booking has been updated by {updated_by}.

Updated Booking Details:
- Rooms: {room_names}
- Start Time: {start_str}
- End Time: {end_str}
- Status: {booking.status}

Changes Made:
{changes_text}

You can view your updated booking at: {settings.SITE_URL}/dashboard

If you did not make these changes, please contact the administrator immediately.

Best regards,
GRFS Booking System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Booking update email sent to {user.email} for booking {booking.id}")
    except Exception as e:
        logger.error(f"Failed to send booking update email: {str(e)}")


def send_booking_cancellation_email(booking, cancelled_by_admin=False):
    """Send email when a booking is cancelled"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping booking cancellation email for booking {booking.id}")
    return
    
    try:
        user = booking.user
        rooms = booking.rooms.all()
        room_names = ', '.join([f"{room.name} (Floor {room.floor.name})" for room in rooms])
        
        # Format datetime
        start_str = booking.start_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.start_datetime else 'N/A'
        end_str = booking.end_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.end_datetime else 'N/A'
        
        cancelled_by = "an administrator" if cancelled_by_admin else "you"
        
        subject = 'GRFS Booking Cancelled'
        message = f"""
Hello {user.first_name or user.username},

Your booking has been cancelled by {cancelled_by}.

Cancelled Booking Details:
- Rooms: {room_names}
- Start Time: {start_str}
- End Time: {end_str}
- Status: Cancelled

{"If you did not cancel this booking, please contact the administrator immediately." if cancelled_by_admin else "If you need to book again, please visit the booking page."}

You can view your bookings at: {settings.SITE_URL}/dashboard

Best regards,
GRFS Booking System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Booking cancellation email sent to {user.email} for booking {booking.id}")
    except Exception as e:
        logger.error(f"Failed to send booking cancellation email: {str(e)}")


def send_booking_reminder_email(booking):
    """Send reminder email for upcoming bookings"""
    # Email sending is temporarily disabled
    logger.info(f"Email sending disabled. Skipping booking reminder email for booking {booking.id}")
    return
    
    try:
        user = booking.user
        rooms = booking.rooms.all()
        room_names = ', '.join([f"{room.name} (Floor {room.floor.name})" for room in rooms])
        
        # Format datetime
        start_str = booking.start_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.start_datetime else 'N/A'
        end_str = booking.end_datetime.strftime('%B %d, %Y at %I:%M %p') if booking.end_datetime else 'N/A'
        
        # Calculate time until booking
        if booking.start_datetime:
            time_until = booking.start_datetime - timezone.now()
            hours_until = int(time_until.total_seconds() / 3600)
            time_text = f"in {hours_until} hour{'s' if hours_until != 1 else ''}"
        else:
            time_text = "soon"
        
        subject = f'GRFS Booking Reminder - Your booking starts {time_text}'
        message = f"""
Hello {user.first_name or user.username},

This is a reminder about your upcoming booking.

Booking Details:
- Rooms: {room_names}
- Start Time: {start_str}
- End Time: {end_str}
- Status: {booking.status}

Your booking starts {time_text}. Please make sure you arrive on time.

You can view your booking details at: {settings.SITE_URL}/dashboard

If you need to cancel or modify this booking, please do so as soon as possible.

Best regards,
GRFS Booking System
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        logger.info(f"Booking reminder email sent to {user.email} for booking {booking.id}")
    except Exception as e:
        logger.error(f"Failed to send booking reminder email: {str(e)}")

