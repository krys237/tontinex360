from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.chat.views import (
    ConversationViewSet, CreatePrivateConversationView, CreateGroupConversationView,
    GeneralConversationView,
)

router = DefaultRouter()
router.register('conversations', ConversationViewSet, basename='conversation')

# IMPORTANT : les routes explicites (private/group/general) DOIVENT précéder
# le routeur, sinon DRF interprète "general" comme un `pk` de ConversationViewSet
# (qui est ReadOnly → POST renvoie 405 Method Not Allowed).
urlpatterns = [
    path('conversations/private/', CreatePrivateConversationView.as_view(), name='create-private'),
    path('conversations/group/', CreateGroupConversationView.as_view(), name='create-group'),
    path('conversations/general/', GeneralConversationView.as_view(), name='general-channel'),
    path('', include(router.urls)),
]
