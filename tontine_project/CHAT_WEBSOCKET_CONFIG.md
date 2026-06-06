# Configuration et Utilisation du Chat WebSocket avec Jitsi

## 🔧 Configuration

### 1. Requirements Django

Les dépendances nécessaires sont déjà installées :
- `channels` >= 4.0 - WebSocket support
- `channels_redis` >= 4.0 - Channel layer avec Redis
- `daphne` >= 4.0 - ASGI server
- `PyJWT` >= 2.0 - Génération tokens JWT Jitsi

### 2. Settings Django (`config/settings/base.py`)

Déjà configuré avec :

```python
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer'  # Dev
        # Pour prod : 'channels_redis.core.RedisChannelLayer'
    }
}

JITSI_CONFIG = {
    'SERVER': 'meet.jit.si',  # ou votre serveur Jitsi
    'APP_ID': 'tontine_app',
    'API_KEY': os.environ.get('JITSI_API_KEY', ''),
    'API_SECRET': os.environ.get('JITSI_API_SECRET', ''),
    'ENABLE_AUTH': False,  # Activer pour authentification JWT
}
```

### 3. ASGI Configuration (`config/asgi.py`)

Le routing WebSocket est configuré pour :
- Authentification JWT par token
- Routing des conversations WebSocket
- Support des messages en temps réel

## 📨 Types de Messages WebSocket

### 1. **Messages Texte**

**Envoyer :**
```json
{
    "type": "chat.message",
    "content": "Bonjour à tous !",
    "message_type": "text",
    "reply_to": "uuid-du-message-optionnel",
    "attachments": []
}
```

**Réception :**
```json
{
    "type": "chat.message",
    "data": {
        "id": "uuid",
        "sender": "uuid",
        "sender_name": "Prénom Nom",
        "content": "Bonjour à tous !",
        "message_type": "text",
        "created_at": "2026-04-01T10:30:00Z"
    }
}
```

### 2. **Indicateur de Frappe (Typing)**

**Envoyer :**
```json
{
    "type": "chat.typing",
    "is_typing": true
}
```

**Réception :**
```json
{
    "type": "chat.typing",
    "data": {
        "user_id": "uuid",
        "user_name": "Prénom Nom",
        "is_typing": true
    }
}
```

### 3. **Messages Lus**

**Envoyer :**
```json
{
    "type": "chat.read",
    "message_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Réception :**
```json
{
    "type": "chat.messages.read",
    "data": {
        "user_id": "uuid",
        "message_ids": ["uuid1", "uuid2", "uuid3"]
    }
}
```

## 📹 Sessions Jitsi

### 1. **Démarrer une Session**

**Envoyer :**
```json
{
    "type": "jitsi.start_session"
}
```

**Réception :**
```json
{
    "type": "jitsi.session.started",
    "data": {
        "jitsi_room_id": "tontine_conv123_1234567890",
        "message": {
            "id": "uuid",
            "content": "{...}",
            "message_type": "system"
        }
    }
}
```

### 2. **Participant Rejoint**

**Envoyer :**
```json
{
    "type": "jitsi.participant_join",
    "jitsi_room_id": "tontine_conv123_1234567890",
    "participant_name": "Jean Dupont"
}
```

**Réception :**
```json
{
    "type": "jitsi.participant.joined",
    "data": {
        "jitsi_room_id": "tontine_conv123_1234567890",
        "user_id": "uuid",
        "participant_name": "Jean Dupont"
    }
}
```

### 3. **Participant Quitte**

**Envoyer :**
```json
{
    "type": "jitsi.participant_leave",
    "jitsi_room_id": "tontine_conv123_1234567890"
}
```

**Réception :**
```json
{
    "type": "jitsi.participant.left",
    "data": {
        "jitsi_room_id": "tontine_conv123_1234567890",
        "user_id": "uuid"
    }
}
```

### 4. **Terminer une Session**

**Envoyer :**
```json
{
    "type": "jitsi.end_session",
    "jitsi_room_id": "tontine_conv123_1234567890"
}
```

**Réception :**
```json
{
    "type": "jitsi.session.ended",
    "data": {
        "message": {
            "id": "uuid",
            "content": "{...}",
            "message_type": "system"
        }
    }
}
```

## 🌐 Connexion WebSocket

### Endpoint

```
ws://localhost:8000/ws/chat/<conversation_id>/?token=<jwt_token>
```

ou avec header Authorization :

```
ws://localhost:8000/ws/chat/<conversation_id>/
Authorization: Bearer <jwt_token>
```

### Exemple JavaScript

```javascript
// Récupérer le token JWT
const token = localStorage.getItem('access_token');

