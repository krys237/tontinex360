from rest_framework import serializers
from django.contrib.auth import authenticate
from apps.core.models import PhoneOtpUser, User, Association
###########################################################################################################

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'telephone', 'first_name', 'last_name',
            'email', 'password', 'password_confirm',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError(
                {'password_confirm': 'Les mots de passe ne correspondent pas.'}
            )
        if attrs.get('email') == '':
            attrs['email'] = None
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    telephone = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get('request'),
            telephone=attrs['telephone'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError('Identifiants invalides.')
        attrs['user'] = user
        return attrs


class ValidateOTPSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneOtpUser
        fields = ["telephone","otp"]

class SendOTPSerializer(serializers.ModelSerializer):
    class Meta:
        model = PhoneOtpUser
        fields = ["telephone"]

class ChangePasswordFogotSerializer(serializers.ModelSerializer):

    class Meta:
        model = User
        fields = ["telephone","password"]

class ChangedPasswordSerializer(serializers.ModelSerializer):
    old_password = serializers.CharField(read_only=True)
    new_password = serializers.CharField( read_only=True)

    class Meta:
        model = User
        fields = ["old_password","new_password","telephone"]


class UserSerializer(serializers.ModelSerializer):
    associations = serializers.SerializerMethodField()
    email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'telephone', 'first_name', 'last_name',
            'email', 'avatar', 'language', 'associations',
        ]
        read_only_fields = ['id', 'telephone', 'associations']

    def get_associations(self, obj):
        associations = obj.get_associations()
        return AssociationMinimalSerializer(associations, many=True).data

    def validate(self, attrs):
        if attrs.get('email') == '':
            attrs['email'] = None
        return attrs


class AssociationMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Association
        fields = ['id', 'name', 'slug', 'logo', 'city']


class AssociationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Association
        fields = [
            'id', 'name', 'slug', 'description', 'logo',
            'city', 'region', 'country', 'settings',
            'is_active', 'founded_date', 'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class AssociationUpdateSerializer(serializers.ModelSerializer):
    """Mise à jour d'une association. Le slug n'est pas modifiable."""
    class Meta:
        model = Association
        fields = [
            'name', 'description', 'logo',
            'city', 'region', 'country',
            'settings', 'founded_date', 'is_active',
        ]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom ne peut pas être vide.")
        return value


class AssociationCreateSerializer(serializers.Serializer):
    """Serializer pour la création d'association via le service."""
    name = serializers.CharField(max_length=255)
    slug = serializers.SlugField(max_length=100)
    description = serializers.CharField(required=False, default='')
    city = serializers.CharField(max_length=100, required=False, default='')
    region = serializers.CharField(max_length=100, required=False, default='')

    def validate_slug(self, value):
        if Association.objects.filter(slug=value).exists():
            raise serializers.ValidationError('Ce slug est déjà pris.')
        return value


class SelectAssociationSerializer(serializers.Serializer):
    """Sélection de l'association active."""
    slug = serializers.SlugField()

    def validate_slug(self, value):
        user = self.context['request'].user
        association = Association.objects.filter(slug=value, is_active=True).first()
        if not association:
            raise serializers.ValidationError("Association introuvable.")

        from apps.members.models import Membership
        if not Membership.all_objects.filter(
            user=user, association=association, is_active=True
        ).exists():
            raise serializers.ValidationError("Vous n'êtes pas membre de cette association.")

        self.context['association'] = association
        return value
