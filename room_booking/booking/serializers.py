from rest_framework import serializers
from .models import Booking, Room, Floor
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True) # Hide password in responses
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'role', 'password']

    def create(self, validated_data):
        user = User(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            role=validated_data.get('role', 'user')
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
        queryset=Room.objects.all(), many=True, write_only=True, source='rooms'
    )

    class Meta:
        model = Booking
        fields = ['id', 'user', 'rooms', 'room_ids', 'start_datetime', 'end_datetime', 'status', 'created_at']

    def create(self, validated_data):
        """Automatically assign the logged-in user when creating a booking"""
        user = self.context['request'].user
        validated_data['user'] = user
        return super().create(validated_data)