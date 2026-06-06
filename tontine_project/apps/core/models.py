import uuid
from django.contrib.auth.models import AbstractBaseUser, AbstractUser, PermissionsMixin
from django.db import models
from apps.core.managers import CustomUserManager
from common.models import TimeStampedModel


class User(AbstractBaseUser,PermissionsMixin):
    """
    Utilisateur GLOBAL — partage entre toutes les associations.
    La relation User <-> Association passe par Membership (app members).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    telephone = models.CharField(max_length=20, unique=True, db_index=True)
    email = models.EmailField(max_length=255,null=True)

    
    last_name = models.CharField(max_length=100,null=True,blank=True)
    first_name = models.CharField(max_length=100,null=True,blank=True)
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    language = models.CharField(max_length=5, default='fr')

    is_staff = models.BooleanField(default=False,null=True)
    is_active = models.BooleanField(default=False)
    is_admin = models.BooleanField(default=False,null=True)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = CustomUserManager()

    USERNAME_FIELD = 'telephone'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']

    def get_associations(self):
        """Toutes les associations actives de cet utilisateur."""
        return Association.objects.filter(
            membership_set__user=self,
            membership_set__is_active=True,
        )

    def get_membership_for(self, association):
        """Retourne le membership pour une association donnee."""
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            user=self, association=association, is_active=True,
        ).first()

    class Meta:
        db_table = 'users'

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.telephone})"

class PhoneOtpUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User,on_delete=models.CASCADE,null=True)
    telephone   = models.CharField(max_length=20,null=True,blank=True)
    otp     = models.CharField(max_length = 9, blank = True, null= True)
    count   = models.IntegerField(default = 0, help_text = 'Number of otp sent')
    logged  = models.BooleanField(default = False, help_text = 'If otp verification got successful')
    forgot  = models.BooleanField(default = False, help_text = 'only true for forgot password')
    forgot_logged = models.BooleanField(default = False, help_text = 'Only true if validdate otp forgot get successful')
    time_restart = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    active = models.BooleanField(default=True)


    def __str__(self):
        return self.telephone
    
    class Meta:
       ordering = ['-created_at']

class FCMToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
       User,
        on_delete=models.CASCADE,
        related_name="fcm_tokens"
    )
    token = models.TextField(unique=True)
    device_type = models.CharField(
        max_length=20,
        choices=(("android","Android"),("ios","iOS"),("web","Web"))
    )
    created_at = models.DateTimeField(auto_now_add=True)

class Association(TimeStampedModel):
    """
    Le TENANT — chaque association est un espace isole.
    Identifie par son slug unique (utilise pour le routing).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=100, db_index=True)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='associations/logos/', blank=True)

    city = models.CharField(max_length=100, blank=True)
    region = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default='Cameroun')

    settings = models.JSONField(default=dict, blank=True, help_text=(
        "Configuration flexible: currency, allow_multiple_names, "
        "max_names_per_member, session_reminder_hours, etc."
    ))

    is_active = models.BooleanField(default=True)
    founded_date = models.DateField(null=True, blank=True)

    created_by = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='associations_founded',
        help_text="Utilisateur qui a créé/fondé l'association.",
    )

    class Meta:
        db_table = 'associations'

    def __str__(self):
        return self.name
