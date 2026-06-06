# Image Python légère
FROM python:3.12-slim

# Variables d'environnement
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Dépendances système
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Dossier de travail
WORKDIR /app

# Installer dépendances Python
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copier projet
COPY . .

# Collectstatic au build (pour servir /static/ en prod)
RUN python manage.py collectstatic --noinput || true

# Script d'entrée
RUN chmod +x /app/entrypoint.sh

# Exposer port (informatif — Render utilise $PORT)
EXPOSE 8000

# ENTRYPOINT (migrations + attente DB)
ENTRYPOINT ["sh", "/app/entrypoint.sh"]

# CMD par défaut : Daphne (ASGI) pour supporter HTTP + WebSockets en prod.
# Render injecte $PORT (typiquement 10000).
CMD ["sh", "-c", "daphne -b 0.0.0.0 -p ${PORT:-8000} config.asgi:application"]
