from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import (
    AbstractBaseUser, BaseUserManager, PermissionsMixin
)
from django.utils.translation import gettext_lazy as _
####################################################################################
class CustomUserManager(BaseUserManager):
    
    def create_user(self,telephone,password, **extra_fields):
                
        if not telephone:
            raise ValueError(_("please enter your number phone"))
        
        telephone = self.normalize_email(telephone)
        
        if telephone:
            user = self.model(telephone=telephone,**extra_fields)
            user.set_password(password)
            user.save()
        return user

    def create_superuser(self, telephone, email ,password, **extra_fields):

        extra_fields.setdefault('is_admin', True)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_admin') is not True:
            raise ValueError(_('Superuser must have is_admin=True.'))
        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))
        return self.create_user(telephone,password,**extra_fields)

#####################################################################################################################

