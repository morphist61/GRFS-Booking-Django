from django.db import models

# Create your models here.
class Room(models.Model):
    name = models.CharField(max_length=100)
    floor = models.ForeignKey('Floor', on_delete=models.CASCADE)

class Floor(models.Model):
    name = models.CharField(max_length=100)
    rooms = models.ArrayField(models.ForeignKey('Room', on_delete=models.CASCADE))
    
class Booking(models.Model):
    