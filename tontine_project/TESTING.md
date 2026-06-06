# Suite de tests automatisés — TontineX360

Cette suite couvre **les workflows critiques** du projet pour détecter immédiatement toute régression.

## Lancer les tests

### En local (sans Docker)

```bash
cd tontine_project
python manage.py test apps -v 2
```

### Via Docker

```bash
docker compose run --rm backend python manage.py test apps -v 2
```

### Cibler une app spécifique

```bash
# Frais d'adhésion seulement
python manage.py test apps.members.tests.test_fees -v 2

# Approbations seulement
python manage.py test apps.approvals.tests -v 2

# Sondages
python manage.py test apps.governance.tests.test_polls -v 2
```

### Un seul test (par nom complet)

```bash
python manage.py test apps.members.tests.test_fees.RecordPaymentTests.test_full_registration_payment_activates_member -v 2
```

## Couverture par module

### 📁 [apps/members/tests/_fixtures.py](apps/members/tests/_fixtures.py)
Helpers partagés (pas un test) :
- `TestScenario.build_full()` → 1 asso + président + 2 membres bureau + 3 membres simples
- `make_user()`, `make_membership()`, `make_authed_client()`, etc.
- `TINY_PNG_DATAURL` pour signer

### 📁 [apps/members/tests/test_signature.py](apps/members/tests/test_signature.py)
Endpoint `POST /api/members/memberships/{id}/signature/`
- ✅ Garde-fou anti-régression 404
- ✅ Membre peut signer sa propre fiche → 200 + signature persistée
- ✅ Refus body vide / pas data URL / base64 corrompu
- ✅ Sécurité : un membre lambda ne peut pas signer pour un autre

### 📁 [apps/members/tests/test_fees.py](apps/members/tests/test_fees.py)
Frais d'adhésion (Phase A + B + C)
- ✅ Config : défauts, set/get, préservation autres settings
- ✅ Création initiale : both fees, mark_as_paid, idempotence
- ✅ Versement : Transaction + Wallet + Installment atomiques
- ✅ Activation auto : `pending → active` après inscription payée
- ✅ Versement partiel n'active pas
- ✅ Versements multiples cumulés
- ✅ Refus overpayment / négatif / sur déjà payé
- ✅ Solde wallet reflète les versements
- ✅ Exonération via service (waive_fee)
- ✅ Contraintes DB : pas 2 inscriptions par membre

### 📁 [apps/members/tests/test_imports.py](apps/members/tests/test_imports.py)
Import Excel
- ✅ Parse rows valides
- ✅ Normalisation téléphone (espaces, +)
- ✅ En-têtes en français acceptés (Téléphone, Prénom, Nom)
- ✅ Skip lignes vides
- ✅ Refus fichier sans colonne téléphone
- ✅ Validation : duplicate vs file_doublon vs invalid
- ✅ Template `.xlsx` généré valide

### 📁 [apps/approvals/tests/test_approvals.py](apps/approvals/tests/test_approvals.py)
Framework d'approbation Bureau (Tier 1-4)
- ✅ `create_request` persiste les métadonnées handler
- ✅ Double approbation (pres + bureau) → application automatique
- ✅ Requérant ne peut pas s'auto-approuver
- ✅ Une même personne ne peut pas remplir 2 slots
- ✅ Membre non-bureau ne peut pas approuver
- ✅ Demande concurrente sur même cible bloquée
- ✅ Rejet avec motif (min 5 caractères)
- ✅ Annulation par requérant
- ✅ Expiration TTL 24h
- ✅ **Triple validation (Tier 4)** : pres + 2 bureau distincts
- ✅ Handler réel `membership_fee.waive` end-to-end

### 📁 [apps/finance/tests/test_contributions.py](apps/finance/tests/test_contributions.py)
Cotisations + paiement automatique + correction
- ✅ `record_payment` crée Transaction comptable cash
- ✅ Idempotence : pas de double Transaction
- ✅ Mode in_kind : quantité stockée + valeur XAF équivalente
- ✅ Refus si paid_amount=0
- ✅ Correction workflow : reversal + replacement de la Transaction
- ✅ La référence canonique se déplace vers la nouvelle Transaction
- ✅ L'ancienne devient `superseded:`

