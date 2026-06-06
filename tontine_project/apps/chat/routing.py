from django.urls import re_path
from apps.chat.consumers import ChatConsumer

websocket_urlpatterns = [
    # WebSocket endpoint pour les conversations
    # Format: ws://localhost:8000/ws/chat/<conversation_id>/?token=<jwt_token>
    re_path(
        r'ws/chat/(?P<conversation_id>[^/]+)/?$',
        ChatConsumer.as_asgi(),
        name='ws-chat-consumer'
    ),
]
