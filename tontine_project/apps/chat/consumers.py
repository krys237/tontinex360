import json
import logging
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from apps.chat.models import Conversation, Message, ConversationMember
from apps.chat.serializers import MessageSerializer, ConversationSerializer
from apps.core.models import User
from apps.members.models import Membership

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer pour la gestion des conversations en temps réel.
    Supporte les messages texte, système, fichiers et sessions Jitsi.
    """

    async def connect(self):
        """Connexion WebSocket avec authentification JWT"""
        try:
            # Récupérer le token JWT depuis les headers
            self.user = await self._authenticate_user()
            
            if not self.user:
                await self.close(code=4001, reason="Unauthorized")
                return

            # Récupérer la conversation
            self.conversation_id = self.scope['url_route']['kwargs'].get('conversation_id')
            self.conversation = await self._get_conversation()

            if not self.conversation:
                await self.close(code=4004, reason="Conversation not found")
                return

            # Vérifier les permissions
            has_access = await self._check_access()
            if not has_access:
                await self.close(code=4403, reason="Forbidden")
                return

            # Définir le room name
            self.room_name = f"conversation_{self.conversation_id}"
            self.room_group_name = f"chat_{self.conversation_id}"

            # Ajouter le consommateur au groupe de conversation
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)

            # Accepter la connexion
            await self.accept()

            # Enregistrer l'utilisateur comme actif
            await self._mark_user_active()

            # Notifier les autres utilisateurs de la nouvelle connexion
            await self._notify_user_joined()

            logger.info(f"User {self.user.id} connected to conversation {self.conversation_id}")

        except Exception as e:
            logger.error(f"Connect error: {str(e)}")
            await self.close(code=4000, reason="Internal error")

    async def disconnect(self, close_code):
        """Déconnexion WebSocket"""
        try:
            # Notifier les autres utilisateurs de la déconnexion
            await self._notify_user_left()

            # Retirer du groupe
            if hasattr(self, 'room_group_name'):
                await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

            logger.info(f"User {self.user.id} disconnected from conversation {self.conversation_id}")
        except Exception as e:
            logger.error(f"Disconnect error: {str(e)}")

    async def receive(self, text_data):
        """Recevoir et traiter les messages WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            # Dispatcher selon le type de message
            if message_type == 'chat.message':
                await self._handle_text_message(data)
            elif message_type == 'chat.typing':
                await self._handle_typing_indicator(data)
            elif message_type == 'chat.read':
                await self._handle_message_read(data)
            elif message_type == 'jitsi.start_session':
                await self._handle_jitsi_start(data)
            elif message_type == 'jitsi.end_session':
                await self._handle_jitsi_end(data)
            elif message_type == 'jitsi.participant_join':
                await self._handle_jitsi_participant_join(data)
            elif message_type == 'jitsi.participant_leave':
                await self._handle_jitsi_participant_leave(data)
            else:
                await self.send_error(f"Unknown message type: {message_type}")

        except json.JSONDecodeError:
            await self.send_error("Invalid JSON")
        except Exception as e:
            logger.error(f"Receive error: {str(e)}")
            await self.send_error(f"Server error: {str(e)}")

    # =========================================================================
    # MESSAGES TEXTE
    # =========================================================================

    async def _handle_text_message(self, data):
        """Traiter les messages texte"""
        try:
            content = data.get('content', '').strip()
            message_type = data.get('message_type', 'text')  # text, image, file, voice
            reply_to_id = data.get('reply_to')
            attachments = data.get('attachments', [])

            if not content and not attachments:
                await self.send_error("Message cannot be empty")
                return

            # Créer le message
            message = await self._create_message(
                content=content,
                message_type=message_type,
                reply_to_id=reply_to_id,
                attachments=attachments
            )

            # Sérialiser le message
            message_data = await self._serialize_message(message)

            # Broadcast à tout le groupe
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat.message.broadcast',
                    'message': message_data,
                }
            )

            # Mettre à jour last_message_at de la conversation
            await self._update_conversation_last_message()

        except Exception as e:
            logger.error(f"Handle text message error: {str(e)}")
            await self.send_error(f"Failed to send message: {str(e)}")

    async def chat_message_broadcast(self, event):
        """Envoyer un message broadcast"""
        await self.send(text_data=json.dumps({
            'type': 'chat.message',
            'data': event['message'],
        }))

    # =========================================================================
    # INDICATEURS DE FRAPPE
    # =========================================================================

    async def _handle_typing_indicator(self, data):
        """Gérer l'indicateur de frappe (typing)"""
        try:
            is_typing = data.get('is_typing', False)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat.typing.broadcast',
                    'user_id': str(self.user.id),
                    'user_name': f"{self.user.first_name} {self.user.last_name}",
                    'is_typing': is_typing,
                }
            )
        except Exception as e:
            logger.error(f"Handle typing indicator error: {str(e)}")

    async def chat_typing_broadcast(self, event):
        """Envoyer l'indicateur de frappe"""
        await self.send(text_data=json.dumps({
            'type': 'chat.typing',
            'data': {
                'user_id': event['user_id'],
                'user_name': event['user_name'],
                'is_typing': event['is_typing'],
            },
        }))

    # =========================================================================
    # MESSAGES LUS
    # =========================================================================

    async def _handle_message_read(self, data):
        """Marquer les messages comme lus"""
        try:
            message_ids = data.get('message_ids', [])

            if message_ids:
                await self._mark_messages_as_read(message_ids)

                # Notifier les autres utilisateurs
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'chat.messages.read',
                        'user_id': str(self.user.id),
                        'message_ids': message_ids,
                    }
                )
        except Exception as e:
            logger.error(f"Handle message read error: {str(e)}")

    async def chat_messages_read(self, event):
        """Envoyer la notification de lecture"""
        await self.send(text_data=json.dumps({
            'type': 'chat.messages.read',
            'data': {
                'user_id': event['user_id'],
                'message_ids': event['message_ids'],
            },
        }))

    # =========================================================================
    # SESSIONS JITSI (Vidéoconférence)
    # =========================================================================

    async def _handle_jitsi_start(self, data):
        """Démarrer une session Jitsi"""
        try:
            if self.conversation.conv_type not in ['session', 'group']:
                await self.send_error("Jitsi sessions only available for session or group conversations")
                return

            # Créer un message système annonçant le démarrage
            jitsi_room_id = f"tontine_{self.conversation_id}_{timezone.now().timestamp()}"
            
            message = await self._create_message(
                content=json.dumps({
                    'jitsi_room_id': jitsi_room_id,
                    'started_by': str(self.user.id),
                    'started_by_name': f"{self.user.first_name} {self.user.last_name}",
                }),
                message_type='system',
            )

            message_data = await self._serialize_message(message)

            # Broadcast à tout le groupe
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'jitsi.session.started',
                    'jitsi_room_id': jitsi_room_id,
                    'message': message_data,
                }
            )

        except Exception as e:
            logger.error(f"Handle Jitsi start error: {str(e)}")
            await self.send_error(f"Failed to start Jitsi session: {str(e)}")

    async def jitsi_session_started(self, event):
        """Envoyer la notification de démarrage Jitsi"""
        await self.send(text_data=json.dumps({
            'type': 'jitsi.session.started',
            'data': {
                'jitsi_room_id': event['jitsi_room_id'],
                'message': event['message'],
            },
        }))

    async def _handle_jitsi_end(self, data):
        """Terminer une session Jitsi"""
        try:
            jitsi_room_id = data.get('jitsi_room_id')

            # Créer un message système annonçant la fin
            message = await self._create_message(
                content=json.dumps({
                    'jitsi_room_id': jitsi_room_id,
                    'ended_by': str(self.user.id),
                    'ended_by_name': f"{self.user.first_name} {self.user.last_name}",
                }),
                message_type='system',
            )

            message_data = await self._serialize_message(message)

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'jitsi.session.ended',
                    'message': message_data,
                }
            )

        except Exception as e:
            logger.error(f"Handle Jitsi end error: {str(e)}")
            await self.send_error(f"Failed to end Jitsi session: {str(e)}")

    async def jitsi_session_ended(self, event):
        """Envoyer la notification de fin Jitsi"""
        await self.send(text_data=json.dumps({
            'type': 'jitsi.session.ended',
            'data': event['message'],
        }))

    async def _handle_jitsi_participant_join(self, data):
        """Un participant rejoint la session Jitsi"""
        try:
            jitsi_room_id = data.get('jitsi_room_id')
            participant_name = data.get('participant_name')

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'jitsi.participant.joined',
                    'jitsi_room_id': jitsi_room_id,
                    'user_id': str(self.user.id),
                    'participant_name': participant_name,
                }
            )
        except Exception as e:
            logger.error(f"Handle Jitsi participant join error: {str(e)}")

    async def jitsi_participant_joined(self, event):
        """Notifier que un participant a rejoint"""
        await self.send(text_data=json.dumps({
            'type': 'jitsi.participant.joined',
            'data': {
                'jitsi_room_id': event['jitsi_room_id'],
                'user_id': event['user_id'],
                'participant_name': event['participant_name'],
            },
        }))

    async def _handle_jitsi_participant_leave(self, data):
        """Un participant quitte la session Jitsi"""
        try:
            jitsi_room_id = data.get('jitsi_room_id')

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'jitsi.participant.left',
                    'jitsi_room_id': jitsi_room_id,
                    'user_id': str(self.user.id),
                }
            )
        except Exception as e:
            logger.error(f"Handle Jitsi participant leave error: {str(e)}")

    async def jitsi_participant_left(self, event):
        """Notifier que un participant a quitté"""
        await self.send(text_data=json.dumps({
            'type': 'jitsi.participant.left',
            'data': {
                'jitsi_room_id': event['jitsi_room_id'],
                'user_id': event['user_id'],
            },
        }))

    # =========================================================================
    # UTILITAIRES
    # =========================================================================

    async def send_error(self, error_message):
        """Envoyer un message d'erreur"""
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': error_message,
        }))

    @database_sync_to_async
    def _authenticate_user(self):
        """Authentifier l'utilisateur via JWT"""
        try:
            token = None
            headers = dict(self.scope.get("headers", []))
            
            # Essayer d'obtenir le token depuis les headers
            auth_header = headers.get(b"authorization", b"").decode()
            if auth_header.startswith("Bearer "):
                token = auth_header[7:]
            
            # Sinon, essayer depuis les query parameters
            if not token:
                query_params = self.scope.get("query_string", b"").decode().split("&")
                for param in query_params:
                    if param.startswith("token="):
                        token = param.split("=", 1)[1]
                        break

            if not token:
                return None

            # Valider le token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            return User.objects.get(id=user_id)

        except (InvalidToken, TokenError, User.DoesNotExist) as e:
            logger.warning(f"Authentication failed: {str(e)}")
            return None

    @database_sync_to_async
    def _get_conversation(self):
        """Obtenir la conversation"""
        try:
            return Conversation.all_objects.prefetch_related(
                'members__membership__user'
            ).get(id=self.conversation_id)
        except Conversation.DoesNotExist:
            return None

    @database_sync_to_async
    def _check_access(self):
        """Vérifier que l'utilisateur a accès à la conversation"""
        try:
            membership = Membership.objects.get(
                association=self.conversation.association,
                user=self.user,
            )
            return ConversationMember.objects.filter(
                conversation=self.conversation,
                membership=membership,
            ).exists()
        except Membership.DoesNotExist:
            return False

    @database_sync_to_async
    def _create_message(self, content, message_type='text', reply_to_id=None, attachments=None):
        """Créer un message"""
        membership = Membership.objects.get(
            association=self.conversation.association,
            user=self.user,
        )
        
        reply_to = None
        if reply_to_id:
            try:
                reply_to = Message.all_objects.get(id=reply_to_id)
            except Message.DoesNotExist:
                pass

        message = Message.objects.create(
            conversation=self.conversation,
            sender=membership,
            content=content,
            message_type=message_type,
            reply_to=reply_to,
            attachments=attachments or [],
            association=self.conversation.association,
        )
        return message

    @database_sync_to_async
    def _serialize_message(self, message):
        """Sérialiser un message"""
        serializer = MessageSerializer(message)
        return serializer.data

    @database_sync_to_async
    def _mark_user_active(self):
        """Marquer l'utilisateur comme actif"""
        try:
            membership = Membership.objects.get(
                association=self.conversation.association,
                user=self.user,
            )
            conv_member = ConversationMember.objects.get(
                conversation=self.conversation,
                membership=membership,
            )
            conv_member.last_read_at = timezone.now()
            conv_member.unread_count = 0
            conv_member.save()
        except (Membership.DoesNotExist, ConversationMember.DoesNotExist):
            pass

    @database_sync_to_async
    def _mark_messages_as_read(self, message_ids):
        """Marquer les messages comme lus"""
        try:
            membership = Membership.objects.get(
                association=self.conversation.association,
                user=self.user,
            )
            conv_member = ConversationMember.objects.get(
                conversation=self.conversation,
                membership=membership,
            )
            conv_member.last_read_at = timezone.now()
            conv_member.unread_count = max(0, conv_member.unread_count - len(message_ids))
            conv_member.save()
        except (Membership.DoesNotExist, ConversationMember.DoesNotExist):
            pass

    @database_sync_to_async
    def _update_conversation_last_message(self):
        """Mettre à jour la date du dernier message de la conversation"""
        self.conversation.last_message_at = timezone.now()
        self.conversation.message_count = self.conversation.messages.count()
        self.conversation.save()

    @database_sync_to_async
    def _notify_user_joined(self):
        """Créer un message système utilisateur rejoint"""
        membership = Membership.objects.get(
            association=self.conversation.association,
            user=self.user,
        )
        Message.objects.create(
            conversation=self.conversation,
            sender=membership,
            content=f"{self.user.first_name} {self.user.last_name} a rejoint la conversation",
            message_type='system',
            association=self.conversation.association,
        )

    @database_sync_to_async
    def _notify_user_left(self):
        """Créer un message système utilisateur parti"""
        membership = Membership.objects.get(
            association=self.conversation.association,
            user=self.user,
        )
        Message.objects.create(
            conversation=self.conversation,
            sender=membership,
            content=f"{self.user.first_name} {self.user.last_name} a quitté la conversation",
            message_type='system',
            association=self.conversation.association,
        )
    
    def fetch_messages(self, data):
        try:
            read_user_message(self, data)
            print("hello",data)
            messages = Message.objects.filter(idchat=self.room_name).order_by("created_at")        
            content = {
            'command': 'messages',
            'messages': self.messages_to_json(messages)
            }
            print("last message:",content["messages"])
            self.send_message(content)
        except Exception as e:
            logger.warning('Begin Function fetch_messages in consumer crashed with error ')
            logger.warning('Function fetch_messages in consumer crashed with error ' + str(e))
            logger.warning('End Function fetch_messages in consumer crashed with error ')
            pass
    
    def fetch_messages_group(self, data):
        try:
            read_user_message(self, data)
            print("hello",data)
            messages = GroupMessage.objects.filter(idchat=self.room_name).order_by("created_at")        
            
            content = {
            'command': 'messages',
            'messages': self.messages_to_json(messages)
            }
            print("groupe message:",content["messages"])
            self.send_message(content)
        except Exception as e:
            logger.warning('Begin Function fetch_messages in consumer crashed with error ')
            logger.warning('Function fetch_messages in consumer crashed with error ' + str(e))
            logger.warning('End Function fetch_messages in consumer crashed with error ')
            pass

        
    def new_message(self, data):
        
        auteur_id = data["auteur"]
        destinataire_id = data.get("destinataire",None)
        
        if auteur_id != None and destinataire_id != None:
            auteur = ProfilTalker.objects.get(pk=int(auteur_id))
            destinataire = ProfilTalker.objects.get(pk=int(destinataire_id))
            
            message_exist = Message.objects.filter((Q(auteur=auteur) | Q(destinataire=auteur)) & (Q(auteur=destinataire) | Q(destinataire=destinataire))).first()
            
            if message_exist  is not None:
                message_exist.last_messages()
                
                message = Message.objects.create(
                    auteur = auteur,
                    destinataire = destinataire,
                    idchat = self.room_name,
                    contenu = data['message']
                )

                medias = data["image"]
                if len(medias) > 0:
                    for img in medias:
                        try:
                            media = Media.objects.get(id = img)
                        except medias.DoesNotExist:
                            media = None
                        if media is not None:
                            message.image.add(media)


                content = {
                    'command':'new_message',
                    'message':self.message_to_json(message)
                }
                
                print("messagerie:",content)
                return self.send_chat_message(content)
            
            elif message_exist == None:            
                message = Message.objects.create(
                    auteur = auteur,
                    destinataire = destinataire,
                    idchat = self.room_name,
                    contenu = data['message'],        
                )
                medias = data["image"]
                if len(medias) > 0:
                    for img in medias:
                        try:
                            media = Media.objects.get(id = img)
                        except medias.DoesNotExist:
                            media = None
                        if media is not None:
                            message.image.add(media)
        
        else :
            auteur = ProfilTalker.objects.get(pk=int(auteur_id))
            message_exist = Message.objects.filter(idchat =self.room_name).first()
            if message_exist  is not None:
                message_exist.last_messages()
                message = Message.objects.create(
                    group = MessageGroup.objects.get(id = data.get("group")),
                    auteur = auteur,
                    idchat = self.room_name,
                    contenu = data['message'],
                )
                medias = data["image"]
                if len(medias) > 0:
                    for img in medias:
                        try:
                            media = Media.objects.get(id = img)
                        except medias.DoesNotExist:
                            media = None
                        if media is not None:
                            message.image.add(media)

                content = {
                    'command':'new_message',
                    'message':self.message_to_json(message)
                }
                
                print("messagerie:",content)
                return self.send_chat_message(content)
            
            elif message_exist == None:
                message = Message.objects.create(
                    group = MessageGroup.objects.get(id = data.get("group")),
                    auteur = auteur,
                    idchat = self.room_name,
                    contenu = data['message'],
                )
                medias = data["image"]
                if len(medias) > 0:
                    for img in medias:
                        try:
                            media = Media.objects.get(id = img)
                        except medias.DoesNotExist:
                            media = None
                        if media is not None:
                            message.image.add(media)
        content = {
            'command':'new_message',
            'message':self.message_to_json(message)
        }

            #print("message:",content)            
        return self.send_chat_message(content)
        
    def read_message(self, data):
        try:
            content = {
                'command':'read_message',
                'message': "lu"
            }
        
            return self.send_chat_message(content)
        except Exception as e:
            logger.warning('Begin Function read_message in consumer crashed with error ')
            logger.warning('Function read_message in consumer crashed with error ', str(e))
            logger.warning('End Function read_message in consumer crashed with error ')
            pass
    
    def connect(self):
        try:
            self.room_name = self.scope['url_route']['kwargs']['room_name']
            self.room_group_name = 'chat_%s' % self.room_name
            # Join room group
            print('chat consumer')
            async_to_sync(self.channel_layer.group_add)(
                self.room_group_name,
                self.channel_name
            )

            self.accept()
        except Exception as e:
            logger.warning('Begin Function connect in consumer crashed with error ')
            logger.warning('Function connect in consumer crashed with error ', str(e))
            logger.warning('End Function connect in consumer crashed with error ')
            pass

    def disconnect(self, close_code):
        try:
            # Leave room group
            async_to_sync(self.channel_layer.group_discard)(
                self.room_group_name,
                self.channel_name
            )
        except Exception as e:
            logger.warning('Begin Function disconnect in consumer crashed with error ')
            logger.warning('Function disconnect in consumer crashed with error ', str(e))
            logger.warning('End Function disconnect in consumer crashed with error ')
            pass
        
    
    commands =  {
            'fetch_messages':fetch_messages,
            'fetch_messages_group':fetch_messages_group,
            'new_message': new_message,
            'read_message': read_message
        }
    
    # Receive message from WebSocket
    def receive(self, text_data):
        try:
            data = json.loads(text_data)
            print("test",data)
            self.commands[data['command']](self, data)
        except Exception as e:
            logger.warning('Begin Function receive in consumer crashed with error ')
            logger.warning('Function receive in consumer crashed with error ', str(e))
            logger.warning('End Function receive in consumer crashed with error ')
            pass
    
    def send_message(self,message):
        try:
            #send notification to user who receive message 
            self.send(text_data=json.dumps(message))
        except Exception as e:
            logger.warning('Begin Function send_message in consumer crashed with error ')
            logger.warning('Function send_message in consumer crashed with error ', str(e))
            logger.warning('End Function send_message in consumer crashed with error ')
            pass
        
    def send_chat_message(self, message):
        try:
            async_to_sync(self.channel_layer.group_send)(
            self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message 
                }
            )
        except Exception as e:
            logger.warning('Begin Function send_chat_message in consumer crashed with error ')
            logger.warning('Function send_chat_message in consumer crashed with error ', str(e))
            logger.warning('End Function send_chat_message in consumer crashed with error ')
            pass

    # Receive message from room group
    def chat_message(self, event):
        try:
            message = event['message']
        
            # Send message to WebSocket
            self.send(text_data=json.dumps({
                'message': message
            }))
        except Exception as e:
            logger.warning('Begin Function chat_message in consumer crashed with error ')
            logger.warning('Function chat_message in consumer crashed with error ', str(e))
            logger.warning('End Function chat_message in consumer crashed with error ')
            pass
        
        
    def message_to_json(self, message):
        try:
            image = MediaSerializer(message.image.all(), many = True)
            groupe = MessageGroupSerializer(message.group)
            
            if message.group != None:
                return {
                    'group': groupe.data,
                    'auteur': message.auteur.nom,
                    'contenu': message.contenu,
                    'idchat': message.idchat,
                    'timestamp': formats.date_format(message.created_at, "SHORT_DATETIME_FORMAT"),
                    'date': formats.date_format(message.created_at, 'd/m/Y'),
                    'heure': formats.date_format(message.created_at, "TIME_FORMAT"),
                    'image' : image.data
                }
            return {
                    'group': message.group,
                    'auteur': message.auteur.nom,
                    'contenu': message.contenu,
                    'idchat': message.idchat,
                    'timestamp': formats.date_format(message.created_at, "SHORT_DATETIME_FORMAT"),
                    'date': formats.date_format(message.created_at, 'd/m/Y'),
                    'heure': formats.date_format(message.created_at, "TIME_FORMAT"),
                    'image' : image.data
                }
                    
        except Exception as e:
            logger.warning('Begin Function message_to_json in consumer crashed with error ')
            logger.warning('Function message_to_json in consumer crashed with error ', str(e))
            logger.warning('End Function message_to_json in consumer crashed with error ')
            pass
        
    def messages_to_json(self,messages):
        try:
            result = []
            for message in messages:
                # print('message')
                result.append(self.message_to_json(message))
            return result
        except Exception as e:
            logger.warning('Begin Function messages_to_json in consumer crashed with error ')
            logger.warning('Function messages_to_json in consumer crashed with error ', str(e))
            logger.warning('End Function messages_to_json in consumer crashed with error ')
            pass
    
def read_user_message(self, data):
    try:
        result = False
        idchat = self.room_name
        
        try:
            user = ProfilTalker.objects.get(pk=int(data['user']))
        except ProfilTalker.DoesNotExist:
            user = None

        if user:
            Message.objects.filter(idchat=idchat, destinataire=user).update(is_read=True)
            result = True
               
        return result
    except Exception as e:
        logger.warning('Begin Function read_user_message in consumer crashed with error ')
        logger.warning('Function read_user_message in consumer crashed with error ', str(e))
        logger.warning('End Function read_user_message in consumer crashed with error ')
        pass
