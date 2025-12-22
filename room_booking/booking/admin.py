from django.contrib import admin
from .models import *

# Register your models here.
admin.site.register(CustomUser)
admin.site.register(Floor)

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ['name', 'floor', 'image']
    list_filter = ['floor']
    search_fields = ['name']

admin.site.register(Booking)