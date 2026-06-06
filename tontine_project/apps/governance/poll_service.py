"""
Service pour la gestion des sondages (Poll) :
- Validation des votes
- Atomicité (lock pessimiste + incrément des compteurs)
- Anti-doublon (par voter ou par fingerprint anonyme)
- Gestion de la fenêtre d'ouverture (status + starts_at/ends_at)
"""
import hashlib
from django.db import transaction as db_transaction
from django.db.models import F
from django.utils import timezone


def _fingerprint(voter_id, poll_id) -> str:
    raw = f"{voter_id}:{poll_id}".encode('utf-8')
    return hashlib.sha256(raw).hexdigest()


def is_open_now(poll) -> bool:
    if poll.status != 'open':
        return False
    now = timezone.now()
    if poll.starts_at and now < poll.starts_at:
        return False
    if poll.ends_at and now > poll.ends_at:
        return False
    return True


def voter_has_voted(poll, voter) -> bool:
    """Vrai si ce membre a déjà voté sur ce sondage."""
    from apps.governance.models import PollVote
    if poll.is_anonymous:
        fp = _fingerprint(voter.id, poll.id)
        return PollVote.all_objects.filter(poll=poll, voter_fingerprint=fp).exists()
    return PollVote.all_objects.filter(poll=poll, voter=voter).exists()


@db_transaction.atomic
def cast_vote(*, poll, voter, option_ids: list[str]):
    """
    Crée les votes d'un membre, gère anti-doublon + atomicité des compteurs.

    Règles :
    - Le sondage doit être ouvert (status='open' + dans la fenêtre starts_at/ends_at)
    - single_choice : exactement 1 option
    - multi_choice  : 1+ options, respecte max_choices si défini
    - Toutes les options doivent appartenir au sondage
    - Si l'électeur a déjà voté et allow_change_vote=True, on supprime ses
      anciens votes et on décrémente les compteurs (atomique)
    - Si is_anonymous : on stocke voter=NULL mais voter_fingerprint pour
      l'anti-doublon
    """
    from apps.governance.models import Poll, PollOption, PollVote

    poll = Poll.all_objects.select_for_update().get(pk=poll.id)

    if not is_open_now(poll):
        raise ValueError("Ce sondage n'est pas ouvert au vote.")

    # Validation cardinalité
    if not option_ids:
        raise ValueError("Vous devez sélectionner au moins une option.")
    option_ids = list(dict.fromkeys(option_ids))  # dédoublonne en gardant l'ordre
    if poll.kind == Poll.Kind.SINGLE and len(option_ids) != 1:
        raise ValueError("Sondage à choix unique : sélectionnez exactement 1 option.")
    if poll.kind == Poll.Kind.MULTI and poll.max_choices and len(option_ids) > poll.max_choices:
        raise ValueError(
            f"Vous ne pouvez sélectionner que {poll.max_choices} options maximum."
        )

    # Toutes les options doivent appartenir au sondage
    options = list(
        PollOption.all_objects.select_for_update().filter(
            poll=poll, id__in=option_ids,
        )
    )
    if len(options) != len(option_ids):
        raise ValueError("Une ou plusieurs options sont invalides.")

    # Anti-doublon / changement de vote
    fp = _fingerprint(voter.id, poll.id) if poll.is_anonymous else ''
    if poll.is_anonymous:
        existing = PollVote.all_objects.select_for_update().filter(
            poll=poll, voter_fingerprint=fp,
        )
    else:
        existing = PollVote.all_objects.select_for_update().filter(
            poll=poll, voter=voter,
        )

    if existing.exists():
        if not poll.allow_change_vote:
            raise ValueError("Vous avez déjà voté sur ce sondage.")
        # Décrémenter les compteurs des anciennes options puis supprimer
        old_option_ids = list(existing.values_list('option_id', flat=True))
        for oid in old_option_ids:
            PollOption.all_objects.filter(pk=oid).update(
                votes_count=F('votes_count') - 1,
            )
        existing.delete()

    # Créer les nouveaux votes + incrémenter les compteurs
    new_votes = []
    for opt in options:
        new_votes.append(PollVote.all_objects.create(
            association=poll.association,
            poll=poll,
            option=opt,
            voter=None if poll.is_anonymous else voter,
            voter_fingerprint=fp,
        ))
        PollOption.all_objects.filter(pk=opt.pk).update(
            votes_count=F('votes_count') + 1,
        )

    return new_votes


def aggregate_results(poll) -> dict:
    """Renvoie les compteurs agrégés. Si results_visible_before_close=False
    et que le poll n'est pas clos, ne renvoie pas les chiffres."""
    from apps.governance.models import PollOption
    options = list(PollOption.all_objects.filter(poll=poll).order_by('display_order', 'created_at'))
    show = poll.status in ('closed',) or poll.results_visible_before_close

    total_votes = sum(o.votes_count for o in options)
    return {
        'poll_id': str(poll.id),
        'total_votes': total_votes if show else None,
        'visible': show,
        'options': [
            {
                'id': str(o.id),
                'label': o.label,
                'votes_count': o.votes_count if show else None,
                'percentage': (
                    (o.votes_count / total_votes * 100) if (show and total_votes > 0) else 0
                ),
            }
            for o in options
        ],
    }
