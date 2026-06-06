"""Development settings."""
from .base import *
from corsheaders.defaults import default_headers
from dotenv import load_dotenv

load_dotenv()

DEBUG = True
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get("POSTGRES_DB"),
        'USER': os.environ.get("POSTGRES_USER"),
        'PASSWORD': os.environ.get("POSTGRES_PASSWORD"),
        'HOST': os.environ.get("POSTGRES_HOST", "localhost"),
        'PORT': os.environ.get("POSTGRES_PORT", "5434"),
    }
}



# =============================================================================
# CORS — autorise le frontend Next.js (localhost:3000 + variantes)
# =============================================================================
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

# Headers customs autorisés (X-Tenant indispensable pour le multi-tenant)
CORS_ALLOW_HEADERS = list(default_headers) + [
    'x-tenant',
    'x-association-slug',  # rétrocompat si du vieux code l'envoie encore
]

# Méthodes autorisées
CORS_ALLOW_METHODS = [
    'DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT',
]

# Cache du preflight pour éviter les requêtes OPTIONS répétées
CORS_PREFLIGHT_MAX_AGE = 86400

# Dev tools
INSTALLED_APPS += ['django_extensions']
