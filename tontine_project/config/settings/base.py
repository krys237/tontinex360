"""
Base settings for Tontine Project.
Shared across dev and prod.
"""
import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'change-me-in-production')

# =============================================================================
# APPS
# =============================================================================

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party
    'rest_framework',
    'corsheaders',
    'django_filters',
    'drf_yasg',
    'storages',
    'channels',

    # Project apps
    'apps.core',
    'apps.members',
    'apps.tontines',
    'apps.cycles',
    'apps.finance',
    'apps.governance',
    'apps.sanctions',
    'apps.events',
    'apps.subscriptions',
    'apps.invitations',
    'apps.notifications',
    'apps.chat',
    'apps.wallets',
    'apps.proxies',
    'apps.approvals',
]

# =============================================================================
# MIDDLEWARE
# =============================================================================

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # Tenant resolution + subscription check
    'common.middleware.TenantMiddleware',
    'common.middleware.SubscriptionMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# =============================================================================
# AUTH
# =============================================================================

AUTH_USER_MODEL = 'core.User'

AUTHENTICATION_BACKENDS = [
    'apps.core.backends.TelephoneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# =============================================================================
# URLS
# =============================================================================

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

# =============================================================================
# TEMPLATES
# =============================================================================

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# =============================================================================
# PASSWORD VALIDATION
# =============================================================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# =============================================================================
# INTERNATIONALIZATION
# =============================================================================

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Douala'
USE_I18N = True
USE_TZ = True

# =============================================================================
# STATIC & MEDIA
# =============================================================================

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# =============================================================================
# REST FRAMEWORK
# =============================================================================

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
}

# =============================================================================
# JWT
# =============================================================================

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# =============================================================================
# PROJECT CONFIG
# =============================================================================

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

# =============================================================================
# CHANNELS - WebSocket Configuration
# =============================================================================

ASGI_APPLICATION = 'config.asgi.application'

# Channel layer : Redis si REDIS_URL est défini (Render Pro / Upstash / Heroku),
# sinon fallback InMemory (OK pour dev local et Render free-tier mono-worker).
_redis_url = os.environ.get('REDIS_URL')
if _redis_url:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels_redis.core.RedisChannelLayer',
            'CONFIG': {'hosts': [_redis_url]},
        }
    }
else:
    CHANNEL_LAYERS = {
        'default': {
            'BACKEND': 'channels.layers.InMemoryChannelLayer',
        }
    }

# =============================================================================
# JITSI Configuration
# =============================================================================

JITSI_CONFIG = {
    'SERVER': os.environ.get('JITSI_SERVER', 'meet.jit.si'),
    'APP_ID': os.environ.get('JITSI_APP_ID', 'tontine_app'),
    'API_KEY': os.environ.get('JITSI_API_KEY', ''),
    'API_SECRET': os.environ.get('JITSI_API_SECRET', ''),
    'ENABLE_AUTH': os.environ.get('JITSI_ENABLE_AUTH', 'false').lower() == 'true',
    'JWT_ALGORITHM': 'HS256',
    'URL_PREFIX': os.environ.get('JITSI_URL_PREFIX', 'https://meet.jit.si'),
}

################################################################################################
## Config WhatsApp / SMS gateway (UltraMsg)
#########################################################################################
# Récupérer ces valeurs depuis ton dashboard https://user.ultramsg.com
ULTRAMSG_INSTANCE_ID = os.environ.get('ULTRAMSG_INSTANCE_ID', '').strip()
ULTRAMSG_TOKEN = os.environ.get('ULTRAMSG_TOKEN', '').strip()
# URL de base optionnelle (par défaut api.ultramsg.com) — utile si tu utilises
# un domaine personnalisé ou un proxy
ULTRAMSG_BASE_URL = os.environ.get(
    'ULTRAMSG_BASE_URL', 'https://api.ultramsg.com',
).rstrip('/')

################################################################################################
## Config Email Message
#########################################################################################
# SMTP — utilisé pour l'envoi d'OTP, notifications email, etc.
# En dev : si EMAIL_HOST n'est pas défini, fallback sur console backend
# (les emails s'affichent dans les logs Django au lieu d'être envoyés).
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
if EMAIL_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
    EMAIL_USE_SSL = os.environ.get('EMAIL_USE_SSL', 'False').lower() == 'true'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

DEFAULT_FROM_EMAIL = os.environ.get(
    'DEFAULT_FROM_EMAIL', 'TontineX360 <no-reply@tontinex360.com>',
)


# =============================================================================
# CELERY — Tâches asynchrones et planifiées
# =============================================================================

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_ENABLE_UTC = True

# Retry policy
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_REJECT_ON_WORKER_LOST = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# Rate limits pour éviter de spammer les SMS/WhatsApp
CELERY_TASK_DEFAULT_RATE_LIMIT = '10/m'

# =============================================================================
# NOTIFICATION SETTINGS
# =============================================================================

NOTIFICATION_SETTINGS = {
    'SESSION_REMINDER_HOURS': [24, 2],     # Rappels 24h et 2h avant
    'LOAN_REMINDER_DAYS': [3, 0],          # Rappels 3 jours et le jour J
    'CONTRIBUTION_GRACE_HOURS': 48,        # Délai avant rappel cotisation impayée
    'TRIAL_EXPIRY_WARNING_DAYS': 3,        # Alerte N jours avant fin trial
}
