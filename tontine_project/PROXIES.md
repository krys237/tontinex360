# Procurations — Documentation

> Un membre titulaire (principal) délègue à un autre membre (proxy) la collecte physique de sa tontine pour une séance précise. La quote-part virtuelle (wallet, schedule) reste attribuée au principal.

---

## Concept

Quand un membre ne peut pas se déplacer le jour de la séance, il rédige une procuration au nom d'un autre membre actif. Le procurataire vient à la séance et reçoit physiquement l'argent à la place du principal. Toute la traçabilité comptable reste liée au principal.

---

## Configuration au niveau de l'association

`Association.settings.proxy` :

```json
{
  "proxy": {
    "require_document": false,
    "require_approval": true
  }
}
```

| Clé | Valeurs | Effet |
|-----|---------|-------|
| `require_document` | `true`/`false` | Si `true`, un `signed_document` ou `signature_image` est obligatoire à la création |
| `require_approval` | `true`/`false` | Si `false`, la procuration est auto-approuvée au moment de la création |

---

## Modèle `Proxy`

| Champ | Description |
|-------|-------------|
| `principal` | FK Membership — le souscripteur titulaire |
| `proxy` | FK Membership — le procurataire |
| `session` | FK Session — pour quelle séance |
| `tontine_type` | FK TontineType (nullable) — null = vaut pour toutes les tontines de la séance |
| `reason` | Motif |
| `signed_document` / `signature_image` / `cni_image` | Justificatifs optionnels |
| `status` | `pending` / `approved` / `used` / `rejected` / `cancelled` / `expired` |
| `approved_by` / `approved_at` / `review_note` | Validation bureau |
| `used_at` / `resulting_payout` | Trace de consommation |

**Contraintes** :
- `proxy ≠ principal`
- Une seule procuration *active* (pending|approved) par couple (principal, session, tontine_type)
- Le principal doit être souscripteur de la tontine (si `tontine_type` précisé)
- La séance doit être `scheduled` ou `in_progress` au moment de la création

---

## Workflow

```
1. PRINCIPAL crée la procuration (POST /api/proxies/)
   → status = pending
   → si require_approval=false : auto-approuvée immédiatement

2. BUREAU approuve (POST /api/proxies/{id}/approve/)
   → status = approved
   → SessionAttendance du principal mis à jour : REPRESENTED, represented_by=proxy

3. CONSOMMATION lors du payout
   POST /api/cycles/pots/{id}/distribute/ (ou /auction/)
   { "membership_id": "...principal...", "proxy_id": "...optionnel..." }

   - Si proxy_id fourni : on charge la procuration et on applique
   - Sinon : auto-détection si une procuration approuvée existe pour ce contexte
   - Le BeneficiaryPayout est créé avec :
       membership = principal
       received_by = proxy.proxy
       proxy_record = proxy
   - status proxy → used
```

**Annulation** :
- Le **principal** : `POST /api/proxies/{id}/cancel/` (tant que `pending` ou `approved`)
- Le **bureau** : `POST /api/proxies/{id}/reject/` (uniquement `pending`)

**Expiration auto** : appel manuel ou tâche planifiée de `ProxyService.expire_unused_after_session(session)` quand la séance passe à `completed`.

---

## Endpoints

| Méthode | URL | Permission | Description |
|---------|-----|-----------|-------------|
| `POST` | `/api/proxies/` | Membre actif | Créer une procuration |
| `GET` | `/api/proxies/` | Membre (siennes) / Bureau (toutes) | Lister `?status=&session=&principal=&proxy=&tontine_type=` |
| `GET` | `/api/proxies/{id}/` | Concerné | Détail |
| `POST` | `/api/proxies/{id}/approve/` | Bureau | Approuver |
| `POST` | `/api/proxies/{id}/reject/` | Bureau | Rejeter |
| `POST` | `/api/proxies/{id}/cancel/` | Principal | Annuler |
| `GET` | `/api/proxies/active/?session=&tontine_type=` | Bureau | Procurations approuvées valides |

---

## Distribution avec procuration

Les endpoints existants acceptent désormais un champ optionnel `proxy_id` :

### `POST /api/cycles/pots/{pot_id}/distribute/`

```json
{
  "membership_id": "uuid-principal",
  "shares_claimed": 1,
  "proxy_id": "uuid-procuration"
}
```

### `POST /api/cycles/pots/{pot_id}/auction/`

```json
{
  "winner_membership_id": "uuid-principal",
  "bid_amount": 5000,
  "proxy_id": "uuid-procuration"
}
```

**Auto-détection** : si `proxy_id` est omis et qu'une procuration approuvée existe pour ce membre/séance/tontine, elle est automatiquement appliquée.

---

## BeneficiaryPayout — nouveaux champs

| Champ | Type | Rôle |
|-------|------|------|
| `received_by` | FK Membership (nullable) | Qui a physiquement reçu (différent du titulaire si procuration) |
| `proxy_record` | FK Proxy (nullable) | Trace vers la procuration utilisée |

Le champ existant `guarantor` reste réservé à la sémantique "caution morale/financière".

---

## Activation

```bash
docker compose exec backend python manage.py migrate proxies
docker compose exec backend python manage.py migrate cycles
```

Configurer une association :

```http
PATCH /api/associations/associations/{slug}/
{
  "settings": {
    "proxy": {
      "require_document": false,
      "require_approval": true
    }
  }
}
```
