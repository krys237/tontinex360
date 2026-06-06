from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.chat.models import Conversation, Message
from apps.chat.serializers import (
    ConversationSerializer, MessageSerializer,
    CreatePrivateConversationSerializer, CreateGroupConversationSerializer,
    SendMessageSerializer,
)
from apps.chat.services import ChatService


def _is_president_or_bureau(user, association):
    """
    True si l'utilisateur est président OU détient un rôle marqué
    `is_bureau_role=True` (donc désigné par le bureau / le président).
    Les rôles bureau sont attribués via le module élections ou la fonction
    `member.designate_bureau` du framework d'approbations — c'est cela qui
    matérialise la « désignation par le président ».
    """
    from apps.members.models import Membership, MemberRole, BureauMember
    membership = Membership.all_objects.filter(
        association=association, user=user, is_active=True,
    ).first()
    if not membership:
        return False
    # Président = fondateur OU position bureau slug='president'
    if membership.is_founder:
        return True
    has_president_position = BureauMember.all_objects.filter(
        membership=membership, is_active=True,
        position__slug='president',
    ).exists()
    if has_president_position:
        return True
    # Désigné par le président : porte un rôle bureau actif
    has_bureau_role = MemberRole.all_objects.filter(
        membership=membership, is_active=True,
        role__is_bureau_role=True,
    ).exists()
    return has_bureau_role


class ConversationViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Conversation.all_objects.prefetch_related('members__membership__user')
    serializer_class = ConversationSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def get_queryset(self):
        qs = super().get_queryset()
        membership = self._get_membership()
        if membership:
            return qs.filter(members__membership=membership)
        return qs.none()

    @action(detail=True, methods=['get'])
    def messages(self, request, pk=None):
        conv = self.get_object()
        messages = conv.messages.select_related('sender__user', 'reply_to').order_by('-created_at')[:50]
        return Response(MessageSerializer(messages[::-1], many=True).data)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        conv = self.get_object()
        membership = self._get_membership()
        serializer = SendMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        reply_to = None
        if d.get('reply_to'):
            reply_to = Message.all_objects.filter(id=d['reply_to'], conversation=conv).first()

        msg = ChatService.send_message(
            conversation=conv, sender=membership,
            content=d['content'], message_type=d.get('message_type', 'text'),
            reply_to=reply_to, attachments=d.get('attachments'),
        )
        return Response(MessageSerializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def read(self, request, pk=None):
        conv = self.get_object()
        membership = self._get_membership()
        ChatService.mark_conversation_read(conv, membership)
        return Response({'status': 'ok'})


class CreatePrivateConversationView(APIView):
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request):
        serializer = CreatePrivateConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from apps.members.models import Membership
        me = request.user.get_membership_for(request.association)
        other = Membership.all_objects.filter(
            id=serializer.validated_data['member_id'],
            association=request.association, is_active=True,
        ).first()
        if not other:
            return Response({'error': 'Membre introuvable.'}, status=404)

        conv = ChatService.create_private_conversation(me, other)
        return Response(ConversationSerializer(conv, context={'membership': me}).data)


class CreateGroupConversationView(APIView):
    """
    Création d'un groupe : réservée au président et aux membres détenant
    un rôle bureau (que le président peut attribuer/révoquer).
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request):
        if not _is_president_or_bureau(request.user, request.association):
            return Response(
                {'error': "Création de groupe réservée au président et aux "
                          "membres du bureau désignés."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CreateGroupConversationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        me = request.user.get_membership_for(request.association)
        conv = ChatService.create_group_conversation(
            creator=me, name=d['name'],
            member_ids=d['member_ids'], description=d.get('description', ''),
        )
        return Response(ConversationSerializer(conv, context={'membership': me}).data,
                        status=status.HTTP_201_CREATED)


class GeneralConversationView(APIView):
    """
    Récupère ou crée l'unique canal général de l'association (lu par tous
    les membres). Création réservée au président et au bureau désigné ;
    si le canal existe déjà, n'importe quel membre peut le récupérer
    (les non-bureau ne peuvent que lire/écrire dedans).
    """
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    def post(self, request):
        me = request.user.get_membership_for(request.association)
        if not me:
            return Response({'error': 'Membership introuvable.'}, status=403)

        # Si le canal existe déjà, tout le monde peut y accéder
        existing = Conversation.all_objects.filter(
            association=request.association,
            conv_type=Conversation.ConversationType.GENERAL,
        ).first()
        if existing is None and not _is_president_or_bureau(request.user, request.association):
            return Response(
                {'error': "Seuls le président ou un membre du bureau peuvent "
                          "ouvrir le canal général de l'association."},
                status=status.HTTP_403_FORBIDDEN,
            )

        conv = ChatService.get_or_create_general_conversation(me)
        return Response(ConversationSerializer(conv, context={'membership': me}).data)
