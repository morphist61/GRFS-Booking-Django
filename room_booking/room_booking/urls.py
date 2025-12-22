"""
URL configuration for room_booking project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from booking.views import serve_react_app

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('booking.urls')),
]

# Serve React app for all non-API, non-admin routes (production)
# This allows React Router to handle client-side routing
if not settings.DEBUG:
    urlpatterns += [
        path('', serve_react_app, name='react-app'),
        # Exclude api/, admin/, static/, media/, and common static files from catch-all
        # static/ is where Vite outputs CSS/JS files (configured in vite.config.js)
        re_path(r'^(?!api/|admin/|static/|media/|favicon\.ico|robots\.txt|manifest\.json).*$', serve_react_app),
    ]else:
    # Development: serve media if you're testing uploads
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
