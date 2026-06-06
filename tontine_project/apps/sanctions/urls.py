from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.sanctions.views import SanctionTypeViewSet, SanctionViewSet

router = DefaultRouter()
router.register('types', SanctionTypeViewSet, basename='sanction-type')
router.register('sanctions', SanctionViewSet, basename='sanction')

urlpatterns = [path('', include(router.urls))]
