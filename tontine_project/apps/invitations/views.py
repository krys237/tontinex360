from rest_framework import status, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from apps.core.utils import send_message, send_push_notification
from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from common.exceptions import LimitExceededError
from apps.invitations.models import Invitation
from apps.invitations.serializers import (
    InvitationSerializer, InvitationCreateSerializer, AcceptInvitationSerializer,
)
from apps.invitations.services import InvitationService
from django.db import transaction

class InvitationViewSet(TenantViewMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Invitation.all_objects.select_related('invited_by__user', 'role')
    serializer_class = InvitationSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['status', 'channel']


class SendInvitationView(APIView):
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]

    @transaction.atomic
    def post(self, request):
        serializer = InvitationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        membership = request.user.get_membership_for(request.association)
        if not membership:
            return Response({'error': 'Membership introuvable.'}, status=403)

        role = None
        if data.get('role'):
            from apps.members.models import Role
            role = Role.all_objects.filter(
                id=data['role'], association=request.association,
            ).first()

        try:
            invitation = InvitationService.send_invitation(
                invited_by=membership,
                email=data.get('email', ''),
                phone=data.get('phone', ''),
                name=data.get('name', ''),
                role=role,
                channel=data.get('channel', 'link'),
                message=data.get('message', ''),
                auto_mark_fees_paid=bool(data.get('auto_mark_fees_paid', False)),
            )
            
            return Response(
                InvitationSerializer(invitation).data,
                status=status.HTTP_201_CREATED,
            )
        except PermissionError as e:
            return Response({'error': str(e)}, status=403)
        except LimitExceededError as e:
            return Response({'error': str(e)}, status=403)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


class AcceptInvitationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            invitation, membership = InvitationService.accept_invitation(
                token=serializer.validated_data['token'],
                user=request.user,
            )
            # Notifie l'invitateuret tous les membres de l'association (sauf le nouveau membre)
            try:
                from apps.notifications.services import NotificationService
                
                send_push_notification(
                    user=invitation.invited_by.user,
                    title='Nouveau membre',
                    body=(
                        f"{request.user.first_name} {request.user.last_name} "
                        f"a rejoint l'association {invitation.association.name}."
                    ),
                    data={'membership_id': str(membership.id)},
                )

                NotificationService.notify(
                    association=invitation.association,
                    recipient=invitation.invited_by,
                    notification_type='member_joined',
                    title='Nouveau membre',
                    body=(
                        f"{request.user.first_name} {request.user.last_name} "
                        f"a rejoint l'association."
                    ),
                    data={'membership_id': str(membership.id)},
                )
            except Exception:
                pass  # Notification non critique
            return Response({
                'message': f"Bienvenue dans {invitation.association.name} !",
                'association_slug': invitation.association.slug,
                'membership_id': str(membership.id),
            })
        except Invitation.DoesNotExist:
            return Response({'error': 'Invitation introuvable.'}, status=404)
        except ValueError as e:
            return Response({'error': str(e)}, status=400)


# ==========================================================================
# ONBOARDING INVITE — 3 endpoints pour le flux complet
# ==========================================================================

