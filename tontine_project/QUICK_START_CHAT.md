# ⚡ Quick Start - Chat Tontine

## 🚀 Démarrage Rapide en 5 Minutes

### 1️⃣ Pré-requis

```bash
# Vérifier que Channels est installé
pip list | grep -i channels

# Résultat attendu:
# channels                    4.2.2
# channels-redis              4.2.1  (optionnel, pour prod)
# daphne                       4.2.1
```

### 2️⃣ Configuration Minimale

File: `.env`
```env
DEBUG=True
JITSI_SERVER=meet.jit.si
JITSI_APP_ID=tontine_app
# Le reste peut rester par défaut
```

### 3️⃣ Lancer le Serveur

**Terminal 1 - Django avec WebSocket:**
```bash
# Installer daphne si besoin
pip install daphne

# Lancer le serveur
daphne -b 0.0.0.0 -p 8000 config.asgi:application

# Résultat attendu:
# Daphne is starting...
# Starting server at http://0.0.0.0:8000/
```

**Terminal 2 - Redis (optionnel, pour production):**
```bash
# macOS
brew install redis
redis-server

# Linux
sudo apt install redis-server
redis-server

# Docker
docker run -d -p 6379:6379 redis:latest
```

### 4️⃣ Tester la Connexion

#### Option A: Via JavaScript Browser

Ouvrir la console du navigateur (F12) et exécuter:

```javascript
// 1. Récupérer un token JWT
const response = await fetch('/api/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        username: 'your_username',
        password: 'your_password'
    })
});
const { access } = await response.json();
const token = access;

// 2. Créer une connexion WebSocket
const conversationId = 'your-conversation-uuid';
const ws = new WebSocket(
    `ws://localhost:8000/ws/chat/${conversationId}/?token=${token}`
);

// 3. Gérer les événements
ws.onopen = () => console.log('✅ Connecté!');
ws.onmessage = (e) => {
    console.log('📨 Message reçu:', JSON.parse(e.data));
};
ws.onerror = (e) => console.error('❌ Erreur:', e);
ws.onclose = () => console.log('🔌 Déconnecté');

// 4. Envoyer un message
ws.send(JSON.stringify({
    type: 'chat.message',
    content: 'Hello World!',
    message_type: 'text'
}));
```

#### Option B: Via Python Script

File: `test_chat.py`
```python
import asyncio
import json
import os
import django
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken
from apps.core.models import User
from apps.chat.consumers import ChatConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()

async def test_chat():
    # Récupérer un utilisateur
    user = User.objects.first()
    
    # Générer un token
    token = str(AccessToken.for_user(user))
    
    # Récupérer une conversation
    from apps.chat.models import Conversation
    conversation = Conversation.objects.first()
    
    if not conversation:
        print("❌ Aucune conversation trouvée")
        return
    
    # Créer communicator
    communicator = WebsocketCommunicator(
        ChatConsumer.as_asgi(),
        f"ws/chat/{conversation.id}/?token={token}"
    )
    
    # Connecter
    connected, subprotocol = await communicator.connect()
    if not connected:
        print("❌ Connexion échouée")
        return
    
    print("✅ Connecté!")
    
    # Envoyer un message
    await communicator.send_json_to({
        'type': 'chat.message',
        'content': 'Test message',
        'message_type': 'text'
    })
    
    # Recevoir le message
    response = await communicator.receive_json_from()
    print(f"📨 Réponse: {response}")
    
    # Déconnecter
    await communicator.disconnect()
    print("🔌 Déconnecté")

# Lancer le test
if __name__ == '__main__':
    asyncio.run(test_chat())
```

Exécuter:
```bash
python test_chat.py
```

### 5️⃣ Tester Jitsi

Depuis la console JavaScript:

```javascript
// Démarrer une session Jitsi
ws.send(JSON.stringify({
    type: 'jitsi.start_session'
}));

// Écouter la réponse
ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'jitsi.session.started') {
        const jitsiUrl = data.data.message.content;
        console.log('🎥 Ouvrir Jitsi:', jitsiUrl);
        window.open(jitsiUrl, 'jitsi');
    }
};
```

## 📋 Checklist de Vérification

### Frontend WebSocket
- [ ] Connexion établie (`onopen` déclenché)
- [ ] Messages reçus (`onmessage` déclenché)  
- [ ] Pas d'errors (`onerror` pas déclenché)
- [ ] Déconnexion propre (`onclose` déclenché après)

### Backend
- [ ] Aucune erreur dans les logs
- [ ] Messages apparaissent en DB (`Message` table)
- [ ] Timestamps corrects dans les messages

### Jitsi
- [ ] URL générée correctement
- [ ] Jitsi Meet s'ouvre avec la room
- [ ] Participants peuvent se voir

## 🐛 Débogage Rapide

### Voir les logs en temps réel

**Terminal 3:**
```bash
# Activer DEBUG
export DEBUG=True

