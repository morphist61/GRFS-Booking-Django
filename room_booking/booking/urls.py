from django.urls import path
from .views import *
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('create_booking/', CreateBookingView.as_view(), name='create-booking'),
    path('check_availability/', CheckAvailabilityView.as_view(), name='check-availability'),
    path('floors/', FloorListView.as_view(), name='floor-list'),
    path('rooms/', RoomListView.as_view(), name='room-list'),
    path('bookings/', BookingListCreateView.as_view(), name='booking-list-create'),
    path('bookings/my', MyBookingView.as_view(), name='my-bookings'),
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/user/', UserDetailView.as_view(), name='user-detail'),
]
