from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(Floor)
admin.site.register(Room)
admin.site.register(Booking)