# Lancer avec logs
python manage.py runserver --verbosity 3
```

### Problème: "Unauthorized" error

```python
# Vérifier le token JWT
from rest_framework_simplejwt.tokens import AccessToken
token = 'votre_token_ici'
try:
    AccessToken(token)
    print("✅ Token valide")
except:
    print("❌ Token expiré ou invalide")
```

### Problème: "Conversation not found"

```python
# Vérifier que la conversation existe
from apps.chat.models import Conversation
print(Conversation.objects.all())
```

### Problème: "Forbidden" permission error

```python
# Vérifier que l'utilisateur a accès
from apps.chat.models import ConversationMember
from apps.members.models import Membership
from apps.core.models import User

user = User.objects.first()
membership = Membership.objects.filter(user=user).first()
conversation = Conversation.objects.first()

has_access = ConversationMember.objects.filter(
    conversation=conversation,
    membership=membership
).exists()

print(f"Accès: {'✅ Oui' if has_access else '❌ Non'}")
```

## 🧰 Outils Utiles

### 1. Tester WebSocket avec websocat

```bash
# Installer (macOS)
brew install websocat

# Installer (Linux)
cargo install --all-features websocat

# Se connecter
websocat 'ws://localhost:8000/ws/chat/conversation-id/?token=jwt-token'

# Envoyer un message (format JSON)
{"type":"chat.message","content":"Hello","message_type":"text"}
```

### 2. Monitorer Redis

```bash
redis-cli
> DBSIZE  # Nombre de clés
> KEYS *  # Lister les clés
> MONITOR # Surveiller les opérations
```

### 3. Checker les connections WebSocket

```bash
# macOS/Linux
lsof -i :8000
# ou
netstat -an | grep 8000

# Voir les connections WebSocket
ps aux | grep "daphne\|channels"
```

## 🚨 Erreurs Courantes et Solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `WebSocket is closed` | Authentification échouée | Vérifier le token JWT |
| `Could not connect` | Serveur pas démarré | Lancer `daphne` |
| `Room not found` | Conversation inexistante | Créer une conversation d'abord |
| `Forbidden` | Pas d'accès | Ajouter l'utilisateur à la conversation |
| `500 Internal Server Error` | Erreur serveur | Vérifier les logs |
| `Redis connection error` | Redis pas démarré | Lancer `redis-server` |

## 📱 Créer une Conversation de Test

```python
# Django shell
python manage.py shell

from apps.chat.models import Conversation, ConversationMember
from apps.members.models import Membership
from apps.core.models import Association

# Récupérer les données
assoc = Association.objects.first()
member1 = Membership.objects.first()
member2 = Membership.objects.last()

# Créer la conversation
conv = Conversation.objects.create(
    association=assoc,
    name="Test Conversation",
    conv_type="group",
    created_by=member1
)

# Ajouter les membres
ConversationMember.objects.create(
    conversation=conv,
    membership=member1,
    role="admin",
    association=assoc
)
ConversationMember.objects.create(
    conversation=conv,
    membership=member2,
    role="member",
    association=assoc
)

print(f"✅ Conversation créée: {conv.id}")
```

## 🎯 Prochaines Étapes

1. **Immédiat:**
   - [ ] Tester connexion WebSocket
   - [ ] Tester envoi de messages
   - [ ] Tester Jitsi

2. **Cette semaine:**
   - [ ] Intégrer dans React
   - [ ] Tester les notifications
   - [ ] Vérifier les permissions

3. **Production:**
   - [ ] Configurer Redis
   - [ ] Configurer HTTPS
   - [ ] Déployer

## 📞 Support

Pour les problèmes:
1. Vérifier les logs: `tail -f logs/django.log`
2. Tester manuellement selon le checklist
3. Vérifier la documentation: `CHAT_WEBSOCKET_CONFIG.md`
4. Consulter les exemples: `CHAT_API_EXAMPLES.md`

## ✅ C'est Prêt!

Votre système de chat WebSocket avec Jitsi est maintenant:
- ✅ Configuré
- ✅ Testable
- ✅ Fonctionnel
- ✅ Documenté

**Bonne chance avec votre application! 🎉**
