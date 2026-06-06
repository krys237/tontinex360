# Exemples d'Utilisation - Chat Tontine

## 📌 Architecture

```
┌─────────────────┐
│  Client React   │
└────────┬────────┘
         │
    HTTPS│REST API
         │
    ┌────▼─────────────┐
    │ Django Backend   │
    ├──────────────────┤
    │ WebSocket Chat   │
    │ Channels + Redis │
    └────┬──────────┬──┘
         │          │
      WS │          │ HTTP
         │    ┌─────▼──────┐
    ┌────▼─┐  │ Jitsi Meet │
    │Redis │  └────────────┘
    └──────┘
```

## 🔌 Endpoints REST API

### 1. Créer une Conversation Privée

**Request:**
```http
POST /api/v1/conversations/ HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
    "type": "create_private",
    "other_member_id": "uuid-du-membre-2"
}
```

**Response:**
```json
{
    "id": "conv-uuid",
    "name": "Conversation privée : Jean & Marie",
    "conv_type": "private",
    "members": [
        {
            "id": "member-1",
            "member_name": "Jean Dupont",
            "role": "member"
        },
        {
            "id": "member-2",
            "member_name": "Marie Nkoum",
            "role": "member"
        }
    ],
    "message_count": 0,
    "last_message_at": null
}
```

### 2. Créer une Conversation de Groupe

**Request:**
```http
POST /api/v1/conversations/ HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
    "type": "create_group",
    "name": "Groupe des Administrateurs",
    "description": "Discussion administrative",
    "member_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response:**
```json
{
    "id": "conv-uuid",
    "name": "Groupe des Administrateurs",
    "conv_type": "group",
    "description": "Discussion administrative",
    "members": [...],
    "is_active": true
}
```

### 3. Lister les Conversations

**Request:**
```http
GET /api/v1/conversations/ HTTP/1.1
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` : private, group, session, bureau, general
- `ordering` : -last_message_at (défaut)
- `page` : pagination

**Response:**
```json
{
    "count": 15,
    "next": "http://api/v1/conversations/?page=2",
    "previous": null,
    "results": [
        {
            "id": "conv-uuid",
            "name": "Discussion du Trésorier",
            "conv_type": "private",
            "members": [...],
            "last_message": "À bientôt !",
            "last_message_at": "2026-04-01T14:30:00Z",
            "message_count": 42,
            "my_unread_count": 2,
            "is_active": true
        },
        ...
    ]
}
```

### 4. Détail Conversation + Messages

**Request:**
```http
GET /api/v1/conversations/<conversation_id>/ HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
    "id": "conv-uuid",
    "name": "Discussion du Trésorier",
    "conv_type": "private",
    "members": [...],
    "last_message": "À bientôt !",
    "message_count": 42,
    "last_message_at": "2026-04-01T14:30:00Z"
}
```

### 5. Obtenir les Messages d'une Conversation

**Request:**
```http
GET /api/v1/conversations/<conversation_id>/messages/ HTTP/1.1
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` : nombre de messages (défaut: 50)
- `ordering` : -created_at

**Response:**
```json
[
    {
        "id": "msg-uuid-1",
        "sender": "user-uuid",
        "sender_name": "Jean Dupont",
        "content": "Bonjour à tous",
        "message_type": "text",
        "reply_to": null,
        "reply_preview": null,
        "attachments": [],
        "is_deleted": false,
        "created_at": "2026-04-01T14:25:00Z"
    },
    {
        "id": "msg-uuid-2",
        "sender": "user-uuid-2",
        "sender_name": "Marie Dupont",
        "content": "Bonjour Jean",
        "message_type": "text",
        "reply_to": "msg-uuid-1",
        "reply_preview": "Bonjour à tous",
        "attachments": [],
        "is_deleted": false,
        "created_at": "2026-04-01T14:26:00Z"
    }
]
```

### 6. Envoyer un Message (REST alternative à WebSocket)

**Request:**
```http
POST /api/v1/conversations/<conversation_id>/send/ HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
    "content": "Très important !",
    "message_type": "text",
    "reply_to": "msg-uuid-optionnel",
    "attachments": []
}
```

**Response:**
```json
{
    "id": "msg-uuid",
    "sender": "user-uuid",
    "sender_name": "Jean Dupont",
    "content": "Très important !",
    "message_type": "text",
    "created_at": "2026-04-01T14:30:00Z"
}
```

### 7. Marquer Conversation comme Lue

**Request:**
```http
POST /api/v1/conversations/<conversation_id>/mark_as_read/ HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
    "status": "success",
    "message": "Conversation marked as read"
}
```

### 8. Mute/Unmute Conversation

**Request:**
```http
POST /api/v1/conversations/<conversation_id>/mute/ HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
    "is_muted": true
}
```

### 9. Ajouter Membre à un Groupe

**Request:**
```http
POST /api/v1/conversations/<conversation_id>/add_member/ HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
    "member_id": "uuid-nouveau-membre"
}
```

### 10. Obtenir Jitsi URL

**Request:**
```http
POST /api/v1/conversations/<conversation_id>/get_jitsi_url/ HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
    "jitsi_url": "https://meet.jit.si/tontine_conv123_1234567890?userInfo.displayName=Jean%20Dupont",
    "room_id": "tontine_conv123_1234567890",
    "created_at": "2026-04-01T14:30:00Z",
    "expires_at": "2026-04-01T15:30:00Z"
}
```

## 🌐 WebSocket Examples

### Initialisation

```javascript
// En React avec Hook personnalisé
import { useEffect, useRef } from 'react';

