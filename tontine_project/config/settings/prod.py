"""
Production settings (Render).

Configuration BDD :
- Prio 1 : `DATABASE_URL` (standard Render — l'URL interne du Postgres)
- Prio 2 : variables `POSTGRES_*_RENDER` (host/user/password/db/port)
- Prio 3 : variables `DB_*_PROD` (legacy)

Sur Render, le service Postgres expose automatiquement la variable
`DATABASE_URL` quand tu lies la DB au web service. C'est la méthode
recommandée — pas besoin de copier le mot de passe manuellement.
"""
import os
from urllib.parse import urlparse
from .base import *
from dotenv import load_dotenv

load_dotenv()

DEBUG = False

# Hosts autorisés : Render + tout ce que ALLOWED_HOSTS contient
ALLOWED_HOSTS = [
    h.strip() for h in os.environ.get('ALLOWED_HOSTS', '').split(',') if h.strip()
]
# Inclure automatiquement le hostname Render si présent
RENDER_EXTERNAL_HOSTNAME = os.environ.get('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME and RENDER_EXTERNAL_HOSTNAME not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)


# ── Configuration BDD ─────────────────────────────────────────────────
def _db_from_url(url: str) -> dict:
    """Parse une URL Postgres en config Django (sans dj-database-url)."""
    parsed = urlparse(url)
    return {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': (parsed.path or '/').lstrip('/'),
        'USER': parsed.username or '',
        'PASSWORD': parsed.password or '',
        'HOST': parsed.hostname or 'localhost',
        'PORT': str(parsed.port or 5432),
        'OPTIONS': {'sslmode': 'require'},  # SSL requis chez Render
        'CONN_MAX_AGE': 60,
    }


_database_url = os.environ.get('DATABASE_URL')
if _database_url:
    DATABASES = {'default': _db_from_url(_database_url)}
elif os.environ.get('POSTGRES_HOST_RENDER'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB_RENDER'),
            'USER': os.environ.get('POSTGRES_USER_RENDER'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD_RENDER'),
            'HOST': os.environ.get('POSTGRES_HOST_RENDER', '').strip(),
            'PORT': os.environ.get('POSTGRES_PORT_RENDER', '5432'),
            'OPTIONS': {'sslmode': 'require'},
            'CONN_MAX_AGE': 60,
        }
    }
else:
    # Fallback legacy DB_*_PROD
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME_PROD'),
            'USER': os.environ.get('DB_USER_PROD'),
            'PASSWORD': os.environ.get('DB_PASSWORD_PROD'),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
            'OPTIONS': {'sslmode': 'require'},
            'CONN_MAX_AGE': 60,
        }
    }


# ── CORS ──────────────────────────────────────────────────────────────
# Lit CORS_ALLOWED_ORIGINS (séparé par virgules). Nettoie les slashes finaux
# ET valide que chaque origine a un scheme (http:// ou https://) — sinon
# corsheaders.E013 fait crasher le démarrage.
def _clean_cors_origins(raw):
    cleaned = []
    for o in (raw or '').split(','):
        o = o.strip().rstrip('/')
        if not o:
            continue
        if not o.startswith(('http://', 'https://')):
            # Ignore les entrées sans scheme (évite corsheaders.E013)
            continue
        cleaned.append(o)
    return cleaned


CORS_ALLOWED_ORIGINS = _clean_cors_origins(os.environ.get('CORS_ALLOWED_ORIGINS'))

# Autorise tous les localhost:* + 127.0.0.1:* pour le dev local quand
# CORS_ALLOW_LOCAL_DEV=True (à activer SEULEMENT en staging, jamais en prod
# orientée client final).
if os.environ.get('CORS_ALLOW_LOCAL_DEV', 'False').lower() == 'true':
    CORS_ALLOWED_ORIGIN_REGEXES = [
        r"^http://localhost(:\d+)?$",
        r"^http://127\.0\.0\.1(:\d+)?$",
    ]

CORS_ALLOW_CREDENTIALS = True

try:
    from corsheaders.defaults import default_headers
    CORS_ALLOW_HEADERS = list(default_headers) + ['x-tenant', 'x-association-slug']
except ImportError:
    pass

# CSRF pour Render — réutilise la même liste (déjà validée scheme+netloc)
CSRF_TRUSTED_ORIGINS = list(CORS_ALLOWED_ORIGINS)

# ── Sécurité HTTPS ─────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = os.environ.get('SECURE_SSL_REDIRECT', 'True').lower() == 'true'
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Static (Render servira depuis /static/)
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
