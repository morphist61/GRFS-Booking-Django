from django.urls import path
from .views import CreateBookingView

urlpatterns = [
    path('create_booking/', CreateBookingView.as_view(), name='create-booking'),
]