// Créer la connexion WebSocket
const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/conversation-uuid/?token=${token}`
);

// Évènement connexion
ws.onopen = (event) => {
    console.log('Connecté au chat');
};

// Recevoir les messages
ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'chat.message':
            console.log('Nouveau message:', message.data);
            break;
        case 'chat.typing':
            console.log('Quelqu\'un tape:', message.data.user_name);
            break;
        case 'jitsi.session.started':
            console.log('Session Jitsi commencée:', message.data.jitsi_room_id);
            break;
    }
};

// Erreurs
ws.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// Fermeture
ws.onclose = (event) => {
    console.log('Déconnecté du chat');
};

// Envoyer un message
function sendMessage(content) {
    const message = {
        type: 'chat.message',
        content: content,
        message_type: 'text'
    };
    ws.send(JSON.stringify(message));
}

// Démarrer Jitsi
function startJitsiSession() {
    const message = {
        type: 'jitsi.start_session'
    };
    ws.send(JSON.stringify(message));
}
```

## 🚀 Déploiement

### Développement (Django Development Server)

```bash
# Installer daphne
pip install daphne

# Lancer avec le channel layer InMemory
python manage.py runserver
```

### Production (avec Redis)

1. **Configurer Redis** :
```bash
# Installer Redis
brew install redis  # macOS
# ou
apt-get install redis-server  # Linux

# Lancer le serveur Redis
redis-server
```

2. **Configurer la channel layer** dans `settings/prod.py` :
```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],
        },
    }
}
```

3. **Lancer avec Daphne** :
```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

ou avec Gunicorn (WSGI only, pas de WebSocket) :
```bash
gunicorn config.wsgi:application --workers 4
```

## 🔐 Sécurité

### Types de Communication Supportées

1. **PRIVATE** (1-à-1) - Jitsi désactivé
2. **GROUP** - Jitsi enabled
3. **SESSION** (liée à une séance) - Jitsi enabled ✅
4. **BUREAU** - Discussion bureau
5. **GENERAL** - Toute l'association

### Authentification

- Tous les WebSockets utilisent JWT
- Token expire après 2 heures
- Utilisateurs doivent avoir accès à la conversation

### Permissions

- L'utilisateur doit être membre de la conversation
- Vérification du tenant (association)
- Vérification des rôles (admin/member)

## 📊 Modèle de Données

### Conversation
- **Type** : private, group, bureau, session, general
- **Participants** : Membres avec rôles (member, admin)
- **Messages** : Historique complet

### Message
- **Type** : text, image, file, voice, system
- **Reply** : Support des réponses imbriquées
- **Attachments** : Support des fichiers (JSON)

### ConversationMember
- **Role** : member ou admin
- **Unread Count** : Nombre de messages non lus
- **Last Read At** : Date de la dernière lecture

## 🛠️ Utilitaires Jitsi

### JitsiManager

```python
from apps.chat.jitsi_utils import JitsiManager

# Générer une URL Jitsi
url = JitsiManager.get_jitsi_url(
    room_id='tontine_conv123',
    user_id='user-uuid',
    user_name='Jean Dupont',
    email='jean@example.com'
)

# Générer un token JWT (si authentification activée)
token = JitsiManager.generate_jitsi_token(
    room_id='tontine_conv123',
    user_id='user-uuid',
    user_name='Jean Dupont'
)

# Créer les données de session
session_data = JitsiManager.create_jitsi_session_data(
    conversation_id='conv-uuid',
    user_id='user-uuid',
    user_name='Jean Dupont'
)
```

## 📝 Variables d'Environnement

```env
# Jitsi
JITSI_SERVER=meet.jit.si
JITSI_APP_ID=tontine_app
JITSI_API_KEY=votre_clé
JITSI_API_SECRET=votre_secret
JITSI_ENABLE_AUTH=false
JITSI_URL_PREFIX=https://meet.jit.si

# Redis (Production)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

## 🐛 Débogage

### Logs

```python
import logging

logger = logging.getLogger('apps.chat.consumers')

# Activer les logs DEBUG
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'apps.chat.consumers': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
```

### Common Issues

1. **WebSocket se ferme immédiatement**
   - Vérifier le token JWT
   - Vérifier que l'utilisateur a accès à la conversation
   - Vérifier les logs du serveur

2. **Messages non reçus**
   - Vérifier la channel layer (Redis/InMemory)
   - Vérifier que tous les clients sont dans le même groupe
   - Vérifier les permissions

3. **Jitsi ne fonctionne pas**
   - Vérifier la configuration Jitsi dans settings
   - Vérifier que le navigateur supporte WebRTC
   - Vérifier les cors settings

## 📚 Ressources

- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Jitsi Meet Documentation](https://jitsi.github.io/handbook/)
- [WebSocket JavaScript API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
