from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from .models import Booking, Room, Floor
from .serializers import *
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.conf import settings
import pytz
import logging
import os

# Create your views here.

logger = logging.getLogger(__name__)

User = get_user_model()

# View to serve React app in production
@csrf_exempt  # Exempt from CSRF since this is just serving static HTML
def serve_react_app(request):
    """Serve the React app's index.html for all non-API routes"""
    # Only handle GET and HEAD requests
    if request.method not in ['GET', 'HEAD']:
        return HttpResponse('Method not allowed', status=405)
    
    try:
        # Use Django's template system to render the template
        # This is more reliable than manually reading the file
        return render(request, 'index.html', {}, content_type='text/html')
    except Exception as e:
        # Fallback: try to read the file directly if template rendering fails
        try:
            template_path = os.path.join(settings.BASE_DIR, 'booking', 'templates', 'index.html')
            if os.path.exists(template_path):
                with open(template_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    return HttpResponse(content, content_type='text/html; charset=utf-8')
            else:
                error_msg = f"React template not found at: {template_path}. BASE_DIR: {settings.BASE_DIR}"
                logger.error(error_msg)
                return HttpResponse(
                    f"React app template not found. Please rebuild the frontend.\n{error_msg}",
                    status=500,
                    content_type='text/plain'
                )
        except Exception as e2:
            error_msg = f"Error serving React app: {str(e)} (fallback also failed: {str(e2)})"
            logger.error(error_msg, exc_info=True)
            return HttpResponse(
                f"Error loading React app: {str(e)}",
                status=500,
                content_type='text/plain'
            )

def check_booking_conflicts(room_ids, start_datetime, end_datetime, exclude_booking_id=None):
    """
    Check if any of the given rooms have existing bookings that conflict with the requested time.
    Returns a list of conflicting bookings with details.
    """
    try:
        if isinstance(start_datetime, str):
            start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00'))
        else:
            start_dt = start_datetime
        if isinstance(end_datetime, str):
            end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00'))
        else:
            end_dt = end_datetime
    except (ValueError, AttributeError) as e:
        # If parsing fails and it's not already a datetime, raise error
        if not isinstance(start_datetime, datetime) or not isinstance(end_datetime, datetime):
            raise ValueError(f"Invalid datetime format: {str(e)}")
        start_dt = start_datetime
        end_dt = end_datetime
    
    # Find bookings that overlap with the requested time for any of the rooms
    # Overlap occurs when: existing_start < requested_end AND existing_end > requested_start
    conflicting_bookings = Booking.objects.filter(
        rooms__id__in=room_ids,
        status__in=['Pending', 'Approved']  # Only check active bookings
    ).filter(
        Q(start_datetime__lt=end_dt) & Q(end_datetime__gt=start_dt)
    ).prefetch_related('rooms').distinct()
    
    if exclude_booking_id:
        conflicting_bookings = conflicting_bookings.exclude(id=exclude_booking_id)
    
    conflicts = []
    for booking in conflicting_bookings:
        # Get the rooms that conflict - use prefetched rooms to avoid N+1 queries
        conflicting_rooms = [room for room in booking.rooms.all() if room.id in room_ids]
        for room in conflicting_rooms:
            conflicts.append({
                'room_id': room.id,
                'room_name': room.name,
                'existing_start': booking.start_datetime.isoformat() if booking.start_datetime else None,
                'existing_end': booking.end_datetime.isoformat() if booking.end_datetime else None,
            })
    
    return conflicts

class CreateBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            # Extract room_ids and floor_id from the request data
            room_ids = request.data.get('room_ids', [])
            floor_id = request.data.get('floor_id', None)

            # If no rooms are selected, return an error
            if not room_ids and not floor_id:
                return Response(
                    {"detail": "Either room(s) or a floor must be selected."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # If a floor is selected, get all rooms on that floor
            if floor_id:
                try:
                    floor = Floor.objects.get(id=floor_id)
                    floor_rooms = floor.rooms.all()  # Get all rooms for the selected floor
                    room_ids.extend([room.id for room in floor_rooms])  # Add floor rooms to the selected rooms list
                except Floor.DoesNotExist:
                    return Response(
                        {"detail": f"Floor with id {floor_id} does not exist."}, 
                        status=status.HTTP_404_NOT_FOUND
                    )

            # Remove duplicates from room_ids (in case both floor and individual rooms are selected)
            room_ids = list(set(room_ids))

            # Ensure that the room_ids provided are valid rooms
            rooms = Room.objects.filter(id__in=room_ids)
            if len(rooms) != len(room_ids):
                return Response(
                    {"detail": "Some rooms are invalid."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get booking type (default to 'regular')
            booking_type = request.data.get('booking_type', 'regular')
            
            # Check permissions for camp bookings
            if booking_type == 'camp':
                user_role = request.user.role
                if user_role not in ['mentor', 'coordinator', 'admin']:
                    return Response(
                        {"detail": "Only mentors, coordinators, and admins can book camps."}, 
                        status=status.HTTP_403_FORBIDDEN
                    )
            
            # Validate datetime fields
            start_datetime_str = request.data.get("start_datetime")
            end_datetime_str = request.data.get("end_datetime")
            
            if not start_datetime_str or not end_datetime_str:
                return Response(
                    {"detail": "Both start_datetime and end_datetime are required."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Parse datetime strings and convert to EST timezone-aware datetimes
            est = pytz.timezone('America/New_York')
            try:
                # Parse the datetime string (format: YYYY-MM-DDTHH:MM:SS)
                # The frontend sends times in EST/EDT, so we treat them as such
                start_dt_naive = datetime.strptime(start_datetime_str, '%Y-%m-%dT%H:%M:%S')
                end_dt_naive = datetime.strptime(end_datetime_str, '%Y-%m-%dT%H:%M:%S')
                
                # Use localize() to treat naive datetime as being in EST timezone
                # This preserves the exact time the user selected
                # is_dst=None raises error on ambiguous times (DST transitions)
                # which is safer than guessing
                try:
                    start_datetime = est.localize(start_dt_naive, is_dst=None)
                    end_datetime = est.localize(end_dt_naive, is_dst=None)
                except pytz.AmbiguousTimeError:
                    # If ambiguous (DST transition), use the later occurrence (DST=True)
                    start_datetime = est.localize(start_dt_naive, is_dst=True)
                    end_datetime = est.localize(end_dt_naive, is_dst=True)
                except pytz.NonExistentTimeError:
                    # If time doesn't exist (spring forward), use the next valid time
                    start_datetime = est.localize(start_dt_naive, is_dst=False)
                    end_datetime = est.localize(end_dt_naive, is_dst=False)
            except ValueError:
                # Try parsing with timezone if provided
                try:
                    start_datetime = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                    end_datetime = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))
                    # Convert to EST
                    if start_datetime.tzinfo is None:
                        start_datetime = timezone.make_aware(start_datetime, est)
                    else:
                        start_datetime = start_datetime.astimezone(est)
                    if end_datetime.tzinfo is None:
                        end_datetime = timezone.make_aware(end_datetime, est)
                    else:
                        end_datetime = end_datetime.astimezone(est)
                except (ValueError, AttributeError) as e:
                    return Response(
                        {"detail": f"Invalid datetime format. Use YYYY-MM-DDTHH:MM:SS. Error: {str(e)}"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate that end time is after start time
            if end_datetime <= start_datetime:
                return Response(
                    {"detail": "End datetime must be after start datetime."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that start_datetime is not in the past
            now = timezone.now()
            if start_datetime < now:
                return Response(
                    {"detail": "Cannot create bookings in the past."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # For camp bookings, skip duration validation (they can span multiple days)
            if booking_type != 'camp':
                # Validate maximum booking duration (e.g., 8 hours) for regular bookings
                max_duration = timedelta(hours=8)
                if (end_datetime - start_datetime) > max_duration:
                    return Response(
                        {"detail": "Booking duration cannot exceed 8 hours."}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Validate minimum booking duration (e.g., 1 hour) for regular bookings
                min_duration = timedelta(hours=1)
                if (end_datetime - start_datetime) < min_duration:
                    return Response(
                        {"detail": "Booking duration must be at least 1 hour."}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Check for booking conflicts - use database transaction to prevent race conditions
            from django.db import transaction
            with transaction.atomic():
                # Check for conflicts (works for both regular and camp bookings)
                conflicts = check_booking_conflicts(room_ids, start_datetime, end_datetime)
                if conflicts:
                    # Format conflict details for user-friendly error message
                    conflict_details = []
                    unavailable_hours = []
                    for conflict in conflicts:
                        conflict_details.append(
                            f"Room '{conflict['room_name']}' is already booked from "
                            f"{conflict['existing_start']} to {conflict['existing_end']}"
                        )
                        unavailable_hours.append({
                            'room': conflict['room_name'],
                            'start': conflict['existing_start'],
                            'end': conflict['existing_end']
                        })
                    
                    return Response(
                        {
                            "detail": "Some rooms are already booked during the requested time.",
                            "conflicts": unavailable_hours,
                            "conflict_messages": conflict_details
                        }, 
                        status=status.HTTP_409_CONFLICT
                    )

                # Create the booking (single booking for both regular and camp bookings)
                # For camp bookings, this will be one booking covering the entire time period
                booking_data = {
                    "room_ids": room_ids,
                    "start_datetime": start_datetime,
                    "end_datetime": end_datetime,
                    "booking_type": booking_type,
                }

                serializer = BookingSerializer(data=booking_data, context={'request': request})
                if serializer.is_valid():
                    booking = serializer.save()  # Create booking
                    
                    # Send booking creation email
                    try:
                        from .email_utils import send_booking_creation_email
                        send_booking_creation_email(booking)
                    except Exception as e:
                        logger.error(f"Failed to send booking creation email: {str(e)}")
                    
                    return Response(serializer.data, status=status.HTTP_201_CREATED)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError, AttributeError) as e:
            return Response(
                {"detail": f"Invalid input: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Log the full error for debugging but return generic message
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating booking: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while creating the booking. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class FloorListView(APIView):
    permission_classes = [permissions.AllowAny]  # Anyone can view floors

    def get(self, request):
        try:
            floors = Floor.objects.prefetch_related('rooms').all()
            serializer = FloorSerializer(floors, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid request: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching floors: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching floors. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class RoomListView(APIView):
    permission_classes = [permissions.AllowAny]  # Anyone can view rooms

    def get(self, request):
        try:
            floor_id = request.GET.get('floor', None)
            if floor_id:
                # Validate that the floor exists
                try:
                    floor_id = int(floor_id)
                except (ValueError, TypeError):
                    return Response(
                        {"detail": "Invalid floor ID format."}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                try:
                    Floor.objects.get(id=floor_id)
                except Floor.DoesNotExist:
                    return Response(
                        {"detail": f"Floor with id {floor_id} does not exist."}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                rooms = Room.objects.select_related('floor').filter(floor_id=floor_id)  # Filter rooms by floor
            else:
                rooms = Room.objects.select_related('floor').all()  # Return all rooms if no floor ID is provided
            serializer = RoomSerializer(rooms, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid request: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching rooms: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching rooms. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class BookingListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.role == 'admin':
                bookings = Booking.objects.select_related('user').prefetch_related('rooms', 'rooms__floor').all()
            else:
                bookings = Booking.objects.select_related('user').prefetch_related('rooms', 'rooms__floor').filter(user=request.user)
            serializer = BookingSerializer(bookings, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid request: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Log the full error for debugging but return generic message
            logger.error(f"Error fetching bookings: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching bookings. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        try:
            serializer = BookingSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except (ValueError, TypeError, AttributeError) as e:
            return Response(
                {"detail": f"Invalid input: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating booking: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while creating booking. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MyBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            bookings = Booking.objects.select_related('user').prefetch_related('rooms', 'rooms__floor').filter(user=request.user)
            serializer = BookingSerializer(bookings, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (ValueError, TypeError) as e:
            return Response(
                {"detail": f"Invalid request: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            # Log the full error for debugging but return generic message
            logger.error(f"Error fetching user bookings: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching your bookings. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class BookingDetailView(APIView):
    """View to retrieve, update, or delete a specific booking"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_object(self, booking_id, user):
        """Get booking object and verify ownership"""
        try:
            booking = Booking.objects.select_related('user').prefetch_related('rooms', 'rooms__floor').get(id=booking_id)
            # Only allow users to access their own bookings (unless admin)
            if booking.user != user and user.role != 'admin':
                return None
            return booking
        except Booking.DoesNotExist:
            return None
    
    def get(self, request, booking_id):
        """Get a specific booking"""
        try:
            booking = self.get_object(booking_id, request.user)
            if not booking:
                return Response(
                    {"detail": "Booking not found or you don't have permission to view it."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            serializer = BookingSerializer(booking)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching booking: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching the booking."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def put(self, request, booking_id):
        """Update a booking"""
        try:
            booking = self.get_object(booking_id, request.user)
            if not booking:
                return Response(
                    {"detail": "Booking not found or you don't have permission to edit it."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Don't allow editing cancelled bookings
            if booking.status == 'Cancelled':
                return Response(
                    {"detail": "Cannot edit a cancelled booking."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Parse datetime if provided
            est = pytz.timezone('America/New_York')
            data = request.data.copy()
            
            if 'start_datetime' in data and isinstance(data['start_datetime'], str):
                try:
                    # Try parsing with datetime-local format (YYYY-MM-DDTHH:MM)
                    if 'T' in data['start_datetime'] and len(data['start_datetime']) == 16:
                        start_dt_naive = datetime.strptime(data['start_datetime'], '%Y-%m-%dT%H:%M')
                    else:
                        start_dt_naive = datetime.strptime(data['start_datetime'], '%Y-%m-%dT%H:%M:%S')
                    try:
                        data['start_datetime'] = est.localize(start_dt_naive, is_dst=None)
                    except (pytz.AmbiguousTimeError, pytz.NonExistentTimeError):
                        try:
                            data['start_datetime'] = est.localize(start_dt_naive, is_dst=True)
                        except:
                            data['start_datetime'] = est.localize(start_dt_naive, is_dst=False)
                except ValueError:
                    pass  # Keep original value if parsing fails
            
            if 'end_datetime' in data and isinstance(data['end_datetime'], str):
                try:
                    # Try parsing with datetime-local format (YYYY-MM-DDTHH:MM)
                    if 'T' in data['end_datetime'] and len(data['end_datetime']) == 16:
                        end_dt_naive = datetime.strptime(data['end_datetime'], '%Y-%m-%dT%H:%M')
                    else:
                        end_dt_naive = datetime.strptime(data['end_datetime'], '%Y-%m-%dT%H:%M:%S')
                    try:
                        data['end_datetime'] = est.localize(end_dt_naive, is_dst=None)
                    except (pytz.AmbiguousTimeError, pytz.NonExistentTimeError):
                        try:
                            data['end_datetime'] = est.localize(end_dt_naive, is_dst=True)
                        except:
                            data['end_datetime'] = est.localize(end_dt_naive, is_dst=False)
                except ValueError:
                    pass  # Keep original value if parsing fails
            
            # Check for conflicts (excluding current booking)
            if 'room_ids' in data and 'start_datetime' in data and 'end_datetime' in data:
                room_ids = data.get('room_ids', [])
                start_dt = data.get('start_datetime')
                end_dt = data.get('end_datetime')
                
                if isinstance(start_dt, str):
                    start_dt = datetime.fromisoformat(start_dt.replace('Z', '+00:00'))
                if isinstance(end_dt, str):
                    end_dt = datetime.fromisoformat(end_dt.replace('Z', '+00:00'))
                
                conflicts = check_booking_conflicts(room_ids, start_dt, end_dt, exclude_booking_id=booking_id)
                if conflicts:
                    return Response(
                        {"detail": "The updated booking conflicts with existing bookings.", "conflicts": conflicts}, 
                        status=status.HTTP_409_CONFLICT
                    )
            
            # Store old data for email notification
            old_data = {
                'start_datetime': booking.start_datetime,
                'end_datetime': booking.end_datetime,
                'status': booking.status,
            }
            
            serializer = BookingSerializer(booking, data=data, partial=True, context={'request': request})
            if serializer.is_valid():
                updated_booking = serializer.save()
                
                # Send booking update email
                try:
                    from .email_utils import send_booking_update_email
                    send_booking_update_email(updated_booking, updated_by_admin=False, old_data=old_data)
                except Exception as e:
                    logger.error(f"Failed to send booking update email: {str(e)}")
                
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except (ValueError, TypeError, AttributeError) as e:
            return Response(
                {"detail": f"Invalid input: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error updating booking: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while updating the booking."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, booking_id):
        """Delete (cancel) a booking"""
        try:
            booking = self.get_object(booking_id, request.user)
            if not booking:
                return Response(
                    {"detail": "Booking not found or you don't have permission to delete it."}, 
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Instead of deleting, mark as cancelled
            booking.status = 'Cancelled'
            booking.save()
            
            # Send booking cancellation email
            try:
                from .email_utils import send_booking_cancellation_email
                send_booking_cancellation_email(booking, cancelled_by_admin=False)
            except Exception as e:
                logger.error(f"Failed to send booking cancellation email: {str(e)}")
            
            return Response(
                {"detail": "Booking cancelled successfully."}, 
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Error cancelling booking: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while cancelling the booking."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    
class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        try:
            token = super().get_token(user)
            # Safely add user attributes to token
            if hasattr(user, 'username'):
                token['username'] = user.username
            else:
                token['username'] = user.email  # Fallback to email if username not set
            if hasattr(user, 'role'):
                token['role'] = user.role
            else:
                token['role'] = 'user'  # Default role
            return token
        except Exception as e:
            logger.error(f"Error generating token for user {user.email}: {str(e)}", exc_info=True)
            raise
    
    def validate(self, attrs):
        try:
            data = super().validate(attrs)
            user = self.user
            
            # Check if user is approved
            if hasattr(user, 'approval_status'):
                if user.approval_status == 'pending':
                    raise AuthenticationFailed(
                        "Your account is pending approval. Please wait for an admin to approve your account."
                    )
                elif user.approval_status == 'denied':
                    raise AuthenticationFailed(
                        "Your account has been denied. Please contact an administrator."
                    )
            
            return data
        except AuthenticationFailed:
            # Re-raise authentication failures as-is
            raise
        except Exception as e:
            # Log unexpected errors
            logger.error(f"Error in login validation: {str(e)}", exc_info=True)
            raise AuthenticationFailed("An error occurred during login. Please try again later.")

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    permission_classes = [permissions.AllowAny]  # Allow unauthenticated access for login
    
class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            serializer = UserSerializer(request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (ValueError, TypeError, AttributeError) as e:
            return Response(
                {"detail": f"Invalid request: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error fetching user details: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching user details. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CheckAvailabilityView(APIView):
    """
    Check availability of rooms for a specific date.
    Returns available time slots for the given rooms on the specified date.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            date_str = request.GET.get('date')  # Format: YYYY-MM-DD
            room_ids = request.GET.get('room_ids', '').split(',')  # Comma-separated room IDs
            
            if not date_str:
                return Response(
                    {"detail": "Date parameter is required (format: YYYY-MM-DD)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not room_ids or room_ids == ['']:
                return Response(
                    {"detail": "room_ids parameter is required (comma-separated)"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Parse date
            try:
                check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"detail": "Invalid date format. Use YYYY-MM-DD"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Convert room_ids to integers
            try:
                room_ids = [int(rid) for rid in room_ids if rid.strip()]
            except ValueError:
                return Response(
                    {"detail": "Invalid room_ids format"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get all bookings for these rooms on this date
            # Use EST timezone for consistency
            est = pytz.timezone('America/New_York')
            start_of_day = est.localize(datetime.combine(check_date, datetime.min.time()))
            end_of_day = est.localize(datetime.combine(check_date, datetime.max.time()))
            
            bookings = Booking.objects.filter(
                rooms__id__in=room_ids,
                status__in=['Pending', 'Approved'],
                start_datetime__lt=end_of_day,
                end_datetime__gt=start_of_day
            ).distinct()
            
            # Convert to EST timezone
            est = pytz.timezone('America/New_York')
            
            # Generate all possible hour slots (e.g., 8 AM to 11 PM)
            all_hours = list(range(8, 24))  # 8 AM to 11 PM (midnight is 24)
            unavailable_slots = []
            bookings_list = []
            
            # Prefetch rooms to avoid N+1 queries
            bookings = bookings.prefetch_related('rooms')
            
            # Collect all bookings with their room information
            for booking in bookings:
                if booking.start_datetime and booking.end_datetime:
                    # Convert to EST
                    start_est = booking.start_datetime.astimezone(est)
                    end_est = booking.end_datetime.astimezone(est)
                    
                    # Include booking if it overlaps with the check_date
                    # This handles bookings that start before, end after, or span the check_date
                    if start_est.date() <= check_date <= end_est.date():
                        # Use prefetched rooms instead of querying
                        for room in booking.rooms.all():
                            if room.id in room_ids:
                                bookings_list.append({
                                    'room_id': room.id,
                                    'room_name': room.name,
                                    'start_datetime': booking.start_datetime,
                                    'end_datetime': booking.end_datetime,
                                    'start_est': start_est,
                                    'end_est': end_est,
                                })
            
            # Remove duplicates and create separate lists for calculation and response
            seen_bookings = set()
            booking_slots_for_calculation = []  # Keep datetime objects for hour checking
            for booking_info in bookings_list:
                # Create a unique key for each booking
                key = (booking_info['room_id'], booking_info['start_datetime'], booking_info['end_datetime'])
                if key not in seen_bookings:
                    seen_bookings.add(key)
                    # Store for hour calculation (with datetime objects)
                    booking_slots_for_calculation.append({
                        'room_id': booking_info['room_id'],
                        'start_est': booking_info['start_est'],
                        'end_est': booking_info['end_est'],
                    })
                    # Store for response (without datetime objects, only strings)
                    unavailable_slots.append({
                        'room_id': booking_info['room_id'],
                        'room_name': booking_info['room_name'],
                        'start_time': booking_info['start_est'].strftime('%I:%M %p'),
                        'end_time': booking_info['end_est'].strftime('%I:%M %p'),
                        'start_datetime': booking_info['start_est'].isoformat(),
                        'end_datetime': booking_info['end_est'].isoformat(),
                        'start_hour': booking_info['start_est'].hour,
                        'end_hour': booking_info['end_est'].hour,
                    })
            
            # Generate available hours (hours that are not in unavailable_slots for all rooms)
            available_hours = []
            for hour in all_hours:
                # Check if this hour is available for all requested rooms
                unavailable_for_rooms = set()
                
                for slot in booking_slots_for_calculation:
                    slot_start_est = slot['start_est']
                    slot_end_est = slot['end_est']
                    slot_room_id = slot['room_id']
                    
                    # Create datetime for this hour on the check_date
                    hour_datetime = est.localize(datetime.combine(check_date, datetime.min.time().replace(hour=hour)))
                    hour_end_datetime = hour_datetime + timedelta(hours=1)
                    
                    # Check if this hour overlaps with the booking
                    # A booking blocks an hour if the booking overlaps with that hour slot
                    # This properly handles camp bookings that span multiple days
                    if slot_start_est < hour_end_datetime and slot_end_est > hour_datetime:
                        unavailable_for_rooms.add(slot_room_id)
                
                # An hour is available if at least one requested room is not unavailable
                if len(unavailable_for_rooms) < len(room_ids):
                    available_hours.append(hour)
            
            return Response({
                'date': date_str,
                'room_ids': room_ids,
                'available_hours': available_hours,
                'unavailable_slots': unavailable_slots,
                'all_hours': all_hours
            }, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError, AttributeError) as e:
            return Response(
                {"detail": f"Invalid input: {str(e)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error checking availability: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while checking availability. Please try again later."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class PendingUsersView(APIView):
    """View to list all pending users - Admin only"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            # Only admins can view pending users
            if request.user.role != 'admin':
                return Response(
                    {"detail": "You do not have permission to view pending users."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get all users with pending approval status
            pending_users = User.objects.filter(approval_status='pending').order_by('-date_joined')
            serializer = UserSerializer(pending_users, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error fetching pending users: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while fetching pending users."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class ApproveUserView(APIView):
    """View to approve/deny users and assign roles - Admin only"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, user_id):
        try:
            # Only admins can approve/deny users
            if request.user.role != 'admin':
                return Response(
                    {"detail": "You do not have permission to approve users."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            user = get_object_or_404(User, id=user_id)
            action = request.data.get('action')  # 'approve' or 'deny'
            new_role = request.data.get('role', None)  # Optional role assignment
            
            if action == 'approve':
                user.approval_status = 'approved'
                # If role is provided, update it
                if new_role and new_role in [choice[0] for choice in User.ROLE_CHOICES]:
                    user.role = new_role
                user.save()
                
                # Send approval email
                try:
                    from .email_utils import send_account_approval_email
                    send_account_approval_email(user, approved=True)
                except Exception as e:
                    logger.error(f"Failed to send account approval email: {str(e)}")
                
                serializer = UserSerializer(user)
                return Response(
                    {"detail": "User approved successfully.", "user": serializer.data}, 
                    status=status.HTTP_200_OK
                )
            elif action == 'deny':
                user.approval_status = 'denied'
                user.save()
                
                # Send denial email
                try:
                    from .email_utils import send_account_approval_email
                    send_account_approval_email(user, approved=False)
                except Exception as e:
                    logger.error(f"Failed to send account denial email: {str(e)}")
                
                serializer = UserSerializer(user)
                return Response(
                    {"detail": "User denied successfully.", "user": serializer.data}, 
                    status=status.HTTP_200_OK
                )
            else:
                return Response(
                    {"detail": "Invalid action. Use 'approve' or 'deny'."}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"Error processing user approval: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while processing the request."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class UpdateBookingStatusView(APIView):
    """View to update booking status - Admin only"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, booking_id):
        try:
            # Only admins can update booking status
            if request.user.role != 'admin':
                return Response(
                    {"detail": "You do not have permission to update booking status."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            booking = get_object_or_404(Booking, id=booking_id)
            new_status = request.data.get('status')
            
            # Validate status
            valid_statuses = ['Pending', 'Approved', 'Cancelled']
            if new_status not in valid_statuses:
                return Response(
                    {"detail": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Store old status for email notification
            old_status = booking.status
            
            # Update status
            booking.status = new_status
            booking.save()
            
            # Send email notification based on status change
            try:
                from .email_utils import send_booking_update_email, send_booking_cancellation_email
                if new_status == 'Cancelled':
                    send_booking_cancellation_email(booking, cancelled_by_admin=True)
                else:
                    old_data = {
                        'start_datetime': booking.start_datetime,
                        'end_datetime': booking.end_datetime,
                        'status': old_status,
                    }
                    send_booking_update_email(booking, updated_by_admin=True, old_data=old_data)
            except Exception as e:
                logger.error(f"Failed to send booking status update email: {str(e)}")
            
            # Return updated booking
            serializer = BookingSerializer(booking)
            return Response(
                {"detail": f"Booking status updated to {new_status}.", "booking": serializer.data}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error updating booking status: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while updating booking status."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class DeleteAllBookingsView(APIView):
    """View to delete all bookings - Admin only"""
    permission_classes = [permissions.IsAuthenticated]
    
    def delete(self, request):
        try:
            # Only admins can delete all bookings
            if request.user.role != 'admin':
                return Response(
                    {"detail": "You do not have permission to delete all bookings."}, 
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get count before deletion
            booking_count = Booking.objects.count()
            
            # Delete all bookings
            Booking.objects.all().delete()
            
            return Response(
                {"detail": f"Successfully deleted {booking_count} booking(s)."}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Error deleting all bookings: {str(e)}", exc_info=True)
            return Response(
                {"detail": "An error occurred while deleting all bookings."}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )