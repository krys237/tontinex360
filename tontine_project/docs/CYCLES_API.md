# Cycles & Sessions — Documentation API

> Base URL : `http://localhost:8000` — adapte selon ton environnement.
> Préfixe commun : `/api/cycles/`
> Header `X-Tenant: <association_slug>` requis sur tous les endpoints.

---

## Sommaire

1. [Stats des séances pour le calendrier](#1-stats-des-séances-pour-le-calendrier)
2. [Rapports de séance par membre du bureau](#2-rapports-de-séance-par-membre-du-bureau)
   - [Modèles](#modèles)
   - [Liste / lecture](#liste--lecture)
   - [Création](#création)
   - [Modification / suppression](#modification--suppression)
   - [Publier / dépublier](#publier--dépublier)
   - [Pièces jointes](#pièces-jointes)
   - [Notifications émises](#notifications-émises)
3. [Codes d'erreur](#codes-derreur)

---

## 1. Stats des séances pour le calendrier

> Endpoint principalement consommé par le **calendrier front** : combien de séances tenues, combien restantes, prochaine séance, etc.

### `GET /api/cycles/cycles/<uuid>/sessions-stats/`

Permission : tout membre actif de l'association.

**Headers**
```
Authorization: Bearer <access>
X-Tenant: <association_slug>
```

**Réponse 200** :

```json
{
  "cycle_id": "uuid",
  "cycle_name": "Cycle 2026",
  "cycle_status": "active",
  "total_sessions": 12,
  "completed": 5,
  "remaining": 7,
  "in_progress": 0,
  "scheduled": 7,
  "cancelled": 0,
  "postponed": 0,
  "progress_percentage": 41.67,
  "next_session": {
    "id": "uuid",
    "session_number": 6,
    "date": "2026-05-15",
    "start_time": "14:00:00",
    "end_time": "16:00:00",
    "location": "Salle communautaire",
    "status": "scheduled"
  },
  "last_session": {
    "id": "uuid",
    "session_number": 5,
    "date": "2026-04-15",
    "start_time": "14:00:00",
    "end_time": "16:00:00",
    "location": "Salle communautaire",
    "status": "completed"
  },
  "sessions": [
    {
      "id": "uuid",
      "session_number": 1,
      "date": "2026-01-15",
      "start_time": "14:00:00",
      "end_time": "16:00:00",
      "location": "Salle communautaire",
      "status": "completed"
    }
    // ... toutes les séances dans l'ordre chronologique
  ]
}
```

### Détails du calcul

| Champ | Définition |
|---|---|
| `total_sessions` | Nombre total de séances (toutes statuses) |
| `completed` | `status='completed'` |
| `remaining` | `scheduled` + `in_progress` + `postponed` |
| `progress_percentage` | `completed / (total - cancelled) × 100` |
| `next_session` | Prochaine séance `scheduled` ou `postponed`, dont `date >= today` |
| `last_session` | Dernière séance `completed` |
| `sessions` | Liste compacte de toutes les séances, triées par `date ASC` |

### Statuts de séance (`Session.Status`)

| Slug | Label |
|---|---|
| `scheduled` | Programmée |
| `in_progress` | En cours |
| `completed` | Terminée |
| `cancelled` | Annulée |
| `postponed` | Reportée |

---

## 2. Rapports de séance par membre du bureau

> Chaque **membre du bureau** (Président, Trésorier, Secrétaire, etc.) peut publier son **propre rapport** pour une séance donnée. **Un seul rapport par (séance, membre du bureau)**.
>
> À distinguer du **PV global** de la séance (`Session.minutes`) qui reste un champ texte du modèle `Session` géré séparément.

### Modèles

#### SessionReport

```json
{
  "id": "uuid",
  "session": "uuid",
  "session_number": 5,
  "session_date": "2026-04-15",
  "bureau_member": "uuid",
  "bureau_position": "Président",
  "bureau_position_slug": "president",
  "author_name": "Jean Dupont",
  "title": "Rapport présidentiel - Avril",
  "content": "Lors de cette séance...",
  "is_published": true,
  "published_at": "2026-04-16T10:00:00Z",
  "attachments": [
    {
      "id": "uuid",
      "file": "/media/session_reports/2026/04/rapport.pdf",
      "filename": "rapport.pdf",
      "uploaded_at": "2026-04-16T10:05:00Z"
    }
  ],
  "can_edit": true,
  "created_at": "2026-04-16T09:50:00Z",
  "updated_at": "2026-04-16T10:00:00Z"
}
```

> `can_edit` = `true` si l'utilisateur connecté est l'auteur du rapport.

### Liste / lecture

#### `GET /api/cycles/session-reports/`

Liste les rapports. **Visibilité** :
- Tous les rapports `is_published=true` sont visibles par tout membre actif.
- Les **brouillons** (`is_published=false`) ne sont visibles que par leur auteur.

**Query params** :
- `session=<uuid>` — filtrer par séance
- `bureau_member=<uuid>` — filtrer par auteur
- `is_published=true|false`

**Exemples** :
```http
GET /api/cycles/session-reports/?session=<session-uuid>
GET /api/cycles/session-reports/?bureau_member=<bureau-uuid>&is_published=true
```

#### `GET /api/cycles/session-reports/<uuid>/`

Détail d'un rapport.

### Création

#### `POST /api/cycles/session-reports/`

> 🔒 Réservé aux **membres du bureau** du cycle de la séance. Le `BureauMember` est résolu automatiquement depuis l'utilisateur connecté.

```http
POST /api/cycles/session-reports/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
Content-Type: application/json

{
  "session": "<session-uuid>",
  "title": "Rapport présidentiel - Avril",
  "content": "Lors de cette séance, nous avons abordé...",
  "publish": false
}
```

**201 Created** : `SessionReport` complet (avec `is_published=false` si `publish=false`).

> Si `publish=true` : le rapport est publié immédiatement et **tous les membres actifs sont notifiés**.

**Erreurs** :
- `400` : `{"error": "Vous avez deja un rapport pour cette seance."}` — un seul rapport par auteur/séance
- `403` : utilisateur n'est pas membre du bureau du cycle de la séance
- `404` : séance introuvable

### Modification / suppression

> 🔒 Seul **l'auteur** du rapport peut le modifier ou le supprimer.

#### `PATCH /api/cycles/session-reports/<uuid>/`

```json
{
  "title": "Nouveau titre",
  "content": "Contenu mis à jour"
}
```

#### `DELETE /api/cycles/session-reports/<uuid>/`

**204 No Content**.

**403** : *"Vous ne pouvez modifier que vos propres rapports."*

### Publier / dépublier

#### `POST /api/cycles/session-reports/<uuid>/publish/`

> 🔒 Auteur uniquement.
> 📣 **Side effect** : crée une notification `session_report_published` pour **tous les membres actifs** de l'association.

```http
POST /api/cycles/session-reports/<uuid>/publish/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
```

**200 OK** : le `SessionReport` avec `is_published=true`, `published_at` renseigné.

#### `POST /api/cycles/session-reports/<uuid>/unpublish/`

Repasse en brouillon. Pas de notification émise.

### Pièces jointes

> 🔒 Auteur uniquement. Optionnel.

#### `POST /api/cycles/session-reports/<uuid>/attachments/`

```http
POST /api/cycles/session-reports/<uuid>/attachments/
Authorization: Bearer <access>
X-Tenant: jeunes-banka
Content-Type: multipart/form-data

file: <fichier binaire>
filename: rapport.pdf  # optionnel, déduit du fichier si omis
```

**201 Created** :
```json
{
  "id": "uuid",
  "file": "/media/session_reports/2026/04/rapport.pdf",
  "filename": "rapport.pdf",
  "uploaded_at": "2026-04-16T10:05:00Z"
}
```

#### `GET /api/cycles/session-report-attachments/`

Liste de toutes les pièces jointes (filtrable).

#### `DELETE /api/cycles/session-report-attachments/<uuid>/`

Suppression (auteur uniquement).

### Notifications émises

À la publication d'un rapport (`POST /publish/` ou création avec `publish=true`) :

| Champ | Valeur |
|---|---|
| `notification_type` | `session_report_published` |
| `recipient` | Tous les `Membership` actifs de l'association |
| `title` | *"Rapport de séance publié - Président"* (selon position) |
| `body` | *"Jean Dupont (Président) a publié son rapport pour la séance n°5 du 2026-04-15."* |
| `data` | `session_id`, `report_id`, `session_number`, `session_date`, `bureau_position` (slug), `author_name` |

> Si l'envoi de notification échoue pour un membre, la publication n'est pas bloquée (logs uniquement).

---

## Codes d'erreur

| Code | Cas |
|---|---|
| **400** | Validation (rapport déjà existant pour ce membre/séance, contenu vide…) |
| **401** | Pas de token JWT |
| **403** | Utilisateur n'est pas membre du bureau / n'est pas l'auteur du rapport |
| **404** | Séance / rapport introuvable |

---

## Modèle de données — résumé

```
Cycle (1) ── (n) Session (1) ── (n) SessionReport (n) ── (1) BureauMember
                                          (1)
                                           │
                                           └── (n) SessionReportAttachment
```

- **Un rapport par couple `(session, bureau_member)`** (`unique_together`)
- Pièces jointes liées à un rapport (suppression cascade)
- `bureau_member` → `position` (Président, Trésorier…) → utilisé pour le titre des notifs
