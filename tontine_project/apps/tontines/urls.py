from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.tontines.views import TontineTypeViewSet, MemberSubscriptionViewSet

router = DefaultRouter()
router.register('types', TontineTypeViewSet, basename='tontine-type')
router.register('subscriptions', MemberSubscriptionViewSet, basename='member-subscription')


urlpatterns = [path('', include(router.urls))]
