# TontineX360 — Frontend Dashboard

## Demarrage rapide

```bash
npm install
cp .env.example .env.local
# Editer .env.local si necessaire
npm run dev
```

Ouvrir http://localhost:3000

## Backend requis

Le backend Django doit tourner sur http://localhost:8000 avec :
- CORS active pour localhost:3000
- Les endpoints API sous /api/

## Structure

- `src/app/(auth)/` — Pages publiques (login, register, invite)
- `src/app/(dashboard)/` — Pages protegees (avec sidebar)
- `src/components/` — Composants reutilisables
- `src/lib/api/` — Clients API (1 fichier par module)
- `src/lib/types/` — Types TypeScript (miroir des modeles Django)
- `src/lib/stores/` — Stores Zustand (auth, notifications)
- `src/lib/hooks/` — Custom hooks
- `src/lib/utils/` — Formatage, permissions, constantes
