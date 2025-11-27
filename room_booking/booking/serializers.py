from rest_framework import serializers
from .models import Booking, Room, Floor
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8) # Hide password in responses, enforce minimum length
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'gender', 'password']
        read_only_fields = ['role']  # Role cannot be set via API, only by admins

    def validate_email(self, value):
        """Validate email format"""
        if not value:
            raise serializers.ValidationError("Email is required.")
        return value.lower().strip()

    def validate_password(self, value):
        """Validate password strength"""
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

    def validate_gender(self, value):
        """Validate gender choice"""
        if value and value not in ['male', 'female']:
            raise serializers.ValidationError("Gender must be either 'male' or 'female'.")
        return value

    def create(self, validated_data):
        # Force role to 'user' during registration - only admins can change roles
        # Remove role from validated_data if present to prevent role escalation
        validated_data.pop('role', None)
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            gender=validated_data.get('gender', ''),
            role='user'  # Always set to 'user' on registration for security
        )

        user.set_password(validated_data['password'])
        user.save()
        return user
        

class FloorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Floor
        fields = ['id', 'name']
        
class RoomSerializer(serializers.ModelSerializer):
    floor = FloorSerializer(read_only=True)  # Nested data for readability
    floor_id = serializers.PrimaryKeyRelatedField(
        queryset=Floor.objects.all(), source='floor', write_only=True
    )

    class Meta:
        model = Room
        fields = ['id', 'name', 'floor', 'floor_id']

class BookingSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    rooms = RoomSerializer(many=True, read_only=True)
    room_ids = serializers.PrimaryKeyRelatedField(
        queryset=Room.objects.all(), many=True, write_only=True, source='rooms', required=False
    )

    class Meta:
        model = Booking
        fields = ['id', 'user', 'rooms', 'room_ids', 'start_datetime', 'end_datetime', 'status', 'created_at']
        read_only_fields = ['status', 'user', 'created_at']  # Status and user cannot be set via API
    
    def update(self, instance, validated_data):
        """Update booking instance"""
        # Don't allow changing user
        validated_data.pop('user', None)
        # Don't allow changing status directly (use cancel endpoint)
        validated_data.pop('status', None)
        return super().update(instance, validated_data)

    def validate_room_ids(self, value):
        """Validate that at least one room is selected"""
        # Only validate if value is provided (for updates, room_ids might not be included)
        if value is not None and (not value or len(value) == 0):
            raise serializers.ValidationError("At least one room must be selected.")
        return value

    def validate(self, data):
        """Validate booking datetime logic"""
        start_datetime = data.get('start_datetime')
        end_datetime = data.get('end_datetime')
        
        if start_datetime and end_datetime:
            if end_datetime <= start_datetime:
                raise serializers.ValidationError({
                    'end_datetime': 'End datetime must be after start datetime.'
                })
        
        return data

    def create(self, validated_data):
        """Automatically assign the logged-in user when creating a booking"""
        from datetime import timedelta
        
        user = self.context['request'].user
        validated_data['user'] = user
        
        # Determine booking status based on duration and number of rooms
        # Auto-approve if: duration < 6 hours AND rooms <= 2
        # Otherwise, require manual approval (Pending)
        start_datetime = validated_data.get('start_datetime')
        end_datetime = validated_data.get('end_datetime')
        rooms = validated_data.get('rooms', [])  # room_ids maps to 'rooms' via source, returns Room objects
        
        if start_datetime and end_datetime:
            booking_duration = end_datetime - start_datetime
            duration_hours = booking_duration.total_seconds() / 3600
            num_rooms = len(rooms) if rooms else 0
            
            if duration_hours < 6 and num_rooms <= 2:
                validated_data['status'] = 'Approved'
            else:
                validated_data['status'] = 'Pending'
        else:
            validated_data['status'] = 'Pending'
        
        return super().create(validated_data)