from django.db import models
from django.contrib.auth.models import User
from datetime import datetime

# Create your models here.
class Floor(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Room(models.Model):
    name = models.CharField(max_length=100)
    floor = models.ForeignKey(Floor, on_delete=models.CASCADE, related_name="rooms")

    def __str__(self):
        return f"{self.name} (Floor {self.floor.name})"
    
class Booking(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    rooms = models.ManyToManyField("Room", related_name="bookings")
    start_datetime = models.DateTimeField(null=True, blank=True)
    end_datetime = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("Pending", "Pending"),
            ("Approved", "Approved"),
            ("Cancelled", "Cancelled"),
        ],
        default="Pending",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Booking by {self.user.username} from {self.start_datetime} to {self.end_datetime}"

    class Meta:
        ordering = ["-created_at"]