# Déploiement sur Render

## Variables d'environnement à configurer sur Render

Va sur **Render dashboard → ton service web → Environment** et ajoute :

### Django
| Variable | Valeur | Notes |
|---|---|---|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` | Active prod.py |
| `DJANGO_SECRET_KEY` | (générer un nouveau) | **Différent** du `.env` local. Utilise un générateur (`python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"`) |
| `ALLOWED_HOSTS` | `tontine-project.onrender.com` | Plusieurs hosts → séparer par virgule |
| `SECURE_SSL_REDIRECT` | `True` | Render fournit le SSL automatiquement |

### Base de données — méthode recommandée
| Variable | Valeur |
|---|---|
| `DATABASE_URL` | **Fourni automatiquement par Render** si tu lies ton service Postgres au web service via "Add Environment" → "From service" |

> **Important** : `DATABASE_URL` est ajouté automatiquement par Render quand tu connectes ton service Postgres au web service. **Tu n'as RIEN à copier manuellement.** C'est plus sûr (pas d'exposition de mot de passe).

### Base de données — méthode manuelle (fallback)
Si pour une raison `DATABASE_URL` n'est pas dispo :
| Variable | Valeur (depuis ton dashboard Postgres Render) |
|---|---|
| `POSTGRES_DB_RENDER` | nom de la BDD |
| `POSTGRES_USER_RENDER` | user |
| `POSTGRES_PASSWORD_RENDER` | mot de passe |
| `POSTGRES_HOST_RENDER` | hostname interne (ex: `dpg-xxx.oregon-postgres.render.com`) |
| `POSTGRES_PORT_RENDER` | `5432` (PAS 5434 — c'est le défaut Postgres) |

### CORS (autoriser le frontend Vercel)
| Variable | Valeur |
|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://tontinex360-web.vercel.app` |

> **Pas de slash final**, pas de path. Si tu as plusieurs frontends (dev preview Vercel par ex.), sépare-les par virgule.

### Redis / Celery (si tu utilises)
| Variable | Valeur |
|---|---|
| `REDIS_URL` | URL de ton service Redis Render (interne) |
| `CELERY_BROKER_URL` | idem |

---

## Commande de démarrage Render

Dans **Settings → Build & Deploy** :

**Build Command** :
```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

**Start Command** (Django + Daphne pour les WebSockets) :
```bash
daphne -b 0.0.0.0 -p $PORT config.asgi:application
```

Si tu n'utilises pas les WebSockets, tu peux utiliser :
```bash
gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

---

## Vérifications post-déploiement

1. **Health check** : `curl https://tontine-project.onrender.com/admin/` doit retourner du HTML (pas une erreur 500 ou DisallowedHost)
2. **Migration** : check les logs Render — `python manage.py migrate` doit avoir tourné
3. **CORS** : ouvre la console Vercel et essaye un login → vérifie qu'il n'y a pas d'erreur CORS
4. **WebSocket** : si chat actif, ouvre une conversation → vérifie dans Network → WS qu'il y a une connexion `wss://tontine-project.onrender.com/ws/...`

---

## Cold start (free tier)

Render endort les apps free tier après **15 minutes d'inactivité**. Le 1er appel après ça prend ~30-60 secondes.

**Solutions** :
- Plan payant ($7/mois) → pas de cold start
- Cron Vercel ou cron-job.org → ping `https://tontine-project.onrender.com/admin/login/` toutes les 10 min
- Ne PAS héberger des features critiques temps-réel (chat actif) sur free tier

---

## Sécurité — checklist avant prod

- [ ] Le mot de passe Postgres a été **rotaté** (l'ancien a fuité dans le chat de dev)
- [ ] `DJANGO_SECRET_KEY` est différent entre dev et prod
- [ ] `DEBUG=False` en prod (déjà géré par `prod.py`)
- [ ] `.env` est dans `.gitignore` (✅ déjà OK)
- [ ] Aucun secret commité dans le repo (`git log -p | grep -iE "password|secret"`)
- [ ] CORS strict (pas de `*`, juste l'origine Vercel)
- [ ] SSL forcé (`SECURE_SSL_REDIRECT=True`)
