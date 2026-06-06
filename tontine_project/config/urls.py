from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static


from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from apps.cycles.verify_views import PublicReceiptVerifyView

#documentation api
schema_view = get_schema_view(
   openapi.Info(
      title="API Tontine Backend",
      default_version='v1',
      description="Documentation API of Tontine Backend",
      terms_of_service="https://www.google.com/policies/terms/",
      contact=openapi.Contact(email="contact@snippets.local"),
      license=openapi.License(name="BSD License"),
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)


urlpatterns = [
    path('admin/', admin.site.urls),

    # Auth (JWT)
    path('api/auth/', include('apps.core.urls')),

    # Business apps
    path('api/associations/', include('apps.core.urls')),
    path('api/members/', include('apps.members.urls')),
    path('api/tontines/', include('apps.tontines.urls')),
    path('api/cycles/', include('apps.cycles.urls')),
    path('api/finance/', include('apps.finance.urls')),
    path('api/governance/', include('apps.governance.urls')),
    path('api/sanctions/', include('apps.sanctions.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/subscriptions/', include('apps.subscriptions.urls')),
    path('api/invitations/', include('apps.invitations.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/wallets/', include('apps.wallets.urls')),
    path('api/proxies/', include('apps.proxies.urls')),
    path('api/approvals/', include('apps.approvals.urls')),

    # Vérification publique de bordereau via QR code (pas d'auth)
    path(
        'api/receipts/verify/<str:hash_value>/',
        PublicReceiptVerifyView.as_view(),
        name='receipt-verify',
    ),

    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
