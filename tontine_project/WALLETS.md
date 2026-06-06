# Wallets virtuels — Documentation

> Système de portefeuille virtuel pour chaque membre. Trace les crédits (primes d'enchères, intérêts de prêts, sanctions) et débits (cotisations impayées, compensations, dépenses) tout au long du cycle. À la clôture, l'association règle les soldes.

---

## Concept

Chaque `Membership` actif possède un `Wallet` créé automatiquement. Le wallet est alimenté par des `WalletEntry` (crédits ou débits) générés lors de divers événements métier. Les montants sont **virtuels** : la trésorerie réelle reste dans `Transaction`. À la fin du cycle, le solde net est ce que l'association doit (positif) ou réclame (négatif) au membre.

---

## Configuration au niveau de l'association

Champ `Association.settings.wallet` :

```json
{
  "auto_compensate_defaults": true,
  "compensation_sources": ["auction_premium", "loan_interest", "sanction_payment"],
  "compensation_window": "current_session",
  "rounding_target": "treasury",
  "early_resignation_settlement": false
}
```

| Clé | Valeurs | Effet |
|-----|---------|-------|
| `auto_compensate_defaults` | `true`/`false` | Compense automatiquement les défauts à la clôture du pot |
| `compensation_sources` | liste ordonnée | Sources éligibles pour la compensation |
| `compensation_window` | `current_session` / `current_cycle` | Fenêtre de fonds disponibles |
| `rounding_target` | `treasury` / `first_member` / `distribute` | Destination des centimes résiduels |
| `early_resignation_settlement` | `true`/`false` | Règlement immédiat à la démission ou attendre la fin de cycle |

---

## Sources d'écritures (`WalletEntry.source_type`)

| Source | Direction | Distribué à | Quand ? |
|--------|-----------|-------------|---------|
| `auction_premium` | Crédit | Souscripteurs de la tontine | Clôture du pot avec bid gagnante |
| `loan_interest` | Crédit | Souscripteurs du cycle | À chaque `LoanRepayment` (signal) |
| `sanction_payment` | Crédit | Souscripteurs du cycle | Sanction passe à `paid` (signal) |
| `contribution_default` | Débit | Le défaillant uniquement | Clôture du pot |
| `default_compensation` | Débit | Tous les souscripteurs | Clôture du pot, si `auto_compensate_defaults=true` |
| `expense` | Débit | Souscripteurs du cycle | Création `Transaction` `expense` avec `distribute_to_members=True` |
| `manual_adjustment` | ± | Membre ciblé | Action manuelle bureau |

---

## Endpoints API

### Membre

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET` | `/api/wallets/me/` | Mon wallet (solde + cumuls) |
| `GET` | `/api/wallets/me/entries/?cycle=&session=&source_type=` | Mes écritures filtrées |
| `GET` | `/api/wallets/me/summary/?cycle=` | Récap par cycle (par source) |

### Bureau

| Méthode | URL | Description |
|---------|-----|-------------|
| `GET` | `/api/wallets/wallets/` | Liste de tous les wallets |
| `GET` | `/api/wallets/wallets/{id}/` | Détail d'un wallet |
| `GET` | `/api/wallets/wallets/{id}/entries/` | Écritures d'un wallet |
| `POST` | `/api/wallets/wallets/{id}/recompute/` | Reconstruit le solde depuis les entries |
| `POST` | `/api/wallets/manual-adjustment/` | Ajustement manuel |
| `GET` | `/api/wallets/cycle-settlement/?cycle=<uuid>` | Tableau récap fin de cycle |

---

## Comportement automatique

### À la clôture du pot (`POST /api/cycles/pots/{id}/close/`)

`WalletService.process_pot_closure(pot)` est appelé automatiquement et orchestre dans cet ordre :

1. **Premium d'enchère** — si la séance est en méthode AUCTION et qu'une bid est `won`, le `bid_amount` est crédité aux souscripteurs.
2. **Intérêts** — pour chaque `LoanRepayment` de la séance, la part intérêt (calculée pro-rata via `Loan.total_due / Loan.amount`) est créditée.
3. **Sanctions** — sanctions `paid` à cette séance, distribuées aux souscripteurs.
4. **Défauts individuels** — chaque cotisation `defaulted` génère un débit individuel.
5. **Compensation collective** — si `auto_compensate_defaults=true`, prélèvement sur les fonds positifs et débit collectif.

### Signaux automatiques

- `Membership` créé avec `is_active=True` → création du `Wallet`.
- `Resignation` approuvée → `Wallet.is_frozen = True`.
- `Sanction.status='paid'` → `distribute_sanction_payment` (idempotent).
- `LoanRepayment` créé → `distribute_loan_interest`.
- `Transaction` `expense` avec `distribute_to_members=True` → `distribute_expense`.

### Idempotence

Toutes les distributions vérifient `WalletEntry.source_id` avant d'agir. Cliquer 2× sur "Clôturer le pot" ne double pas les distributions.

---

## Calcul des intérêts de prêt

```
total_interest = Loan.total_due − Loan.amount
interest_portion(repayment) = repayment.amount × total_interest / Loan.total_due
```

Exemple : Loan amount=1000, total_due=1050 (5% d'intérêt). Repayment=500 →
`interest_portion = 500 × 50 / 1050 = 23.80 XAF` distribué aux wallets, le reste (476.20) reste en trésorerie.

---

## Exemple chiffré (compensation)

Séance 3, 10 membres souscripteurs, premium enchère 1000 XAF, Paul ne paie pas sa cotisation 200 XAF, `auto_compensate_defaults=true`.

| Étape | Source | Direction | Amount | Cible |
|-------|--------|-----------|--------|-------|
| 1 | auction_premium | +100 | 100 | chaque membre (10) |
| 2 | contribution_default | −200 | 200 | Paul seul |
| 3 | default_compensation | −20 | 20 | chaque membre (10, Paul inclus) |

Solde net Paul = +100 − 200 − 20 = **−120 XAF**
Solde net autres = +100 − 20 = **+80 XAF**

Vérification : 10×100 − 200 − 10×20 = +600 = montants effectivement crédités après défaut absorbé ✓

---

## Gestion des cycles de vie

- **Nouveau membre** : wallet créé vide, ne participe qu'aux distributions ultérieures.
- **Démission approuvée** : wallet gelé. Si `early_resignation_settlement=false`, le solde reste consultable, règlement à la fin du cycle. Sinon, l'association règle immédiatement.

---

## Activation

```bash
# Migrations
docker compose exec backend python manage.py migrate wallets
docker compose exec backend python manage.py migrate finance 0004
```

## Configuration test

Avant les premiers tests, configurer le wallet de l'association :

```http
PATCH /api/associations/associations/{slug}/
{
  "settings": {
    "wallet": {
      "auto_compensate_defaults": true,
      "compensation_sources": ["auction_premium", "loan_interest", "sanction_payment"],
      "compensation_window": "current_session",
      "rounding_target": "treasury",
      "early_resignation_settlement": false
    }
  }
}
```
