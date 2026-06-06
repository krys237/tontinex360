"""
Handlers d'approbation :
- Tier 1 (Argent) — double validation
- Tier 2 (Membres) — double validation
- Tier 3 (Prêts) — double validation
- Tier 4 (Cycles) — TRIPLE validation (Président + 2 bureau distincts)

Importé automatiquement par `ApprovalsConfig.ready()` pour peupler le registry.
"""
from decimal import Decimal, InvalidOperation
from django.db import transaction as db_transaction
from django.utils import timezone

from apps.approvals.registry import register_handler, BaseApprovalHandler


# ─── helpers communs ────────────────────────────────────────────────
def _parse_decimal(value, *, min_value=None, allow_zero=True) -> Decimal:
    try:
        d = Decimal(str(value))
    except (InvalidOperation, TypeError):
        raise ValueError(f"Montant invalide : {value!r}")
    if not allow_zero and d == 0:
        raise ValueError("Le montant ne peut pas être 0.")
    if d < 0:
        raise ValueError("Le montant doit être positif.")
    if min_value is not None and d < min_value:
        raise ValueError(f"Montant inférieur au minimum autorisé ({min_value}).")
    return d


# ─── 1. LoanRepayment.correction ────────────────────────────────────
@register_handler('loan_repayment.correction')
class LoanRepaymentCorrectionHandler(BaseApprovalHandler):
    target_model_label = 'finance.LoanRepayment'
    human_label = "Correction d'un remboursement de prêt"

    def get_target_object(self, target_id, association):
        from apps.finance.models import LoanRepayment
        return LoanRepayment.all_objects.filter(
            id=target_id, association=association,
        ).select_related('loan').first()

    def validate(self, association, target, payload, requested_by):
        if target.receipt_pdf:
            raise ValueError(
                "Bordereau signé — utilisez la procédure d'annulation."
            )
        new_amount = _parse_decimal(payload.get('new_amount'), allow_zero=False)
        if new_amount == target.amount:
            raise ValueError("Le montant proposé est identique au montant actuel.")
        payload['new_amount'] = str(new_amount)  # normalise

    def snapshot(self, target):
        return {
            'amount': str(target.amount),
            'loan_id': str(target.loan_id),
            'paid_at': target.paid_at.isoformat() if target.paid_at else None,
        }

    def summary(self, target, payload):
        return (
            f"Correction remboursement prêt : {target.amount} → "
            f"{payload.get('new_amount')} XAF"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.finance.models import LoanRepayment, Loan
        repayment = LoanRepayment.all_objects.select_for_update().get(pk=req.target_id)
        if repayment.receipt_pdf:
            raise ValueError("Bordereau signé entre-temps — opération annulée.")

        old_amount = Decimal(repayment.amount)
        new_amount = Decimal(req.payload['new_amount'])
        delta = new_amount - old_amount

        repayment.amount = new_amount
        repayment.save(update_fields=['amount', 'updated_at'])

        # Mise à jour du total_repaid du prêt parent
        loan = Loan.all_objects.select_for_update().get(pk=repayment.loan_id)
        loan.total_repaid = (loan.total_repaid or Decimal('0')) + delta
        if loan.total_repaid >= loan.total_due:
            loan.status = Loan.Status.REPAID
        loan.save(update_fields=['total_repaid', 'status', 'updated_at'])

        return {
            'repayment_id': str(repayment.id),
            'old_amount': str(old_amount),
            'new_amount': str(new_amount),
            'delta': str(delta),
            'loan_id': str(loan.id),
            'loan_new_total_repaid': str(loan.total_repaid),
        }


# ─── 2. Sanction.correction (montant ou statut) ─────────────────────
@register_handler('sanction.correction')
class SanctionCorrectionHandler(BaseApprovalHandler):
    target_model_label = 'sanctions.Sanction'
    human_label = "Correction / annulation d'une sanction"

    VALID_STATUSES = ('pending', 'paid', 'waived', 'contested')

    def get_target_object(self, target_id, association):
        from apps.sanctions.models import Sanction
        return Sanction.all_objects.filter(
            id=target_id, association=association,
        ).select_related('sanction_type', 'membership__user').first()

    def validate(self, association, target, payload, requested_by):
        if target.receipt_pdf:
            raise ValueError("Bordereau signé — sanction verrouillée.")

        changed = False
        if 'new_amount' in payload:
            new_amount = _parse_decimal(payload['new_amount'])
            payload['new_amount'] = str(new_amount)
            if new_amount != Decimal(target.amount):
                changed = True

        if 'new_status' in payload:
            new_status = payload['new_status']
            if new_status not in self.VALID_STATUSES:
                raise ValueError(f"Statut invalide : {new_status}")
            if new_status != target.status:
                changed = True

        if not changed:
            raise ValueError("Aucun changement détecté.")

    def snapshot(self, target):
        return {'amount': str(target.amount), 'status': target.status}

    def summary(self, target, payload):
        bits = []
        if 'new_amount' in payload:
            bits.append(f"montant : {target.amount} → {payload['new_amount']}")
        if 'new_status' in payload:
            bits.append(f"statut : {target.status} → {payload['new_status']}")
        member_name = (
            f"{target.membership.user.first_name} {target.membership.user.last_name}"
            if target.membership and target.membership.user else "—"
        )
        return f"Sanction {member_name} ({target.sanction_type.name}) — " + ", ".join(bits)

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.sanctions.models import Sanction
        sanction = Sanction.all_objects.select_for_update().get(pk=req.target_id)
        if sanction.receipt_pdf:
            raise ValueError("Bordereau signé entre-temps — opération annulée.")

        side = {'sanction_id': str(sanction.id)}
        if 'new_amount' in req.payload:
            side['old_amount'] = str(sanction.amount)
            sanction.amount = Decimal(req.payload['new_amount'])
            side['new_amount'] = str(sanction.amount)

        if 'new_status' in req.payload:
            side['old_status'] = sanction.status
            sanction.status = req.payload['new_status']
            side['new_status'] = sanction.status
            if sanction.status == 'paid' and not sanction.paid_at:
                sanction.paid_at = timezone.now()
            elif sanction.status != 'paid':
                sanction.paid_at = None

        sanction.save(update_fields=['amount', 'status', 'paid_at', 'updated_at'])
        return side


# ─── 3. Wallet.manual_adjustment ────────────────────────────────────
@register_handler('wallet.manual_adjustment')
class WalletManualAdjustmentHandler(BaseApprovalHandler):
    target_model_label = 'wallets.Wallet'
    human_label = "Ajustement manuel d'un portefeuille"

    def get_target_object(self, target_id, association):
        from apps.wallets.models import Wallet
        return Wallet.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user').first()

    def validate(self, association, target, payload, requested_by):
        if target.is_frozen:
            raise ValueError("Ce portefeuille est gelé — ajustement refusé.")

        direction = payload.get('direction')
        if direction not in ('credit', 'debit'):
            raise ValueError("direction doit être 'credit' ou 'debit'.")
        _parse_decimal(payload.get('amount'), allow_zero=False)
        description = (payload.get('description') or '').strip()
        if len(description) < 5:
            raise ValueError("La description doit faire au moins 5 caractères.")
        payload['description'] = description

    def snapshot(self, target):
        return {'balance_before': str(target.balance)}

    def summary(self, target, payload):
        member_name = (
            f"{target.membership.user.first_name} {target.membership.user.last_name}"
            if target.membership and target.membership.user else "—"
        )
        sign = '+' if payload.get('direction') == 'credit' else '−'
        return (
            f"Ajustement {member_name} : {sign}{payload.get('amount')} XAF "
            f"({payload.get('description')})"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.wallets.models import Wallet, WalletEntry
        from apps.wallets.services import _apply_to_wallet

        wallet = Wallet.all_objects.select_for_update().get(pk=req.target_id)
        if wallet.is_frozen:
            raise ValueError("Portefeuille gelé entre-temps.")

        amount = Decimal(req.payload['amount'])
        direction = req.payload['direction']
        entry = _apply_to_wallet(
            wallet=wallet,
            direction=direction,
            amount=amount,
            source_type=WalletEntry.Source.MANUAL_ADJUSTMENT,
            source_id=req.id,
            description=req.payload.get('description', ''),
        )
        return {
            'wallet_id': str(wallet.id),
            'entry_id': str(entry.id) if entry else None,
            'balance_after': str(wallet.balance),
        }


# ─── 4. BeneficiaryPayout.correction ─────────────────────────────────
@register_handler('beneficiary_payout.correction')
class BeneficiaryPayoutCorrectionHandler(BaseApprovalHandler):
    target_model_label = 'cycles.BeneficiaryPayout'
    human_label = "Correction d'un versement bénéficiaire"

    VALID_METHODS = ('cash', 'mobile_money', 'bank_transfer', 'check')
    VALID_STATUSES = ('pending', 'paid', 'cancelled')

    def get_target_object(self, target_id, association):
        from apps.cycles.models import BeneficiaryPayout
        return BeneficiaryPayout.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user', 'pot__session').first()

    def validate(self, association, target, payload, requested_by):
        if target.receipt_pdf:
            raise ValueError("Bordereau signé — versement verrouillé.")

        changed = False
        if 'new_amount' in payload:
            new_amount = _parse_decimal(payload['new_amount'], allow_zero=False)
            payload['new_amount'] = str(new_amount)
            if new_amount != Decimal(target.amount):
                changed = True

        if 'new_payout_method' in payload:
            if payload['new_payout_method'] not in self.VALID_METHODS:
                raise ValueError("Méthode de versement invalide.")
            if payload['new_payout_method'] != target.payout_method:
                changed = True

        if 'new_status' in payload:
            if payload['new_status'] not in self.VALID_STATUSES:
                raise ValueError("Statut de versement invalide.")
            if payload['new_status'] != target.status:
                changed = True

        if not changed:
            raise ValueError("Aucun changement détecté.")

    def snapshot(self, target):
        return {
            'amount': str(target.amount),
            'payout_method': target.payout_method,
            'status': target.status,
        }

    def summary(self, target, payload):
        bits = []
        if 'new_amount' in payload:
            bits.append(f"montant : {target.amount} → {payload['new_amount']}")
        if 'new_payout_method' in payload:
            bits.append(f"méthode : {target.payout_method} → {payload['new_payout_method']}")
        if 'new_status' in payload:
            bits.append(f"statut : {target.status} → {payload['new_status']}")
        member_name = (
            f"{target.membership.user.first_name} {target.membership.user.last_name}"
            if target.membership and target.membership.user else "—"
        )
        return f"Versement {member_name} — " + ", ".join(bits)

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.cycles.models import BeneficiaryPayout
        payout = BeneficiaryPayout.all_objects.select_for_update().get(pk=req.target_id)
        if payout.receipt_pdf:
            raise ValueError("Bordereau signé entre-temps — opération annulée.")

        side = {'payout_id': str(payout.id)}
        update_fields = []
        if 'new_amount' in req.payload:
            side['old_amount'] = str(payout.amount)
            payout.amount = Decimal(req.payload['new_amount'])
            side['new_amount'] = str(payout.amount)
            update_fields.append('amount')
        if 'new_payout_method' in req.payload:
            side['old_method'] = payout.payout_method
            payout.payout_method = req.payload['new_payout_method']
            side['new_method'] = payout.payout_method
            update_fields.append('payout_method')
        if 'new_status' in req.payload:
            side['old_status'] = payout.status
            payout.status = req.payload['new_status']
            side['new_status'] = payout.status
            if payout.status == 'paid' and not payout.paid_at:
                payout.paid_at = timezone.now()
                update_fields.append('paid_at')
            update_fields.append('status')
        update_fields.append('updated_at')
        payout.save(update_fields=update_fields)
        return side


# ═══════════════════════════════════════════════════════════════════════
# ─── TIER 2 — MEMBRES ─────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def _member_label(membership):
    try:
        u = membership.user
        return f"{u.first_name} {u.last_name}".strip() or u.telephone
    except Exception:
        return str(membership.id)


def _freeze_member_wallet(membership):
    """Gèle le portefeuille du membre s'il existe."""
    from apps.wallets.models import Wallet
    w = Wallet.all_objects.filter(membership=membership).first()
    if w and not w.is_frozen:
        w.is_frozen = True
        w.save(update_fields=['is_frozen', 'updated_at'])
        return str(w.id)
    return None


def _deactivate_bureau_positions(membership):
    """Désactive toutes les positions bureau actives du membre. Retourne la liste des ids."""
    from apps.members.models import BureauMember
    deactivated = []
    bms = BureauMember.all_objects.filter(membership=membership, is_active=True)
    for bm in bms:
        bm.is_active = False
        bm.end_date = timezone.now().date()
        bm.save(update_fields=['is_active', 'end_date', 'updated_at'])
        deactivated.append(str(bm.id))
    return deactivated


# ─── 5. Member.expel ────────────────────────────────────────────────
@register_handler('member.expel')
class MemberExpelHandler(BaseApprovalHandler):
    target_model_label = 'members.Membership'
    human_label = "Expulsion d'un membre"

    def get_target_object(self, target_id, association):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            id=target_id, association=association,
        ).select_related('user').first()

    def validate(self, association, target, payload, requested_by):
        if target.status == 'expelled':
            raise ValueError("Ce membre est déjà expulsé.")
        if target.is_founder:
            raise ValueError(
                "Le fondateur ne peut pas être expulsé. Effectuez d'abord un "
                "transfert du statut de fondateur (member.transfer_founder)."
            )
        if requested_by and target.id == requested_by.id:
            raise PermissionError("Vous ne pouvez pas demander votre propre expulsion.")

    def snapshot(self, target):
        return {
            'status': target.status,
            'is_active': target.is_active,
            'member_number': target.member_number,
        }

    def summary(self, target, payload):
        return f"Expulsion de {_member_label(target)}"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.members.models import Membership
        membership = Membership.all_objects.select_for_update().get(pk=req.target_id)
        if membership.is_founder:
            raise ValueError("Devenu fondateur entre-temps — opération annulée.")

        side = {
            'membership_id': str(membership.id),
            'old_status': membership.status,
        }
        membership.status = Membership.Status.EXPELLED
        membership.is_active = False
        membership.save(update_fields=['status', 'is_active', 'updated_at'])

        side['wallet_frozen'] = _freeze_member_wallet(membership)
        side['bureau_positions_deactivated'] = _deactivate_bureau_positions(membership)
        return side


# ─── 6. Member.suspend ──────────────────────────────────────────────
@register_handler('member.suspend')
class MemberSuspendHandler(BaseApprovalHandler):
    target_model_label = 'members.Membership'
    human_label = "Suspension d'un membre"

    def get_target_object(self, target_id, association):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            id=target_id, association=association,
        ).select_related('user').first()

    def validate(self, association, target, payload, requested_by):
        action = payload.get('action')
        if action not in ('suspend', 'unsuspend'):
            raise ValueError("`action` doit être 'suspend' ou 'unsuspend'.")
        if action == 'suspend':
            if target.status == 'suspended':
                raise ValueError("Ce membre est déjà suspendu.")
            if target.is_founder:
                raise ValueError("Le fondateur ne peut pas être suspendu.")
        else:
            if target.status != 'suspended':
                raise ValueError("Ce membre n'est pas suspendu, impossible de lever la suspension.")
        if requested_by and target.id == requested_by.id:
            raise PermissionError("Vous ne pouvez pas demander votre propre suspension.")

    def snapshot(self, target):
        return {'status': target.status, 'is_active': target.is_active}

    def summary(self, target, payload):
        verb = "Suspension" if payload.get('action') == 'suspend' else "Levée de suspension"
        return f"{verb} de {_member_label(target)}"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.members.models import Membership
        membership = Membership.all_objects.select_for_update().get(pk=req.target_id)
        action = req.payload['action']
        side = {
            'membership_id': str(membership.id),
            'old_status': membership.status,
            'action': action,
        }
        if action == 'suspend':
            membership.status = Membership.Status.SUSPENDED
            membership.is_active = False
        else:
            membership.status = Membership.Status.ACTIVE
            membership.is_active = True
        membership.save(update_fields=['status', 'is_active', 'updated_at'])
        side['new_status'] = membership.status
        return side