class CheckInvitationView(APIView):
    """
    Le frontend appelle cet endpoint quand l'invite clique sur le lien.
    Retourne les infos de l'invitation + si un compte existe deja.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        from apps.core.models import User

        try:
            invitation = Invitation.all_objects.get(token=token)
        except Invitation.DoesNotExist:
            return Response({'error': 'Invitation introuvable.'}, status=404)

        if not invitation.is_valid:
            return Response({
                'error': 'Invitation expiree ou deja utilisee.',
                'status': invitation.status,
            }, status=410)

        existing_user = None
        if invitation.email:
            existing_user = User.objects.filter(email=invitation.email).first()
        if not existing_user and invitation.phone:
            existing_user = User.objects.filter(telephone=invitation.phone).first()

        return Response({
            'invitation': {
                'token': invitation.token,
                'association_name': invitation.association.name,
                'association_logo': (
                    invitation.association.logo.url
                    if invitation.association.logo else None
                ),
                'invited_by': (
                    f"{invitation.invited_by.user.first_name} "
                    f"{invitation.invited_by.user.last_name}"
                ),
                'role_name': invitation.role.name if invitation.role else 'Membre',
                'message': invitation.message,
                'expires_at': invitation.expires_at,
            },
            'has_existing_account': existing_user is not None,
            'existing_telephone': (
                existing_user.telephone if existing_user else None
            ),
        })


class RegisterAndAcceptInvitationView(APIView):
    """
    Pour les invites qui N'ONT PAS de compte.
    Cree le compte + accepte l'invitation en une seule requete.
    """
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        from apps.core.serializers import UserRegistrationSerializer
        from rest_framework_simplejwt.tokens import RefreshToken

        token = request.data.get('token')
        if not token:
            return Response({'error': 'Token requis.'}, status=400)

        # 1. Creer le compte
        user_data = {
            'telephone': request.data.get('telephone', ''),
            'first_name': request.data.get('first_name', ''),
            'last_name': request.data.get('last_name', ''),
            'email': request.data.get('email', ''),
            'password': request.data.get('password'),
            'password_confirm': request.data.get('password_confirm'),
        }
        user_serializer = UserRegistrationSerializer(data=user_data)
        user_serializer.is_valid(raise_exception=True)
        user = user_serializer.save()

        # Le user est créé via un lien d'invitation valide (token déjà vérifié
        # plus loin) : on l'active immédiatement pour qu'il puisse se loguer.
        # Sans cela, is_active=False (défaut du modèle) et le login échoue.
        if not user.is_active:
            user.is_active = True
            user.save(update_fields=['is_active'])

        print(f"User {user} created for invitation acceptance.")

        # 2. Accepter l'invitation
        try:
            invitation, membership = InvitationService.accept_invitation(
                token=token, user=user,
            )
            print(f"Invitation accepted for user {user}.")
        except Exception as e:
            user.delete()
            return Response({'error': str(e)}, status=400)

        # 3. JWT
        refresh = RefreshToken.for_user(user)

        # 4. Notifier l'inviteur
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify(
                association=invitation.association,
                recipient=invitation.invited_by,
                notification_type='member_joined',
                title='Nouveau membre',
                body=(
                    f"{user.first_name} {user.last_name} "
                    f"a rejoint l'association."
                ),
                data={'membership_id': str(membership.id)},
            )
        except Exception:
            pass  # Notification non critique

        return Response({
            'user': {
                'id': str(user.id),
                'first_name': user.first_name,
                'last_name': user.last_name,
                'telephone': user.telephone,
            },
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'association': {
                'slug': invitation.association.slug,
                'name': invitation.association.name,
            },
            'redirect_to': f'/dashboard/{invitation.association.slug}/',
        }, status=status.HTTP_201_CREATED)


class LoginAndAcceptInvitationView(APIView):
    """
    Pour les invites qui ONT DEJA un compte.
    Se connecte + accepte l'invitation.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from django.contrib.auth import authenticate
        from rest_framework_simplejwt.tokens import RefreshToken

        token = request.data.get('token')
        telephone = request.data.get('telephone')
        password = request.data.get('password')

        if not all([token, telephone, password]):
            return Response(
                {'error': 'Token, telephone et mot de passe requis.'},
                status=400,
            )

        # 1. Authentifier
        user = authenticate(
            request=request, telephone=telephone, password=password,
        )
        if not user:
            return Response({'error': 'Identifiants invalides.'}, status=401)

        # 2. Accepter l'invitation
        try:
            invitation, membership = InvitationService.accept_invitation(
                token=token, user=user,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=400)

        # 3. JWT
        refresh = RefreshToken.for_user(user)

        # 4. Notifier
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify(
                association=invitation.association,
                recipient=invitation.invited_by,
                notification_type='member_joined',
                title='Nouveau membre',
                body=(
                    f"{user.first_name} {user.last_name} "
                    f"a rejoint l'association."
                ),
            )
        except Exception:
            pass

        return Response({
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
            'association': {
                'slug': invitation.association.slug,
                'name': invitation.association.name,
            },
            'redirect_to': f'/dashboard/{invitation.association.slug}/',
        })