### 📁 [apps/cycles/tests/test_session_generation.py](apps/cycles/tests/test_session_generation.py)
Patterns de récurrence + génération auto des séances
- ✅ `nth_weekday` : 3ᵉ samedi de janvier 2026 = 17 jan
- ✅ `nth_weekday` : nth=5 (dernier) avec fallback 4ᵉ si mois court
- ✅ `nth_weekday` : 1er dimanche de mai 2026 = 3 mai
- ✅ `fixed_day_of_month` : clamp au 28 février si jour=31
- ✅ `every_weekday` : chaque mercredi (weekly et biweekly)
- ✅ `none` : aucune date générée
- ✅ `preview_dates` respecte la limite
- ✅ `generate_sessions_for_cycle` numérote séquentiellement
- ✅ Idempotence : 2ᵉ appel skip les dates existantes

### 📁 [apps/governance/tests/test_polls.py](apps/governance/tests/test_polls.py)
Sondages électroniques
- ✅ Single choice : 1 vote → 1 incrément
- ✅ Single choice : refus de 0 ou 2+ options
- ✅ Anti-doublon par défaut
- ✅ `allow_change_vote` : décrémente ancienne option + incrémente nouvelle
- ✅ Multi choice : plusieurs options OK
- ✅ `max_choices` respecté
- ✅ Vote anonyme : voter=NULL, fingerprint SHA-256
- ✅ Anti-doublon anonyme via fingerprint
- ✅ Statut draft/closed bloque le vote
- ✅ Fenêtre `starts_at` future bloque le vote
- ✅ Résultats cachés si `results_visible_before_close=False`
- ✅ Pourcentages calculés correctement

### 📁 [apps/events/tests/test_audience.py](apps/events/tests/test_audience.py)
Événements + audience
- ✅ Création avec `audience_mode=all` → EventAttendance pour tous les actifs
- ✅ Création avec `audience_mode=specific` → uniquement les invitees
- ✅ Refus `specific` sans invitees
- ✅ Changement d'audience préserve les pointages existants

## Total — Vue d'ensemble

| Fichier | Tests |
|---|---|
| `test_signature.py` | 6 |
| `test_fees.py` | 16 |
| `test_imports.py` | 9 |
| `test_approvals.py` | 13 |
| `test_contributions.py` | 7 |
| `test_session_generation.py` | 11 |
| `test_polls.py` | 13 |
| `test_audience.py` | 4 |
| **Total** | **~79 tests** |

## Bonne pratique : intégration CI

Pour bloquer les régressions au push, ajoute ce workflow `.github/workflows/django-tests.yml` :

```yaml
name: Django Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: tontine
          POSTGRES_PASSWORD: tontine_app_2025
          POSTGRES_DB: tontine_db
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12' }
      - name: Install
        run: |
          cd tontine_project
          pip install -r requirements.txt
      - name: Migrate + Test
        env:
          POSTGRES_HOST: localhost
          POSTGRES_PORT: 5432
          DJANGO_SETTINGS_MODULE: config.settings.dev
        run: |
          cd tontine_project
          python manage.py migrate
          python manage.py test apps -v 2
```

## Notes techniques

- Les tests utilisent `Django TestCase` qui rollback chaque test → BDD propre.
- `setUp()` recrée le `TestScenario` complet à chaque test pour l'isolation.
- Pour les tests qui touchent `WalletEntry`, `Transaction`, `Cycle`, `Session` : les helpers fixtures créent le minimum nécessaire pour ne pas dépendre de signals/post_save complexes.
- Les tests **n'utilisent pas FCM réel** ni Twilio (les services sont best-effort et catch silently).

## Ce qui n'est PAS couvert (à ajouter plus tard si besoin)

- Tests end-to-end frontend (Playwright/Cypress) — non couverts ici, on teste uniquement le backend
- Notifications FCM réelles (mockés best-effort)
- Génération PDF des bordereaux (le sign_receipt n'est pas dans cette suite, ça nécessite de mocker reportlab)
- Tier 2 (member.expel, member.suspend, member.transfer_founder, member.designate_bureau) — les handlers sont enregistrés mais pas testés explicitement
- Tier 3 (loan.approve, loan.modify, loan.write_off) — idem
- Tier 4 (cycle.close, session.cancel, election.validate_results) — idem (mais la mécanique triple est testée via un DummyHandler)

Ces ajouts complémentaires sont faisables en suivant les mêmes patterns que les tests existants.