# ─── 7. Member.transfer_founder ─────────────────────────────────────
@register_handler('member.transfer_founder')
class FounderTransferHandler(BaseApprovalHandler):
    """
    Transfert IRRÉVERSIBLE du statut de fondateur vers un autre membre.
    target_id = id du futur fondateur.
    payload = {} (aucun paramètre nécessaire — le current_founder est résolu par l'association).
    """
    target_model_label = 'members.Membership'
    human_label = "Transfert du statut de fondateur"

    def get_target_object(self, target_id, association):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            id=target_id, association=association,
        ).select_related('user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.members.models import Membership
        if target.is_founder:
            raise ValueError("Ce membre est déjà le fondateur.")
        if target.status != 'active' or not target.is_active:
            raise ValueError("Le futur fondateur doit être un membre actif.")
        current_founder = Membership.all_objects.filter(
            association=association, is_founder=True,
        ).first()
        if not current_founder:
            raise ValueError("Aucun fondateur actuel — état incohérent, contactez le support.")
        if current_founder.id == target.id:
            raise ValueError("Le futur fondateur est identique au fondateur actuel.")

    def snapshot(self, target):
        from apps.members.models import Membership
        current_founder = Membership.all_objects.filter(
            association=target.association, is_founder=True,
        ).first()
        return {
            'current_founder_id': str(current_founder.id) if current_founder else None,
            'current_founder_name': _member_label(current_founder) if current_founder else None,
            'incoming_founder_id': str(target.id),
            'incoming_founder_name': _member_label(target),
        }

    def summary(self, target, payload):
        return f"Transfert du statut de fondateur vers {_member_label(target)}"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.members.models import Membership
        incoming = Membership.all_objects.select_for_update().get(pk=req.target_id)
        current_founder = Membership.all_objects.select_for_update().filter(
            association=req.association, is_founder=True,
        ).first()
        if not current_founder:
            raise ValueError("Aucun fondateur actuel — opération annulée.")
        if current_founder.id == incoming.id:
            raise ValueError("Incohérence détectée — opération annulée.")

        current_founder.is_founder = False
        current_founder.save(update_fields=['is_founder', 'updated_at'])

        incoming.is_founder = True
        if incoming.status != 'active':
            incoming.status = Membership.Status.ACTIVE
            incoming.is_active = True
            incoming.save(update_fields=['is_founder', 'status', 'is_active', 'updated_at'])
        else:
            incoming.save(update_fields=['is_founder', 'updated_at'])

        return {
            'previous_founder_id': str(current_founder.id),
            'new_founder_id': str(incoming.id),
        }


# ─── 8. Member.designate_bureau ─────────────────────────────────────
@register_handler('member.designate_bureau')
class BureauDesignationHandler(BaseApprovalHandler):
    """
    Nomination ou révocation d'un membre du bureau **hors processus d'élection**.

    target_id = id du membre concerné.
    payload   = {
        'action': 'assign' | 'revoke',
        'position_id': UUID (si assign),
        'cycle_id'   : UUID optionnel,
        'bureau_member_id': UUID (si revoke),
    }
    """
    target_model_label = 'members.Membership'
    human_label = "Désignation/révocation bureau hors élection"

    def get_target_object(self, target_id, association):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            id=target_id, association=association,
        ).select_related('user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.members.models import BureauPosition, BureauMember
        action = payload.get('action')
        if action not in ('assign', 'revoke'):
            raise ValueError("`action` doit être 'assign' ou 'revoke'.")

        if action == 'assign':
            if target.status != 'active' or not target.is_active:
                raise ValueError("Membre inactif — impossible de l'assigner au bureau.")
            position_id = payload.get('position_id')
            if not position_id:
                raise ValueError("`position_id` requis pour une assignation.")
            position = BureauPosition.all_objects.filter(
                id=position_id, association=association,
            ).first()
            if not position:
                raise ValueError("Position bureau introuvable.")
            # Éviter doublon actif sur même position dans même cycle
            cycle_id = payload.get('cycle_id')
            dup = BureauMember.all_objects.filter(
                association=association, membership=target,
                position=position, is_active=True, cycle_id=cycle_id,
            ).exists()
            if dup:
                raise ValueError("Ce membre détient déjà cette position dans ce cycle.")

        else:  # revoke
            bm_id = payload.get('bureau_member_id')
            if not bm_id:
                raise ValueError("`bureau_member_id` requis pour une révocation.")
            bm = BureauMember.all_objects.filter(
                id=bm_id, association=association, membership=target, is_active=True,
            ).first()
            if not bm:
                raise ValueError("Mandat bureau actif introuvable pour ce membre.")

    def snapshot(self, target):
        from apps.members.models import BureauMember
        active = list(BureauMember.all_objects.filter(
            membership=target, is_active=True,
        ).values_list('position__name', flat=True))
        return {'current_positions': active}

    def summary(self, target, payload):
        if payload.get('action') == 'assign':
            return f"Désignation de {_member_label(target)} au bureau (hors élection)"
        return f"Révocation de {_member_label(target)} d'une position bureau (hors élection)"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.members.models import Membership, BureauMember, BureauPosition
        target = Membership.all_objects.select_for_update().get(pk=req.target_id)
        action = req.payload['action']
        side = {'membership_id': str(target.id), 'action': action}

        if action == 'assign':
            position = BureauPosition.all_objects.get(pk=req.payload['position_id'])
            bm = BureauMember.all_objects.create(
                association=req.association,
                membership=target,
                position=position,
                cycle_id=req.payload.get('cycle_id'),
                start_date=timezone.now().date(),
                is_active=True,
                designation_method='nomination',
            )
            side['bureau_member_id'] = str(bm.id)
            side['position_slug'] = position.slug
        else:
            bm = BureauMember.all_objects.select_for_update().get(pk=req.payload['bureau_member_id'])
            bm.is_active = False
            bm.end_date = timezone.now().date()
            bm.save(update_fields=['is_active', 'end_date', 'updated_at'])
            side['bureau_member_id'] = str(bm.id)
            side['revoked_position_slug'] = bm.position.slug
        return side


# ═══════════════════════════════════════════════════════════════════════
# ─── TIER 3 — PRÊTS ───────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

LOAN_DISBURSEMENT_REFERENCE_PREFIX = 'loan_out:'


def _loan_label(loan):
    try:
        m = loan.membership
        u = m.user
        return f"{u.first_name} {u.last_name}".strip() or u.telephone
    except Exception:
        return str(loan.id)


def _resolve_treasury_account(association, account_id=None):
    """Caisse ciblée (par id ou fallback cash active de l'association)."""
    from apps.finance.models import TreasuryAccount
    qs = TreasuryAccount.all_objects.filter(association=association, is_active=True)
    if account_id:
        match = qs.filter(id=account_id).first()
        if match:
            return match
    cash = qs.filter(account_type=TreasuryAccount.AccountType.CASH).first()
    return cash or qs.first()


# ─── 9. Loan.approve ────────────────────────────────────────────────
@register_handler('loan.approve')
class LoanApprovalHandler(BaseApprovalHandler):
    """
    Approuve une demande de prêt et déclenche le décaissement effectif :
    - status -> 'disbursed'
    - Transaction comptable type=loan_out (débit caisse)
    - approved_by = applied_by

    payload optionnel : { 'treasury_account': UUID }
    """
    target_model_label = 'finance.Loan'
    human_label = "Approbation et décaissement d'un prêt"

    def get_target_object(self, target_id, association):
        from apps.finance.models import Loan
        return Loan.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.finance.models import Loan
        if target.status != Loan.Status.PENDING:
            raise ValueError(
                f"Seuls les prêts en attente peuvent être approuvés "
                f"(statut actuel : {target.status})."
            )
        if not target.amount or Decimal(target.amount) <= 0:
            raise ValueError("Montant du prêt invalide.")
        if requested_by and target.membership_id == requested_by.id:
            raise PermissionError(
                "Vous ne pouvez pas demander l'approbation de votre propre prêt."
            )

    def snapshot(self, target):
        return {
            'status': target.status,
            'amount': str(target.amount),
            'interest_rate': str(target.interest_rate),
            'total_due': str(target.total_due),
            'due_date': target.due_date.isoformat() if target.due_date else None,
        }

    def summary(self, target, payload):
        return (
            f"Approbation prêt de {_loan_label(target)} — "
            f"{target.amount} XAF (échéance {target.due_date or '—'})"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.finance.models import Loan, Transaction
        from apps.finance.services import TontineFundService
        loan = Loan.all_objects.select_for_update().get(pk=req.target_id)
        if loan.status != Loan.Status.PENDING:
            raise ValueError(
                f"Statut a changé entre-temps ({loan.status}) — opération annulée."
            )

        account = _resolve_treasury_account(
            req.association, req.payload.get('treasury_account'),
        )
        if account is None:
            raise ValueError(
                "Aucune caisse active disponible pour le décaissement."
            )

        # Idempotence : ne pas créer 2 fois la même transaction de décaissement
        reference = f"{LOAN_DISBURSEMENT_REFERENCE_PREFIX}{loan.id}"
        existing = Transaction.all_objects.filter(
            association=req.association, reference=reference,
            transaction_type=Transaction.TransactionType.LOAN_OUT,
        ).first()

        tx = existing or TontineFundService.create_transaction(
            association=req.association,
            account=account,
            tontine_type=None,  # prêt issu de la trésorerie générale
            transaction_type=Transaction.TransactionType.LOAN_OUT,
            amount=Decimal(loan.amount),
            is_debit=True,
            description=(
                f"Décaissement prêt #{loan.id} à {_loan_label(loan)}"
            ),
            session=loan.session_granted,
            membership=loan.membership,
            recorded_by=applied_by,
            reference=reference,
            allow_overdraft=True,
        )

        loan.status = Loan.Status.DISBURSED
        loan.approved_by = applied_by
        loan.save(update_fields=['status', 'approved_by', 'updated_at'])

        return {
            'loan_id': str(loan.id),
            'new_status': loan.status,
            'transaction_id': str(tx.id),
            'transaction_amount': str(tx.amount),
            'account_id': str(account.id),
            'account_name': account.name,
        }


# ─── 10. Loan.modify ─────────────────────────────────────────────────
@register_handler('loan.modify')
class LoanModificationHandler(BaseApprovalHandler):
    """
    Modification d'un prêt existant : amount, interest_rate, due_date.
    Refusée s'il y a déjà des remboursements (sinon l'intégrité comptable est compromise).

    payload : { 'new_amount'?, 'new_interest_rate'?, 'new_due_date'? }
    """
    target_model_label = 'finance.Loan'
    human_label = "Modification d'un prêt"

    def get_target_object(self, target_id, association):
        from apps.finance.models import Loan
        return Loan.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.finance.models import Loan, LoanRepayment
        if target.status in (Loan.Status.REPAID, Loan.Status.DEFAULTED):
            raise ValueError("Prêt clôturé : modification impossible.")
        # Refuser si remboursements présents (intégrité comptable)
        if LoanRepayment.all_objects.filter(loan=target).exists():
            raise ValueError(
                "Ce prêt a déjà des remboursements enregistrés : "
                "modification du montant/taux impossible."
            )

        changed = False
        if 'new_amount' in payload:
            new_amount = _parse_decimal(payload['new_amount'], allow_zero=False)
            payload['new_amount'] = str(new_amount)
            if new_amount != Decimal(target.amount):
                changed = True

        if 'new_interest_rate' in payload:
            try:
                rate = Decimal(str(payload['new_interest_rate']))
            except Exception:
                raise ValueError("Taux d'intérêt invalide.")
            if rate < 0 or rate > 100:
                raise ValueError("Le taux doit être entre 0 et 100 %.")
            payload['new_interest_rate'] = str(rate)
            if rate != Decimal(target.interest_rate):
                changed = True

        if 'new_due_date' in payload:
            from datetime import date as _date
            try:
                _date.fromisoformat(payload['new_due_date'])
            except Exception:
                raise ValueError("Date d'échéance invalide (attendu YYYY-MM-DD).")
            if str(target.due_date) != payload['new_due_date']:
                changed = True

        if not changed:
            raise ValueError("Aucun changement détecté.")

    def snapshot(self, target):
        return {
            'amount': str(target.amount),
            'interest_rate': str(target.interest_rate),
            'total_due': str(target.total_due),
            'due_date': target.due_date.isoformat() if target.due_date else None,
        }

    def summary(self, target, payload):
        bits = []
        if 'new_amount' in payload:
            bits.append(f"montant : {target.amount} → {payload['new_amount']}")
        if 'new_interest_rate' in payload:
            bits.append(f"taux : {target.interest_rate}% → {payload['new_interest_rate']}%")
        if 'new_due_date' in payload:
            bits.append(f"échéance : {target.due_date or '—'} → {payload['new_due_date']}")
        return f"Modification prêt de {_loan_label(target)} — " + ", ".join(bits)

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.finance.models import Loan, LoanRepayment, Transaction
        loan = Loan.all_objects.select_for_update().get(pk=req.target_id)
        if LoanRepayment.all_objects.filter(loan=loan).exists():
            raise ValueError(
                "Des remboursements ont été enregistrés entre-temps — opération annulée."
            )

        side = {'loan_id': str(loan.id)}
        update_fields = []

        if 'new_amount' in req.payload:
            side['old_amount'] = str(loan.amount)
            loan.amount = Decimal(req.payload['new_amount'])
            side['new_amount'] = str(loan.amount)
            update_fields.append('amount')

        if 'new_interest_rate' in req.payload:
            side['old_interest_rate'] = str(loan.interest_rate)
            loan.interest_rate = Decimal(req.payload['new_interest_rate'])
            side['new_interest_rate'] = str(loan.interest_rate)
            update_fields.append('interest_rate')

        if 'new_due_date' in req.payload:
            from datetime import date as _date
            side['old_due_date'] = str(loan.due_date) if loan.due_date else None
            loan.due_date = _date.fromisoformat(req.payload['new_due_date'])
            side['new_due_date'] = str(loan.due_date)
            update_fields.append('due_date')

        # Recalcule total_due si amount ou rate ont changé
        if 'new_amount' in req.payload or 'new_interest_rate' in req.payload:
            loan.total_due = (
                Decimal(loan.amount)
                + (Decimal(loan.amount) * Decimal(loan.interest_rate) / Decimal('100'))
            )
            side['new_total_due'] = str(loan.total_due)
            update_fields.append('total_due')

        # Si déjà décaissé et qu'on change le montant, ajuster la transaction
        # comptable existante (création d'un ajustement plutôt que de modifier l'historique)
        if 'new_amount' in req.payload and loan.status in (
            Loan.Status.DISBURSED, Loan.Status.APPROVED, Loan.Status.REPAYING,
        ):
            from apps.finance.services import TontineFundService
            reference = f"{LOAN_DISBURSEMENT_REFERENCE_PREFIX}{loan.id}"
            prev_tx = Transaction.all_objects.filter(
                association=req.association, reference=reference,
                transaction_type=Transaction.TransactionType.LOAN_OUT,
            ).first()
            if prev_tx is not None:
                delta = Decimal(req.payload['new_amount']) - Decimal(side['old_amount'])
                if delta != 0:
                    adj = TontineFundService.create_transaction(
                        association=req.association,
                        account=prev_tx.account,
                        tontine_type=prev_tx.tontine_type,
                        transaction_type=Transaction.TransactionType.ADJUSTMENT,
                        amount=abs(delta),
                        is_debit=(delta > 0),  # si on augmente, on débite encore la caisse
                        description=(
                            f"Ajustement décaissement prêt #{loan.id} "
                            f"(delta : {delta})"
                        ),
                        session=loan.session_granted,
                        membership=loan.membership,
                        recorded_by=applied_by,
                        reference=f"loan_adjust:{loan.id}:{req.id}",
                        allow_overdraft=True,
                    )
                    side['adjustment_transaction_id'] = str(adj.id)
                    side['adjustment_delta'] = str(delta)

        update_fields.append('updated_at')
        loan.save(update_fields=update_fields)
        return side


# ─── 11. Loan.write_off ─────────────────────────────────────────────
@register_handler('loan.write_off')
class LoanWriteOffHandler(BaseApprovalHandler):
    """
    Déclare un prêt en défaut/radiation. Pas de nouvelle Transaction
    comptable (la perte est déjà reflétée par le décaissement initial
    sans remboursement complet).

    payload : { 'reason_detail'? } — la raison principale est sur `req.reason`.
    """
    target_model_label = 'finance.Loan'
    human_label = "Radiation / mise en défaut d'un prêt"

    def get_target_object(self, target_id, association):
        from apps.finance.models import Loan
        return Loan.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.finance.models import Loan
        if target.status == Loan.Status.REPAID:
            raise ValueError("Ce prêt est déjà entièrement remboursé.")
        if target.status == Loan.Status.DEFAULTED:
            raise ValueError("Ce prêt est déjà en défaut.")
        if target.status == Loan.Status.PENDING:
            raise ValueError(
                "Un prêt non encore décaissé ne peut être radié ; rejetez la "
                "demande d'approbation à la place."
            )

    def snapshot(self, target):
        from decimal import Decimal as _D
        remaining = _D(target.total_due) - _D(target.total_repaid)
        return {
            'status': target.status,
            'total_due': str(target.total_due),
            'total_repaid': str(target.total_repaid),
            'remaining_to_write_off': str(remaining),
        }

    def summary(self, target, payload):
        remaining = Decimal(target.total_due) - Decimal(target.total_repaid)
        return (
            f"Radiation prêt de {_loan_label(target)} — "
            f"perte comptable : {remaining} XAF"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.finance.models import Loan
        loan = Loan.all_objects.select_for_update().get(pk=req.target_id)
        if loan.status == Loan.Status.REPAID:
            raise ValueError("Prêt remboursé entre-temps — radiation impossible.")
        if loan.status == Loan.Status.DEFAULTED:
            raise ValueError("Déjà en défaut.")

        side = {
            'loan_id': str(loan.id),
            'old_status': loan.status,
            'remaining_to_write_off': str(
                Decimal(loan.total_due) - Decimal(loan.total_repaid),
            ),
        }
        loan.status = Loan.Status.DEFAULTED
        loan.save(update_fields=['status', 'updated_at'])
        side['new_status'] = loan.status
        return side


# ═══════════════════════════════════════════════════════════════════════
# ─── TIER 4 — CYCLES (TRIPLE VALIDATION) ──────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

# ─── 12. Cycle.close ────────────────────────────────────────────────
@register_handler('cycle.close')
class CycleClosureHandler(BaseApprovalHandler):
    """
    Clôture finale d'un cycle. Acte quasi-irréversible : on bascule le
    statut à `completed`, on fixe `end_date` à aujourd'hui si non fixé,
    et on désactive toutes les sessions encore programmées.

    Le règlement des wallets reste à exécuter explicitement via
    `CycleSettlementView` AVANT la clôture (recommandation opérationnelle).
    """
    target_model_label = 'cycles.Cycle'
    human_label = "Clôture d'un cycle"
    requires_triple_approval = True

    def get_target_object(self, target_id, association):
        from apps.cycles.models import Cycle
        return Cycle.all_objects.filter(
            id=target_id, association=association,
        ).first()

    def validate(self, association, target, payload, requested_by):
        from apps.cycles.models import Cycle
        if target.status == Cycle.Status.COMPLETED:
            raise ValueError("Ce cycle est déjà clôturé.")
        if target.status == Cycle.Status.CANCELLED:
            raise ValueError("Ce cycle est annulé, clôture impossible.")
        if target.status == Cycle.Status.DRAFT:
            raise ValueError(
                "Un cycle en brouillon ne peut être clôturé ; annulez-le à la place."
            )

    def snapshot(self, target):
        from apps.cycles.models import Session
        active_sessions = Session.all_objects.filter(
            cycle=target,
            status__in=[Session.Status.SCHEDULED, Session.Status.IN_PROGRESS],
        ).count()
        return {
            'status': target.status,
            'end_date': target.end_date.isoformat() if target.end_date else None,
            'active_sessions_count': active_sessions,
        }

    def summary(self, target, payload):
        return f"Clôture du cycle « {target.name} »"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.cycles.models import Cycle, Session
        cycle = Cycle.all_objects.select_for_update().get(pk=req.target_id)
        if cycle.status == Cycle.Status.COMPLETED:
            raise ValueError("Cycle déjà clôturé entre-temps.")

        side = {
            'cycle_id': str(cycle.id),
            'old_status': cycle.status,
        }
        cycle.status = Cycle.Status.COMPLETED
        if not cycle.end_date:
            cycle.end_date = timezone.now().date()
        cycle.save(update_fields=['status', 'end_date'])
        side['new_status'] = cycle.status
        side['end_date'] = cycle.end_date.isoformat()

        # Annule les sessions encore programmées (jamais tenues)
        cancelled = Session.all_objects.filter(
            cycle=cycle,
            status__in=[Session.Status.SCHEDULED],
        ).update(status=Session.Status.CANCELLED)
        side['sessions_cancelled'] = cancelled

        # ── Restitution banque scolaire (individual_savings) ──────────
        # Pour chaque tontine du cycle dont le pattern est `individual_savings`,
        # on génère un payout par membre cotisant = somme de ses cotisations.
        side['individual_savings_refunds'] = _generate_individual_savings_refunds(cycle)

        return side


def _generate_individual_savings_refunds(cycle):
    """
    Génère les payouts de restitution pour chaque tontine en mode
    « banque scolaire » (`payout_pattern='individual_savings'`).

    Pour chaque tontine concernée :
    - somme les cotisations payées par membre durant le cycle
    - crée/utilise un SessionPot sur la dernière séance terminée
    - crée un BeneficiaryPayout par membre (statut `pending`)

    Retourne un dict {tontine_name: nb_refunds_créés}.
    """
    from decimal import Decimal
    from apps.cycles.models import (
        CycleTontineConfig, Session, SessionPot, BeneficiaryPayout,
    )
    from apps.finance.models import Contribution
    from apps.tontines.models import TontineType
    from django.db.models import Sum

    summary = {}
    configs = CycleTontineConfig.all_objects.filter(
        cycle=cycle,
        tontine_type__payout_pattern=TontineType.PayoutPattern.INDIVIDUAL_SAVINGS,
    ).select_related('tontine_type')

    if not configs.exists():
        return summary

    # Dernière séance non annulée du cycle (sinon, la plus récente)
    last_session = Session.all_objects.filter(
        cycle=cycle,
    ).exclude(status=Session.Status.CANCELLED).order_by('-date', '-session_number').first()
    if not last_session:
        last_session = Session.all_objects.filter(
            cycle=cycle,
        ).order_by('-date', '-session_number').first()
    if not last_session:
        return summary  # cycle vide, rien à restituer

    for cfg in configs:
        tt = cfg.tontine_type
        # Cumul par membre sur toutes les séances du cycle
        cumulatives = (
            Contribution.all_objects
            .filter(
                session__cycle=cycle,
                tontine_type=tt,
                paid_amount__gt=0,
            )
            .values('membership')
            .annotate(total=Sum('paid_amount'))
        )

        refunds_count = 0
        for row in cumulatives:
            membership_id = row['membership']
            total = row['total'] or Decimal('0')
            if total <= 0:
                continue

            # Crée (ou récupère) le pot de la dernière séance pour cette tontine
            pot, _created = SessionPot.all_objects.get_or_create(
                session=last_session,
                tontine_type=tt,
                association=cycle.association,
                defaults={
                    'effective_method': 'manual',
                    'is_method_overridden': False,
                    'override_reason': 'Restitution banque scolaire (clôture cycle)',
                },
            )

            # Idempotence : ne pas re-créer un payout déjà en place pour ce membre
            already = BeneficiaryPayout.all_objects.filter(
                pot=pot, membership_id=membership_id,
            ).exists()
            if already:
                continue

            BeneficiaryPayout.all_objects.create(
                association=cycle.association,
                pot=pot,
                membership_id=membership_id,
                shares_claimed=1,
                shares_total=1,
                amount=total,
                acquisition_method=BeneficiaryPayout.AcquisitionMethod.MANUAL,
                status=BeneficiaryPayout.Status.PENDING,
                notes=(
                    f"Restitution banque scolaire — cumul des cotisations "
                    f"du cycle « {cycle.name} »"
                ),
                is_in_kind=(tt.contribution_kind == 'in_kind'),
                in_kind_unit_label=tt.in_kind_unit_label or '',
            )
            refunds_count += 1

        summary[tt.name] = refunds_count

    return summary


# ─── 13. Session.cancel ─────────────────────────────────────────────
@register_handler('session.cancel')
class SessionCancellationHandler(BaseApprovalHandler):
    """
    Annule une séance déjà programmée ou en cours.
    Impacts collatéraux possibles (sessions suivantes, cotisations non
    perçues) : à la charge du bureau de communiquer.
    """
    target_model_label = 'cycles.Session'
    human_label = "Annulation d'une séance"
    requires_triple_approval = True

    def get_target_object(self, target_id, association):
        from apps.cycles.models import Session
        return Session.all_objects.filter(
            id=target_id, association=association,
        ).select_related('cycle').first()

    def validate(self, association, target, payload, requested_by):
        from apps.cycles.models import Session
        if target.status == Session.Status.CANCELLED:
            raise ValueError("Cette séance est déjà annulée.")
        if target.status == Session.Status.COMPLETED:
            raise ValueError(
                "Une séance terminée ne peut pas être annulée. Pour modifier "
                "ses données, utilisez les corrections de cotisations/versements."
            )

    def snapshot(self, target):
        return {
            'status': target.status,
            'date': target.date.isoformat(),
            'session_number': target.session_number,
            'cycle_id': str(target.cycle_id),
        }

    def summary(self, target, payload):
        return (
            f"Annulation de la séance n°{target.session_number} "
            f"({target.date}) du cycle « {target.cycle.name } »"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.cycles.models import Session
        session = Session.all_objects.select_for_update().get(pk=req.target_id)
        if session.status == Session.Status.CANCELLED:
            raise ValueError("Séance déjà annulée entre-temps.")

        side = {
            'session_id': str(session.id),
            'old_status': session.status,
        }
        session.status = Session.Status.CANCELLED
        session.save(update_fields=['status'])
        side['new_status'] = session.status
        return side


# ─── 14. Election.validate_results ──────────────────────────────────
@register_handler('election.validate_results')
class ElectionResultsValidationHandler(BaseApprovalHandler):
    """
    Officialise les résultats d'une élection : marque l'élection comme
    `completed` et crée/active les `BureauMember` correspondants à partir
    des candidats `is_elected=True`.

    Les anciens BureauMember pour les mêmes (position, cycle) sont
    désactivés (`end_date = today`).

    payload : {} (les candidats élus sont déjà marqués sur ElectionCandidate)
    """
    target_model_label = 'governance.Election'
    human_label = "Validation des résultats d'une élection"
    requires_triple_approval = True

    def get_target_object(self, target_id, association):
        from apps.governance.models import Election
        return Election.all_objects.filter(
            id=target_id, association=association,
        ).select_related('cycle').first()

    def validate(self, association, target, payload, requested_by):
        from apps.governance.models import Election, ElectionCandidate
        if target.status == Election.Status.COMPLETED:
            raise ValueError("Résultats déjà validés.")
        if target.status == Election.Status.CANCELLED:
            raise ValueError("Élection annulée, validation impossible.")
        elected = ElectionCandidate.all_objects.filter(
            election=target, is_elected=True,
        ).count()
        if elected == 0:
            raise ValueError(
                "Aucun candidat marqué comme élu. Marquez d'abord les "
                "gagnants sur les candidats (is_elected=True)."
            )

    def snapshot(self, target):
        from apps.governance.models import ElectionCandidate
        elected = ElectionCandidate.all_objects.filter(
            election=target, is_elected=True,
        ).select_related('membership__user', 'position').values(
            'membership_id', 'position__name', 'position__slug', 'votes_count',
        )
        return {
            'election_status': target.status,
            'elected_candidates': list(elected),
        }

    def summary(self, target, payload):
        return f"Validation des résultats de l'élection « {target.title} »"

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.governance.models import Election, ElectionCandidate
        from apps.members.models import BureauMember
        election = Election.all_objects.select_for_update().get(pk=req.target_id)
        if election.status == Election.Status.COMPLETED:
            raise ValueError("Validation déjà appliquée entre-temps.")

        elected = ElectionCandidate.all_objects.filter(
            election=election, is_elected=True,
        ).select_related('membership', 'position')

        created_ids = []
        deactivated_ids = []
        for cand in elected:
            # Désactiver les anciens mandats actifs pour (position, cycle)
            prev = BureauMember.all_objects.filter(
                association=req.association,
                position=cand.position,
                cycle=election.cycle,
                is_active=True,
            )
            for bm in prev:
                bm.is_active = False
                bm.end_date = timezone.now().date()
                bm.save(update_fields=['is_active', 'end_date', 'updated_at'])
                deactivated_ids.append(str(bm.id))

            # Créer le nouveau mandat
            new_bm = BureauMember.all_objects.create(
                association=req.association,
                membership=cand.membership,
                position=cand.position,
                cycle=election.cycle,
                start_date=timezone.now().date(),
                is_active=True,
                designation_method='election',
            )
            created_ids.append(str(new_bm.id))

        election.status = Election.Status.COMPLETED
        election.save(update_fields=['status'])

        return {
            'election_id': str(election.id),
            'new_bureau_member_ids': created_ids,
            'deactivated_bureau_member_ids': deactivated_ids,
            'elected_count': len(created_ids),
        }


# ═══════════════════════════════════════════════════════════════════════
# ─── TIER 1 ADDITIONAL — EXONÉRATION FRAIS D'ADHÉSION ────────────────
# ═══════════════════════════════════════════════════════════════════════


@register_handler('membership_fee.waive')
class MembershipFeeWaiveHandler(BaseApprovalHandler):
    """
    Exonère un membre d'un MembershipFeePayment (inscription ou fond de membre).
    Double validation Président + Bureau requise (Tier 1).

    payload : { 'reason_detail'? } — la raison principale est sur req.reason
    """
    target_model_label = 'members.MembershipFeePayment'
    human_label = "Exonération de frais d'adhésion"

    def get_target_object(self, target_id, association):
        from apps.members.models import MembershipFeePayment
        return MembershipFeePayment.all_objects.filter(
            id=target_id, association=association,
        ).select_related('membership__user').first()

    def validate(self, association, target, payload, requested_by):
        from apps.members.models import MembershipFeePayment
        if target.status == MembershipFeePayment.Status.PAID:
            raise ValueError("Ce frais est déjà payé — exonération inutile.")
        if target.status == MembershipFeePayment.Status.WAIVED:
            raise ValueError("Ce frais est déjà exonéré.")
        # On peut exonérer un 'pending' OU un 'partial' (le bureau peut
        # décider d'arrêter les versements à mi-chemin)

    def snapshot(self, target):
        return {
            'fee_type': target.fee_type,
            'expected_amount': str(target.expected_amount),
            'paid_amount': str(target.paid_amount),
            'status': target.status,
            'member_id': str(target.membership_id),
        }

    def summary(self, target, payload):
        member_label = _member_label(target.membership)
        return (
            f"Exonération {target.get_fee_type_display()} pour {member_label} "
            f"(restant : {target.remaining_amount} XAF)"
        )

    @db_transaction.atomic
    def apply(self, req, applied_by):
        from apps.members import fees_service
        from apps.members.models import MembershipFeePayment
        target = MembershipFeePayment.all_objects.select_for_update().get(
            pk=req.target_id,
        )
        fees_service.waive_fee(target, waived_by=applied_by, reason=req.reason)
        return {
            'fee_payment_id': str(target.id),
            'fee_type': target.fee_type,
            'remaining_waived': str(target.remaining_amount),
            'membership_id': str(target.membership_id),
        }
