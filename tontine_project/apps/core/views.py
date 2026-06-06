from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.generics import GenericAPIView,RetrieveAPIView
from rest_framework import exceptions, status, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes
from apps.core.models import FCMToken, PhoneOtpUser, User
from common.permissions import IsAuthenticated
from apps.core.serializers import (
    ChangePasswordFogotSerializer, ChangedPasswordSerializer, UserRegistrationSerializer, LoginSerializer, UserSerializer,
    AssociationSerializer, AssociationCreateSerializer, AssociationUpdateSerializer,
    SelectAssociationSerializer, ValidateOTPSerializer,
)
from apps.core.models import Association
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from apps.core.services import AssociationCreationService
from django.db import transaction
from django.contrib.auth.hashers import make_password
from django.contrib import auth
from apps.core.utils import sentOtp
################################################################################################################
class RegisterView(generics.CreateAPIView):
    """
    Inscription d'un nouvel utilisateur.

    Accepte un champ optionnel `otp_channel` (whatsapp / sms / email)
    pour choisir le canal d'envoi du code OTP. Par défaut : whatsapp.
    Si `otp_channel='email'`, l'email du compte fraichement créé est utilisé.
    """
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        otp_channel = (request.data.get('otp_channel') or 'whatsapp').lower()
        try:
            sentOtp(user.telephone, channel=otp_channel, email=user.email)
        except Exception as e:
            print("Error sending OTP:", e)
            return Response({
                'status': False,
                'error': "Échec de l'envoi de l'OTP. Réessayez plus tard."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'otp_channel': otp_channel,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """Connexion par téléphone + mot de passe."""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']

        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            },
        })


