# Documentation API & Tests Postman

## Fichiers

| Fichier | Description |
|---|---|
| [`SUBSCRIPTIONS_API.md`](SUBSCRIPTIONS_API.md) | Doc des endpoints **onboarding & abonnements** |
| [`CYCLES_API.md`](CYCLES_API.md) | Doc des endpoints **calendrier des séances & rapports de bureau** |
| [`Tontine_API.postman_collection.json`](Tontine_API.postman_collection.json) | Collection Postman avec tests automatisés |

## Importer la collection

1. Postman → **File** → **Import**
2. Glisser-déposer `Tontine_API.postman_collection.json`
3. La collection apparaît dans la sidebar gauche

## Configurer les variables

Cliquer sur la collection → onglet **Variables** :

| Variable | Description | Auto / Manuel |
|---|---|---|
| `baseUrl` | URL de l'API (ex: `http://localhost:8000`) | Manuel |
| `telephone` | Téléphone pour register | Manuel |
| `password` | Mot de passe | Manuel |
| `otp` | Code OTP reçu par SMS | Manuel après `1.1 Register` |
| `accessToken`, `refreshToken` | JWT tokens | Auto (via tests) |
| `associationSlug` | Slug de l'association créée | Auto |
| `paymentId` | ID du dernier paiement initié | Auto |
| `reportId` | ID du dernier rapport de séance créé | Auto |
| `cycleId` | ID d'un cycle existant | Manuel |
| `sessionId` | ID d'une séance existante | Manuel |

## Structure de la collection

```
1 — Onboarding              (register, OTP, login, créer association)
2 — Lecture                 (plans, my-subscription, recommended-plan, payments)
3 — Actions (Président)     (change-plan, initiate/confirm payment, cancel)
4 — Cas d'erreur            (400, 401, 400 paiement déjà completed)
6 — Cycles & Calendrier     (sessions-stats pour le calendrier front)
7 — Rapports de séance      (Bureau : create, edit, publish, attachments, delete)
8 — Auth utilitaires        (refresh, me)
```

> Les dossiers 6 et 7 nécessitent un cycle/séance existants — renseigne `cycleId` et `sessionId` dans les variables avant de lancer.

## Lancer le flux complet

Ordre recommandé pour un test end-to-end :

```
1.1 Register
1.2 Validate OTP            ← renseigner {{otp}}
1.3 Login                   ← optionnel
1.4 Create Association

2.1 List Plans
2.2 My Subscription         ← devrait être en trial sur 'famille'
2.3 Recommended Plan        ← métriques 90j
2.4 Payment History         ← vide

3.1 Change Plan             ← upgrade vers 'quartier'
3.2 Initiate Payment        ← crée Payment pending
3.3 Confirm Payment (manuel)← active la subscription
3.4 Cancel auto_renew       ← optionnel

6.1 Sessions stats          ← après création d'un cycle (renseigner {{cycleId}})

7.1 Créer rapport (brouillon)  ← après création d'une séance (renseigner {{sessionId}})
7.3 Modifier rapport
7.4 Publier rapport
7.5 Ajouter pièce jointe
7.6 Dépublier
7.7 Supprimer rapport
```

## Tests automatisés

Chaque requête a un script de test qui vérifie :
- Le code HTTP attendu
- La structure de la réponse
- L'invariant métier (ex: `plan.slug === 'famille'` après création)

Les variables sont chaînées entre requêtes via `pm.collectionVariables.set()`.

## Headers automatiques

- **Authorization** : `Bearer {{accessToken}}` au niveau de la collection
- **X-Tenant** : à ajouter manuellement par requête (déjà configuré dans la collection)

## Tester l'expiration de trial en local

Pour forcer la fin du trial sans attendre 90 jours :

```bash
docker compose exec backend python manage.py shell -c "
from apps.subscriptions.models import Subscription
from django.utils import timezone
sub = Subscription.objects.get(association__slug='tontine-demo-postman')
sub.trial_end = timezone.now() - timezone.timedelta(seconds=1)
sub.save()
"

# Puis lancer la tâche d'expiration (envoie la notif avec recommandation)
docker compose exec backend python manage.py shell -c "
from apps.subscriptions.tasks import expire_overdue_subscriptions
print(expire_overdue_subscriptions())
"
```

## Récapitulatif des endpoints couverts

### Subscriptions (8 endpoints)
- `GET /api/subscriptions/plans/`
- `GET /api/subscriptions/my-subscription/`
- `GET /api/subscriptions/recommended-plan/`
- `GET /api/subscriptions/payments/`
- `POST /api/subscriptions/change-plan/`
- `POST /api/subscriptions/payments/initiate/`
- `POST /api/subscriptions/payments/<id>/confirm/`
- `POST /api/subscriptions/cancel/`

### Cycles (1 endpoint)
- `GET /api/cycles/cycles/<id>/sessions-stats/` — pour le calendrier

### Session Reports (8 endpoints)
- `GET /api/cycles/session-reports/`
- `POST /api/cycles/session-reports/`
- `GET /api/cycles/session-reports/<id>/`
- `PATCH /api/cycles/session-reports/<id>/`
- `DELETE /api/cycles/session-reports/<id>/`
- `POST /api/cycles/session-reports/<id>/publish/`
- `POST /api/cycles/session-reports/<id>/unpublish/`
- `POST /api/cycles/session-reports/<id>/attachments/`
- `DELETE /api/cycles/session-report-attachments/<id>/`
