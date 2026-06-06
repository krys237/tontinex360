"""
Utilitaires pour le service de chat.
Intégration du système de chat avec les autres entités de l'application.
"""
from django.db import transaction, models
from django.utils import timezone
from django.db.models import Q, F
from apps.chat.models import Conversation, ConversationMember, Message
from apps.members.models import Membership
from apps.cycles.models import Session
import logging

logger = logging.getLogger(__name__)


class ChatService:
    """Service de gestion des conversations et messages"""

    @staticmethod
    @transaction.atomic
    def send_message(conversation, sender, content, message_type='text', 
                     reply_to=None, attachments=None):
        """
        Envoyer un message dans une conversation.
        
        Args:
            conversation: Instance Conversation
            sender: Instance Membership (expéditeur)
            content: Contenu du message (str)
            message_type: Type de message (text, image, file, voice, system)
            reply_to: Message auquel répondre (optionnel)
            attachments: Liste des pièces jointes (optionnel)
        
        Returns:
            Instance Message créée
        """
        try:
            message = Message.objects.create(
                conversation=conversation,
                sender=sender,
                content=content,
                message_type=message_type,
                reply_to=reply_to,
                attachments=attachments or [],
                association=conversation.association,
            )

            # Mettre à jour les métadonnées de la conversation
            conversation.last_message_at = timezone.now()
            conversation.message_count = conversation.messages.count()
            conversation.save(update_fields=['last_message_at', 'message_count'])

            # Incrémenter les compteurs non lus pour tous les autres membres
            ChatService._increment_unread_count(conversation, sender)

            logger.info(f"Message sent in conversation {conversation.id} by {sender.user.id}")
            return message

        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            raise

    @staticmethod
    def _increment_unread_count(conversation, sender):
        """Incrémenter le compteur non-lu pour les autres membres"""
        try:
            ConversationMember.all_objects.filter(
                conversation=conversation
            ).exclude(
                membership=sender
            ).update(
                unread_count=F('unread_count') + 1
            )
        except Exception as e:
            logger.error(f"Error incrementing unread count: {str(e)}")

    @staticmethod
    @transaction.atomic
    def create_private_conversation(member1, member2, association):
        """
        Créer une conversation privée (1-à-1).
        
        Args:
            member1: Première instance Membership
            member2: Deuxième instance Membership
            association: Association propriétaire
        
        Returns:
            Instance Conversation
        """
        try:
            # Vérifier s'il existe déjà une conversation
            existing = Conversation.objects.filter(
                association=association,
                conv_type=Conversation.ConversationType.PRIVATE,
                members__membership__in=[member1, member2]
            ).annotate(
                member_count=models.Count('members')
            ).filter(member_count=2).first()

            if existing:
                return existing

            # Créer la conversation
            conversation = Conversation.objects.create(
                association=association,
                name=f"Conversation privée : {member1.user.first_name} & {member2.user.first_name}",
                conv_type=Conversation.ConversationType.PRIVATE,
                created_by=member1,
            )

            # Ajouter les deux membres
            ConversationMember.objects.bulk_create([
                ConversationMember(
                    conversation=conversation,
                    membership=member1,
                    role=ConversationMember.Role.MEMBER,
                    association=association,
                ),
                ConversationMember(
                    conversation=conversation,
                    membership=member2,
                    role=ConversationMember.Role.MEMBER,
                    association=association,
                ),
            ])

            logger.info(f"Private conversation created: {conversation.id}")
            return conversation

        except Exception as e:
            logger.error(f"Error creating private conversation: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def create_group_conversation(name, members_list, created_by, association, 
                                  description=''):
        """
        Créer une conversation de groupe.
        
        Args:
            name: Nom de la conversation
            members_list: Liste d'instances Membership
            created_by: Membership créateur
            association: Association propriétaire
            description: Description optionnelle
        
        Returns:
            Instance Conversation
        """
        try:
            conversation = Conversation.objects.create(
                association=association,
                name=name,
                conv_type=Conversation.ConversationType.GROUP,
                description=description,
                created_by=created_by,
            )

            # Ajouter le créateur comme admin
            ConversationMember.objects.create(
                conversation=conversation,
                membership=created_by,
                role=ConversationMember.Role.ADMIN,
                association=association,
            )

            # Ajouter les autres membres
            conv_members = []
            for member in members_list:
                if member.id != created_by.id:
                    conv_members.append(
                        ConversationMember(
                            conversation=conversation,
                            membership=member,
                            role=ConversationMember.Role.MEMBER,
                            association=association,
                        )
                    )

            ConversationMember.objects.bulk_create(conv_members)

            logger.info(f"Group conversation created: {conversation.id}")
            return conversation

        except Exception as e:
            logger.error(f"Error creating group conversation: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def create_session_conversation(session, association):
        """
        Créer une conversation liée à une séance.
        
        Args:
            session: Instance Session
            association: Association propriétaire
        
        Returns:
            Instance Conversation
        """
        try:
            conversation = Conversation.objects.create(
                association=association,
                name=f"Discussion : Séance {session.pk}",
                conv_type=Conversation.ConversationType.SESSION,
                description=f"Conversation pour la séance du {session.scheduled_date}",
                created_by=None,  # System created
                linked_session=session,
            )

            # Ajouter tous les participant de la séance
            members = Membership.objects.filter(association=association)
            conv_members = [
                ConversationMember(
                    conversation=conversation,
                    membership=member,
                    role=ConversationMember.Role.MEMBER,
                    association=association,
                )
                for member in members
            ]

            ConversationMember.objects.bulk_create(conv_members)

            logger.info(f"Session conversation created for session {session.id}: {conversation.id}")
            return conversation

        except Exception as e:
            logger.error(f"Error creating session conversation: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def create_general_conversation(association, name=None):
        """
        Créer une conversation générale pour toute l'association.
        
        Args:
            association: Association propriétaire
            name: Nom optionnel
        
        Returns:
            Instance Conversation
        """
        try:
            # Vérifier s'il existe déjà une conversation générale
            existing = Conversation.objects.filter(
                association=association,
                conv_type=Conversation.ConversationType.GENERAL
            ).first()

            if existing:
                return existing

            conversation = Conversation.objects.create(
                association=association,
                name=name or f"Discussion générale de {association.name}",
                conv_type=Conversation.ConversationType.GENERAL,
                description="Conversation générale pour toute l'association",
                created_by=None,
            )

            # Ajouter tous les membres
            members = Membership.objects.filter(association=association)
            conv_members = [
                ConversationMember(
                    conversation=conversation,
                    membership=member,
                    role=ConversationMember.Role.MEMBER,
                    association=association,
                )
                for member in members
            ]

            ConversationMember.objects.bulk_create(conv_members)

            logger.info(f"General conversation created for {association.name}: {conversation.id}")
            return conversation

        except Exception as e:
            logger.error(f"Error creating general conversation: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def add_members_to_conversation(conversation, members_list):
        """
        Ajouter des membres à une conversation.
        
        Args:
            conversation: Instance Conversation
            members_list: Liste d'instances Membership
        """
        try:
            # Récupérer les membres existants
            existing_members = set(
                ConversationMember.objects.filter(
                    conversation=conversation
                ).values_list('membership_id', flat=True)
            )

            # Ajouter seulement les nouveaux
            new_members = [
                m for m in members_list
                if m.id not in existing_members
            ]

            conv_members = [
                ConversationMember(
                    conversation=conversation,
                    membership=member,
                    role=ConversationMember.Role.MEMBER,
                    association=conversation.association,
                )
                for member in new_members
            ]

            ConversationMember.objects.bulk_create(conv_members)
            logger.info(f"Added {len(new_members)} members to conversation {conversation.id}")

        except Exception as e:
            logger.error(f"Error adding members to conversation: {str(e)}")
            raise

    @staticmethod
    @transaction.atomic
    def remove_member_from_conversation(conversation, membership):
        """
        Retirer un membre d'une conversation.
        
        Args:
            conversation: Instance Conversation
            membership: Instance Membership
        """
        try:
            ConversationMember.objects.filter(
                conversation=conversation,
                membership=membership
            ).delete()

            logger.info(f"Removed {membership.user.id} from conversation {conversation.id}")

        except Exception as e:
            logger.error(f"Error removing member from conversation: {str(e)}")
            raise

    @staticmethod
    def mark_conversation_as_read(conversation, membership):
        """
        Marquer une conversation comme entièrement lue.
        
        Args:
            conversation: Instance Conversation
            membership: Instance Membership
        """
        try:
            ConversationMember.objects.filter(
                conversation=conversation,
                membership=membership
            ).update(
                last_read_at=timezone.now(),
                unread_count=0
            )

            logger.info(f"Conversation {conversation.id} marked as read by {membership.user.id}")

        except Exception as e:
            logger.error(f"Error marking conversation as read: {str(e)}")
            raise

    @staticmethod
    def mute_conversation(conversation, membership, is_muted=True):
        """
        Mute/unmute une conversation pour un utilisateur.
        
        Args:
            conversation: Instance Conversation
            membership: Instance Membership
            is_muted: Boolean
        """
        try:
            ConversationMember.objects.filter(
                conversation=conversation,
                membership=membership
            ).update(is_muted=is_muted)

            logger.info(f"Conversation {conversation.id} {'muted' if is_muted else 'unmuted'} by {membership.user.id}")

        except Exception as e:
            logger.error(f"Error muting conversation: {str(e)}")
            raise

    @staticmethod
    def delete_message(message):
        """
        Soft delete un message.
        
        Args:
            message: Instance Message
        """
        try:
            message.is_deleted = True
            message.deleted_at = timezone.now()
            message.content = "[Message supprimé]"
            message.save()

            logger.info(f"Message {message.id} deleted")

        except Exception as e:
            logger.error(f"Error deleting message: {str(e)}")
            raise
