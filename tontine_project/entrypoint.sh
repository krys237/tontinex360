#!/bin/sh
set -e

# ──────────────────────────────────────────────────────────────────
# Attendre que Postgres soit dispo avant migrations.
# Supporte 3 modes :
#   1. DATABASE_URL (Render standard) — parse pour extraire host:port
#   2. POSTGRES_HOST_RENDER + POSTGRES_PORT_RENDER (fallback Render)
#   3. POSTGRES_HOST + POSTGRES_PORT (dev local)
# ──────────────────────────────────────────────────────────────────

if [ -n "$DATABASE_URL" ]; then
  # Parse "postgresql://user:pass@host:port/db" ou "postgresql://user:pass@host/db"
  DB_HOSTPORT=$(echo "$DATABASE_URL" | sed -nE 's#.*@([^/]+)/.*#\1#p')
  WAIT_HOST=$(echo "$DB_HOSTPORT" | cut -d: -f1)
  WAIT_PORT=$(echo "$DB_HOSTPORT" | cut -s -d: -f2)
  WAIT_PORT=${WAIT_PORT:-5432}
elif [ -n "$POSTGRES_HOST_RENDER" ]; then
  WAIT_HOST="$POSTGRES_HOST_RENDER"
  WAIT_PORT="${POSTGRES_PORT_RENDER:-5432}"
elif [ -n "$POSTGRES_HOST" ]; then
  WAIT_HOST="$POSTGRES_HOST"
  WAIT_PORT="${POSTGRES_PORT:-5432}"
fi

if [ -n "$WAIT_HOST" ]; then
  echo "⏳ Waiting for PostgreSQL at $WAIT_HOST:$WAIT_PORT..."
  TIMEOUT=60
  while ! nc -z "$WAIT_HOST" "$WAIT_PORT"; do
    TIMEOUT=$((TIMEOUT - 1))
    if [ $TIMEOUT -le 0 ]; then
      echo "❌ Timeout waiting for Postgres"
      exit 1
    fi
    sleep 1
  done
  echo "✅ PostgreSQL is ready!"
fi

# Migrations automatiques si RUN_MIGRATIONS=true
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "📦 Applying migrations..."
  python manage.py migrate --noinput
fi

# Collectstatic au runtime aussi (idempotent — si déjà fait au build, rapide)
if [ "$RUN_COLLECTSTATIC" = "true" ]; then
  echo "🎨 Collecting static files..."
  python manage.py collectstatic --noinput
fi

# Seed des plans d'abonnement (idempotent — met à jour si déjà présents)
if [ "$SEED_PLANS" = "true" ]; then
  echo "💳 Seeding subscription plans..."
  python manage.py seed_plans
fi

echo "🚀 Starting service..."
exec "$@"
