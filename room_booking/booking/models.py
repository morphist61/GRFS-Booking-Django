from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.auth import get_user_model

class CustomUser(AbstractUser):
    
    email = models.EmailField(max_length=100, unique=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    ROLE_CHOICES = [
        ('user', 'User'),
        ('mentor', 'Mentor'),
        ('coordinator', 'Coordinator'),
        ('admin', 'Admin'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    
    APPROVAL_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('denied', 'Denied'),
    ]
    approval_status = models.CharField(
        max_length=20, 
        choices=APPROVAL_STATUS_CHOICES, 
        default='pending',
        db_index=True
    )

    def __str__(self):
        return f"{self.username} ({self.role})"


class Floor(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Room(models.Model):
    name = models.CharField(max_length=100)
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name="rooms")
    image = models.ImageField(upload_to='rooms/', blank=True, null=True, help_text="Room image")

    def __str__(self):
        return f"{self.name} (Floor {self.floor.name})"


User = get_user_model()

class Booking(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    rooms = models.ManyToManyField("Room", related_name="bookings")
    start_datetime = models.DateTimeField(null=True, blank=True, db_index=True)
    end_datetime = models.DateTimeField(null=True, blank=True, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("Pending", "Pending"),
            ("Approved", "Approved"),
            ("Cancelled", "Cancelled"),
        ],
        default="Pending",
        db_index=True,  # Add index for faster filtering
    )
    BOOKING_TYPE_CHOICES = [
        ('regular', 'Regular'),
        ('camp', 'Camp'),
    ]
    booking_type = models.CharField(
        max_length=20,
        choices=BOOKING_TYPE_CHOICES,
        default='regular',
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['status', 'start_datetime']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f"Booking by {self.user.username} from {self.start_datetime} to {self.end_datetime}"