class ResendOTPView(APIView):
    """
    Renvoie un nouveau code OTP.

    Body :
        - telephone (required) : numéro du compte
        - channel (optional)   : 'whatsapp' (défaut) | 'sms' | 'email'
        - email (optional)     : si channel=email et que l'on souhaite un email
                                 différent de celui du compte
    """
    permission_classes = [AllowAny]

    def post(self, request):
        telephone = request.data.get('telephone')
        if not telephone:
            return Response(
                {'status': False, 'error': 'Le numéro de téléphone est requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not User.objects.filter(telephone=telephone).exists():
            return Response(
                {'status': False, 'error': "Aucun compte n'est associé à ce numéro."},
                status=status.HTTP_404_NOT_FOUND,
            )

        channel = (request.data.get('channel') or 'whatsapp').lower()
        email_override = request.data.get('email')

        try:
            result = sentOtp(telephone, channel=channel, email=email_override)
        except Exception as e:
            print("Error sending OTP:", e)
            return Response(
                {'status': False, 'error': "Échec de l'envoi de l'OTP. Réessayez plus tard."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        # sentOtp peut renvoyer une Response d'erreur (400 / 429 / 500)
        if isinstance(result, Response):
            return result

        return Response(
            {'status': True, 'channel': channel, 'message': 'OTP renvoyé.'},
            status=status.HTTP_200_OK,
        )


class MeView(generics.RetrieveUpdateAPIView):
    """Profil de l'utilisateur connecté."""
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user



class ValidateOTP(GenericAPIView):
    serializer_class = ValidateOTPSerializer

    @transaction.atomic
    def post(self, request, *args, **kwargs):
        telephone = request.data.get('telephone')
        otp_sent = request.data.get('otp')

        print("telephone",telephone)

        # Validation des données reçues
        if not telephone or not otp_sent:
            return Response({
                'status': False,
                'error': 'Phone number and OTP are required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Recherche du dernier OTP pour ce numéro de téléphone
        otp_record = PhoneOtpUser.objects.filter(telephone=telephone,otp = otp_sent).last()
        
        if not otp_record:
            return Response({
                'status': False,
                'error': 'Either otp or phone is not correct please check and retry.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Vérification de l'OTP
        if str(otp_record.otp) == str(otp_sent):
            otp_record.logged = True
            
            try:
                user = User.objects.get(telephone = telephone)
                user.is_active = True
                user.active = True
                user.save()
            except User.DoesNotExist:
                return Response({"status":False,"error":"this user does not exist"},status=status.HTTP_400_BAD_REQUEST) 
            
            otp_record.save()

            return Response({
                'status': True,
                'error': 'OTP matched. You can now go to the login and make the search.'
            }, status=status.HTTP_200_OK)

        return Response({
            'status': False,
            'error': 'Incorrect OTP. Please try again.'
        }, status=status.HTTP_400_BAD_REQUEST)


class ChangePasswordFogot(GenericAPIView):

    serializer_class = ChangePasswordFogotSerializer

    @transaction.atomic
    def post(self,request):
        data = request.data 
        password = data.get("password")
        telephone = data.get("telephone")

        try:
            user = User.objects.get(telephone = telephone) 
        except User.DoesNotExist:
            return Response({
                "status":False,
                "error":"this user or this phone no match with any user"
            }, status=status.HTTP_400_BAD_REQUEST)
        user.password = make_password(password) 
        user.save()
        return Response({"status":True,"message":"password has been changed succesful"},status=status.HTTP_202_ACCEPTED) 

class ChangedPassword(GenericAPIView):

    serializer_class = ChangedPasswordSerializer

    @transaction.atomic
    def post(self,request):
        data = request.data 
        password = data.get("old_password")
        new_password = data.get("new_password")
        telephone = data.get("telephone")

        account = auth.authenticate(telephone=telephone, password=password)
        
        print("account",account)
        
        if account is None:
            return Response({"status": False, "error": "this password is invalid please check and try latter."}, status=status.HTTP_401_UNAUTHORIZED)
        account.password = make_password(new_password)
        account.save()
        return Response({"status":True,"message":"password has been changed succesfully"},status=status.HTTP_202_ACCEPTED) 

class CreateAssociationView(APIView):
    """
    Création d'une association.
    Utilise le service pour orchestrer toute la création.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = AssociationCreateSerializer

    @transaction.atomic
    def post(self, request):
        serializer = AssociationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        association, membership, subscription = AssociationCreationService.create_association(
            user=request.user,
            name=data['name'],
            slug=data['slug'],
            description=data.get('description', ''),
            city=data.get('city', ''),
            region=data.get('region', ''),
        )

        # Activer automatiquement cette association dans la session
        request.session['active_association_slug'] = association.slug

        return Response({
            'association': AssociationSerializer(association).data,
            'membership_id': str(membership.id),
            'subscription_status': subscription.status,
            'trial_end': subscription.trial_end,
        }, status=status.HTTP_201_CREATED)


class UpdateAssociationView(APIView):
    """
    Récupération (GET) et mise à jour (PUT/PATCH) d'une association.

    - URL : /api/associations/<slug>/
    - Autorisé uniquement aux membres actifs ayant un rôle de bureau
      ou la permission `association.update` (ou wildcard).
    - Le slug n'est pas modifiable.
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    serializer_class = AssociationUpdateSerializer

    def _get_association(self, slug):
        try:
            return Association.objects.get(slug=slug)
        except Association.DoesNotExist:
            raise NotFound("Association introuvable.")

    def _check_can_update(self, user, association):
        from apps.members.models import Membership, MemberRole

        try:
            membership = Membership.all_objects.get(
                user=user, association=association, is_active=True,
            )
        except Membership.DoesNotExist:
            raise PermissionDenied("Vous n'êtes pas membre de cette association.")

        roles_qs = MemberRole.all_objects.filter(
            membership=membership, is_active=True,
        ).select_related('role')

        for member_role in roles_qs:
            role = member_role.role
            if role.is_bureau_role:
                return
            perms = role.permissions or []
            if '*' in perms or 'association.*' in perms or 'association.update' in perms:
                return

        raise PermissionDenied(
            "Seuls les membres du bureau peuvent modifier l'association."
        )

    def get(self, request, slug):
        association = self._get_association(slug)
        return Response(AssociationSerializer(association).data)

    @transaction.atomic
    def put(self, request, slug):
        return self._update(request, slug, partial=False)

    @transaction.atomic
    def patch(self, request, slug):
        return self._update(request, slug, partial=True)

    def _update(self, request, slug, partial):
        association = self._get_association(slug)
        self._check_can_update(request.user, association)

        serializer = AssociationUpdateSerializer(
            association, data=request.data, partial=partial,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(AssociationSerializer(association).data, status=status.HTTP_200_OK)


class SelectAssociationView(APIView):
    """Sélection de l'association active (switch de workspace)."""
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = SelectAssociationSerializer(
            data=request.data, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        association = serializer.context['association']
        request.session['active_association_slug'] = association.slug

        return Response({
            'active_association': AssociationSerializer(association).data,
        })


class MyAssociationsView(APIView):
    """Liste des associations de l'utilisateur connecté."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        associations = request.user.get_associations()
        return Response({
            'associations': AssociationSerializer(associations, many=True).data,
            'active_slug': request.session.get('active_association_slug'),
        })




@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_fcm_token(request):
    token = request.data.get("token")
    device_type = request.data.get("device_type")

    if not token:
        return Response({"error": "Token requis"}, status=400)

    FCMToken.objects.update_or_create(
        token=token,
        defaults={
            "user": request.user,
            "device_type": device_type
        }
    )

    return Response({"message": "Token enregistré"})

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    
