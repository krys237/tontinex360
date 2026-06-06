from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.proxies.views import ProxyViewSet

router = DefaultRouter()
router.register('', ProxyViewSet, basename='proxy')

urlpatterns = [
    path('', include(router.urls)),
]
