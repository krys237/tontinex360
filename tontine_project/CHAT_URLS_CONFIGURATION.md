# Configuration URLs Django pour le Chat

Ce fichier montre les URLs à ajouter à votre configuration Django.

## 📍 Configuration Principale (config/urls.py)

Votre fichier `config/urls.py` actuel devrait ressembler à ceci :

```python
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from rest_framework import permissions

schema_view = get_schema_view(
    openapi.Info(
        title="Tontine API",
        default_version='v1',
        // ... autres configs
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    # Admin
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0)),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0)),
    
    # API Routes for all apps
    path('api/v1/', include([
        path('conversations/', include('apps.chat.urls')),
        path('members/', include('apps.members.urls')),
        path('cycles/', include('apps.cycles.urls')),
        # ... autres apps
    ])),
    
    # Static & Media files
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
```

## 💬 URLs Chat (apps/chat/urls.py)

Créer ou mettre à jour le fichier `apps/chat/urls.py`:

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.chat.views import ConversationViewSet

# Router pour les viewsets
router = DefaultRouter()
router.register(r'', ConversationViewSet, basename='conversation')

app_name = 'chat'

urlpatterns = [
    path('', include(router.urls)),
    
    # Routes spécifiques supplémentaires (optionnel)
    # path('<uuid:pk>/jitsi-token/', ConversationViewSet.as_view({'get': 'get_jitsi_token'})),
]
```

## 🔌 WebSocket Configuration (config/asgi.py)

**Déjà configuré avec :** ✅

```python
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')

django_asgi_app = get_asgi_application()

from apps.chat.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
```

## 📡 WebSocket Routes (apps/chat/routing.py)

**Déjà configuré avec :** ✅

```python
from django.urls import re_path
from apps.chat.consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(
        r'ws/chat/(?P<conversation_id>[^/]+)/?$',
        ChatConsumer.as_asgi(),
        name='ws-chat-consumer'
    ),
]
```

## 🚀 Endpoints REST API

### 1. Lister les Conversations
```
GET /api/v1/conversations/
Authorization: Bearer <token>
```

**Réponse:**
```json
{
    "count": 10,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": "uuid",
            "name": "Discussion Trésorier",
            "conv_type": "private",
            "members": [...],
            "last_message_at": "2026-04-01T14:30:00Z",
            "message_count": 42,
            "my_unread_count": 2
        }
    ]
}
```

### 2. Créer une Conversation
```
POST /api/v1/conversations/
Authorization: Bearer <token>

{
    "name": "Nom Conversation",
    "conv_type": "group",
    "description": "Description",
    "member_ids": ["uuid1", "uuid2"]
}
```

### 3. Détail + Messages
```
GET /api/v1/conversations/{id}/
Authorization: Bearer <token>
```

### 4. Envoyer un Message
```
POST /api/v1/conversations/{id}/send/
Authorization: Bearer <token>

{
    "content": "Message texte",
    "message_type": "text",
    "reply_to": "message_uuid_optionnel"
}
```

### 5. Lister les Messages
```
GET /api/v1/conversations/{id}/messages/
Authorization: Bearer <token>
```

### 6. Marquer comme Lue
```
POST /api/v1/conversations/{id}/mark_as_read/
Authorization: Bearer <token>
```

### 7. Mute/Unmute
```
POST /api/v1/conversations/{id}/mute/
Authorization: Bearer <token>

{
    "is_muted": true
}
```

### 8. Ajouter Membre au Groupe
```
POST /api/v1/conversations/{id}/add_member/
Authorization: Bearer <token>

{
    "member_id": "uuid-nouveau-membre"
}
```

### 9. Retirer Membre du Groupe
```
POST /api/v1/conversations/{id}/remove_member/
Authorization: Bearer <token>

{
    "member_id": "uuid-membre-a-retirer"
}
```

### 10. Obtenir URL Jitsi
```
POST /api/v1/conversations/{id}/get_jitsi_url/
Authorization: Bearer <token>
```

**Réponse:**
```json
{
    "jitsi_url": "https://meet.jit.si/tontine_conv123?userInfo.displayName=Jean",
    "room_id": "tontine_conv123",
    "expires_at": "2026-04-01T15:30:00Z"
}
```

## 🔐 Authentification

### JWT Token Flow

```
1. POST /api/token/
   ├─ Body: {username, password}
   └─ Response: {access, refresh}

2. Utiliser le token dans les headers:
   Authorization: Bearer <access_token>

3. Si expiration (401):
   POST /api/token/refresh/
   ├─ Body: {refresh}
   └─ Response: {access}
```

## 🌍 Configuration CORS (pour React)

Vérifier `config/settings/base.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",      # Dev React
    "http://localhost:3001",      # Autre instance
    "https://yourdomain.com",     # Production
]

CORS_ALLOW_CREDENTIALS = True  # Important pour les cookies/auth
```

## 📊 Architecture Complète des URLs

```
HTTP Routing (REST API)
├── /admin/                          (Django Admin)
├── /swagger/                        (API Docs)
├── /redoc/                          (ReDoc Docs)
└── /api/v1/
    ├── conversations/               (ConversationViewSet)
    │   ├── GET    - List
    │   ├── POST   - Create
    │   ├── GET    - Detail
    │   ├── PUT    - Update
    │   ├── DELETE - Destroy
    │   ├── POST   - send/           (Envoyer message)
    │   ├── POST   - mark_as_read/   (Marquer lue)
    │   ├── POST   - mute/           (Mute conversation)
    │   ├── POST   - add_member/     (Ajouter membre)
    │   ├── POST   - remove_member/  (Retirer membre)
    │   ├── GET    - messages/       (Lister messages)
    │   └── POST   - get_jitsi_url/  (URL Jitsi)
    ├── members/                     (Autres apps...)
    └── ...

WebSocket Routing (Real-Time Chat)
└── ws://
    ├── /ws/chat/{conversation_id}/?token={jwt}  (ChatConsumer)
    │   ├── Authentification JWT
    │   ├── Messages réel-temps
    │   ├── Indicateurs de frappe
    │   ├── Sessions Jitsi
    │   └── Broadcasting groups
    └── ...
```

## 🚦 Flux de Requête Typique

### Création Conversation + Message

```
1. Frontend React
   └─→ POST /api/v1/conversations/ (créer)
       └─→ Response: conversation {id}

2. Frontend établit WebSocket
   └─→ WebSocket /ws/chat/{id}/?token=...
       └─→ onopen déclenché

3. Frontend envoie message
   └─→ {type: 'chat.message', content: '...'}
       └─→ Consumer reçoit et crée Message en DB

4. Broadcast à tous les clients du groupe
   └─→ jitsi.message.broadcast
       └─→ Tous reçoivent le message en temps réel

5. Optionnel : Démarrer Jitsi
   └─→ {type: 'jitsi.start_session'}
       └─→ Consumer génère room_id + token
       └─→ Envoie URL Jitsi aux participants
```

## 🧪 Test des Endpoints

### Avec cURL

```bash
# 1. Obtenir le token
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}' \
  | json_pp

# 2. Récupérer le token de la réponse
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGc..."

# 3. Lister les conversations
curl -X GET http://localhost:8000/api/v1/conversations/ \
  -H "Authorization: Bearer $TOKEN" \
  | json_pp

# 4. Envoyer un message
curl -X POST http://localhost:8000/api/v1/conversations/{id}/send/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello","message_type":"text"}' \
  | json_pp
```

### Avec Postman

1. **Collection de base:**
   - Importer: Environment variables avec {base_url}, {token}
   - POST {{base_url}}/api/token/
   - GET {{base_url}}/api/v1/conversations/
   - POST {{base_url}}/api/v1/conversations/{id}/send/

2. **Tests automatiques:**
   - Ajouter des tests après chaque request
   - Vérifier les status codes (200, 201, 400, 401, 403, 404)

### Avec Python requests

```python
import requests
import json

BASE_URL = "http://localhost:8000"
USERNAME = "your_username"
PASSWORD = "your_password"

# 1. Authentification
response = requests.post(
    f"{BASE_URL}/api/token/",
    json={"username": USERNAME, "password": PASSWORD}
)
token = response.json()["access"]

# 2. Header avec authentification
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# 3. Lister conversations
response = requests.get(
    f"{BASE_URL}/api/v1/conversations/",
    headers=headers
)
conversations = response.json()
print(json.dumps(conversations, indent=2))

# 4. Envoyer un message
conv_id = conversations["results"][0]["id"]
response = requests.post(
    f"{BASE_URL}/api/v1/conversations/{conv_id}/send/",
    headers=headers,
    json={
        "content": "Hello from Python!",
        "message_type": "text"
    }
)
message = response.json()
print(f"Message envoyé: {message['id']}")
```

## 📝 Documentation Swagger

L'API est auto-documentée via Swagger/OpenAPI:

- **Swagger UI**: http://localhost:8000/swagger/
- **ReDoc**: http://localhost:8000/redoc/

Chaque endpoint est documenté avec:
- Description
- Paramètres requis/optionnels
- Modèles d'entrée/sortie
- Codes HTTP
- Exemples

## ✅ Vérifier l'Installation

```bash
# 1. Vérifier que tous les fichiers sont présents
ls -la apps/chat/
# Doit avoir: consumers.py, routing.py, jitsi_utils.py, chat_utils.py

# 2. Vérifier la configuration ASGI
cat config/asgi.py
# Doit avoir ProtocolTypeRouter + websocket_urlpatterns

# 3. Vérifier les settings
grep -A 5 "CHANNEL_LAYERS" config/settings/base.py
# Doit avoir la config Channels

# 4. Tester les migrations
python manage.py makemigrations
python manage.py migrate

# 5. Lancer le serveur
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

## 🎉 Prêt à Développer!

Tous les URLs et endpoints sont maintenant configurés et documentés.

Prochain step: **Implémenter l'interface React!**
