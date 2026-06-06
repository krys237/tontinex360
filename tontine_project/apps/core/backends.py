from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()


class TelephoneBackend(ModelBackend):
    """
    Authentification par telephone + mot de passe.
    L'utilisateur est GLOBAL — pas de verification de tenant.
    Le tenant est resolu par le middleware apres connexion.
    """

    def authenticate(self, request, telephone=None, password=None, **kwargs):
        if not telephone or not password:
            return None
        try:
            user = User.objects.get(telephone=telephone)
        except User.DoesNotExist:
            User().set_password(password)  # Timing attack mitigation
            return None

        if user.check_password(password) and user.is_active:
            return user
        return None