const useChatWebSocket = (conversationId, accessToken) => {
    const ws = useRef(null);
    const [messages, setMessages] = React.useState([]);
    const [isTyping, setIsTyping] = React.useState({});

    useEffect(() => {
        // Déterminer le protocole
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        
        // Créer la connexion WebSocket
        ws.current = new WebSocket(
            `${protocol}//${window.location.host}/ws/chat/${conversationId}/?token=${accessToken}`
        );

        ws.current.onopen = () => {
            console.log('Chat connecté');
        };

        ws.current.onmessage = (e) => {
            const data = JSON.parse(e.data);
            handleWebSocketMessage(data);
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.current.onclose = () => {
            console.log('Chat déconnecté');
            // Optionnel : reconnecter après 5 secondes
            setTimeout(() => {
                // reconnecter
            }, 5000);
        };

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [conversationId, accessToken]);

    const handleWebSocketMessage = (data) => {
        switch (data.type) {
            case 'chat.message':
                setMessages(prev => [...prev, data.data]);
                break;
            case 'chat.typing':
                setIsTyping(prev => ({
                    ...prev,
                    [data.data.user_id]: data.data.is_typing
                }));
                break;
            case 'jitsi.session.started':
                console.log('Jitsi session started:', data.data.jitsi_room_id);
                openJitsiWindow(data.data.jitsi_room_id);
                break;
            case 'error':
                console.error('WebSocket error:', data.message);
                break;
        }
    };

    const sendMessage = (content) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'chat.message',
                content: content,
                message_type: 'text'
            }));
        }
    };

    const startJitsi = () => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'jitsi.start_session'
            }));
        }
    };

    return {
        messages,
        isTyping,
        sendMessage,
        startJitsi,
        ws: ws.current
    };
};

// Utilisation dans un composant
function ChatComponent({ conversationId }) {
    const { accessToken } = useAuth();
    const { messages, sendMessage, startJitsi } = useChatWebSocket(conversationId, accessToken);

    return (
        <div>
            <ChatMessages messages={messages} />
            <ChatInput onSend={sendMessage} />
            <button onClick={startJitsi}>Démarrer Appel Vidéo</button>
        </div>
    );
}
```

### Fonction pour Ouvrir Jitsi

```javascript
const openJitsiWindow = (roomId) => {
    window.open(
        `https://meet.jit.si/${roomId}`,
        'jitsi-window',
        'width=950,height=700'
    );
};
```

## 🛠️ Intégration Services Django

### Exemple : Créer une Conversation de Groupe

```python
from apps.chat.chat_utils import ChatService
from apps.members.models import Membership
from apps.core.models import Association

def create_discussion_group():
    # Récupérer l'association et les membres
    association = Association.objects.first()
    members = Membership.objects.filter(association=association)[:5]
    creator = members.first()

    # Créer la conversation
    conversation = ChatService.create_group_conversation(
        name="Groupe de Discussion",
        members_list=list(members),
        created_by=creator,
        association=association,
        description="Une belle discussion"
    )

    return conversation
```

### Exemple : Envoyer un Message Système

```python
from apps.chat.chat_utils import ChatService

def notify_session_started(session):
    # Récupérer la conversation liée à la séance
    conversation = session.conversations.first()
    
    if conversation:
        # Créer un message système
        message = ChatService.send_message(
            conversation=conversation,
            sender=None,  # Système
            content=f"La séance de {session.scheduled_date.strftime('%d/%m %Hh%M')} a commencé.",
            message_type='system'
        )
```

### Exemple : Signaux Django

```python
# apps/chat/signals.py
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.cycles.models import Session
from apps.chat.chat_utils import ChatService

@receiver(post_save, sender=Session)
def create_session_conversation(sender, instance, created, **kwargs):
    if created:
        # Auto-créer une conversation pour chaque nouvelle séance
        ChatService.create_session_conversation(instance, instance.association)
```

## 📊 Statistiques en Temps Réel

### Récupérer les Conversations Non Lues

```http
GET /api/v1/conversations/?unread=true HTTP/1.1
Authorization: Bearer <token>
```

Response:
```json
{
    "count": 3,
    "results": [
        {
            "id": "conv-1",
            "my_unread_count": 5
        },
        {
            "id": "conv-2",
            "my_unread_count": 2
        },
        {
            "id": "conv-3",
            "my_unread_count": 1
        }
    ]
}
```

## 🔐 Authentification WebSocket

### Via Token Query Parameter

```javascript
const token = localStorage.getItem('access_token');
const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/${conversationId}/?token=${token}`
);
```

### Via Authorization Header (mieux)

```javascript
// Nécessite une gestion client côté WebSocket
const token = localStorage.getItem('access_token');
const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/${conversationId}/`
);

ws.onopen = () => {
    // Envoyer le token dans le premier message
    ws.send(JSON.stringify({
        type: 'auth',
        token: token
    }));
};
```

## 🚀 Migration Données Existantes

Si vous aviez déjà des conversations, en migrer:

```python
# management/commands/migrate_chats.py
from django.core.management.base import BaseCommand
from apps.chat.models import Conversation
from apps.chat.chat_utils import ChatService

class Command(BaseCommand):
    def handle(self, *args, **options):
        # Logique de migration
        pass
```

## 📱 Mobile Considerations

- Les WebSocket persistent => gérer les reconnexions
- Limiter la bande passante => compresser les données
- Gérer les sessions JWT expirées => refresh automatique
- Gérer le mode offline => file d'attente locale

```javascript
// Reconnexion automatique
class ChatWebSocketClient {
    constructor(conversationId, accessToken) {
        this.conversationId = conversationId;
        this.accessToken = accessToken;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.connect();
    }

    connect() {
        // ... connexion ...
    }

    disconnect() {
        if (this.ws) this.ws.close();
    }

    onClose() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), this.reconnectDelay);
        }
    }
}
```
