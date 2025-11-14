from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, generics
from .models import Booking, Room, Floor
from .serializers import *
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import datetime, timedelta
from django.db.models import Q
import pytz

# Create your views here.

User = get_user_model()

def check_booking_conflicts(room_ids, start_datetime, end_datetime, exclude_booking_id=None):
    """
    Check if any of the given rooms have existing bookings that conflict with the requested time.
    Returns a list of conflicting bookings with details.
    """
    try:
        start_dt = datetime.fromisoformat(start_datetime.replace('Z', '+00:00')) if isinstance(start_datetime, str) else start_datetime
        end_dt = datetime.fromisoformat(end_datetime.replace('Z', '+00:00')) if isinstance(end_datetime, str) else end_datetime
    except:
        start_dt = start_datetime
        end_dt = end_datetime
    
    # Find bookings that overlap with the requested time for any of the rooms
    # Overlap occurs when: existing_start < requested_end AND existing_end > requested_start
    conflicting_bookings = Booking.objects.filter(
        rooms__id__in=room_ids,
        status__in=['Pending', 'Approved']  # Only check active bookings
    ).filter(
        Q(start_datetime__lt=end_dt) & Q(end_datetime__gt=start_dt)
    ).distinct()
    
    if exclude_booking_id:
        conflicting_bookings = conflicting_bookings.exclude(id=exclude_booking_id)
    
    conflicts = []
    for booking in conflicting_bookings:
        # Get the rooms that conflict
        conflicting_rooms = booking.rooms.filter(id__in=room_ids)
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
                start_dt_naive = datetime.strptime(start_datetime_str, '%Y-%m-%dT%H:%M:%S')
                end_dt_naive = datetime.strptime(end_datetime_str, '%Y-%m-%dT%H:%M:%S')
                
                # Localize to EST
                start_datetime = est.localize(start_dt_naive)
                end_datetime = est.localize(end_dt_naive)
            except ValueError:
                # Try parsing with timezone if provided
                try:
                    start_datetime = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                    end_datetime = datetime.fromisoformat(end_datetime_str.replace('Z', '+00:00'))
                    # Convert to EST
                    start_datetime = start_datetime.astimezone(est)
                    end_datetime = end_datetime.astimezone(est)
                except:
                    return Response(
                        {"detail": "Invalid datetime format. Use YYYY-MM-DDTHH:MM:SS"}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

            # Check for booking conflicts
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

            # Create the booking with the selected rooms
            # Pass datetime objects directly (serializer will handle them)
            booking_data = {
                "room_ids": room_ids,
                "start_datetime": start_datetime,
                "end_datetime": end_datetime,
                "status": "Pending",
            }

            serializer = BookingSerializer(data=booking_data, context={'request': request})
            if serializer.is_valid():
                booking = serializer.save()  # Create booking
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class FloorListView(APIView):
    permission_classes = [permissions.AllowAny]  # Anyone can view floors

    def get(self, request):
        try:
            floors = Floor.objects.all()
            serializer = FloorSerializer(floors, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while fetching floors: {str(e)}"}, 
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
                    Floor.objects.get(id=floor_id)
                except Floor.DoesNotExist:
                    return Response(
                        {"detail": f"Floor with id {floor_id} does not exist."}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
                rooms = Room.objects.filter(floor_id=floor_id)  # Filter rooms by floor
            else:
                rooms = Room.objects.all()  # Return all rooms if no floor ID is provided
            serializer = RoomSerializer(rooms, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while fetching rooms: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class BookingListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            if request.user.role == 'admin':
                bookings = Booking.objects.all()
            else:
                bookings = Booking.objects.filter(user=request.user)
            serializer = BookingSerializer(bookings, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while fetching bookings: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def post(self, request):
        try:
            serializer = BookingSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while creating booking: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MyBookingView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        try:
            bookings = Booking.objects.filter(user=request.user)
            serializer = BookingSerializer(bookings, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while fetching your bookings: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]
    
class LoginSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['username'] = user.username
        token['role'] = user.role
        return token

class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    
class UserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            serializer = UserSerializer(request.user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while fetching user details: {str(e)}"}, 
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
            start_of_day = timezone.make_aware(datetime.combine(check_date, datetime.min.time()))
            end_of_day = timezone.make_aware(datetime.combine(check_date, datetime.max.time()))
            
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
            
            # Collect all bookings with their room information
            for booking in bookings:
                if booking.start_datetime and booking.end_datetime:
                    # Convert to EST
                    start_est = booking.start_datetime.astimezone(est)
                    end_est = booking.end_datetime.astimezone(est)
                    
                    # Only include if booking is on the selected date
                    if start_est.date() == check_date or end_est.date() == check_date:
                        for room in booking.rooms.filter(id__in=room_ids):
                            bookings_list.append({
                                'room_id': room.id,
                                'room_name': room.name,
                                'start_datetime': booking.start_datetime,
                                'end_datetime': booking.end_datetime,
                                'start_est': start_est,
                                'end_est': end_est,
                            })
            
            # Remove duplicates and format for response
            seen_bookings = set()
            for booking_info in bookings_list:
                # Create a unique key for each booking
                key = (booking_info['room_id'], booking_info['start_datetime'], booking_info['end_datetime'])
                if key not in seen_bookings:
                    seen_bookings.add(key)
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
                unavailable_for_rooms = []
                for slot in unavailable_slots:
                    # Check if hour falls within the booking time range
                    if slot['start_hour'] <= hour < slot['end_hour']:
                        unavailable_for_rooms.append(slot)
                
                if len(unavailable_for_rooms) < len(room_ids):
                    # At least one room is available at this hour
                    available_hours.append(hour)
            
            return Response({
                'date': date_str,
                'room_ids': room_ids,
                'available_hours': available_hours,
                'unavailable_slots': unavailable_slots,
                'all_hours': all_hours
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"detail": f"An error occurred while checking availability: {str(e)}"}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )