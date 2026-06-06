"""
Fixtures partagées pour tous les tests du projet.

Pattern de base :
    class MaClasseTest(TestCase):
        def setUp(self):
            self.scenario = TestScenario.build_full()
            # self.scenario.president, self.scenario.bureau1, self.scenario.bureau2,
            # self.scenario.member1, self.scenario.member2, self.scenario.association
"""
import secrets
from datetime import date, timedelta
from rest_framework.test import APIClient

from apps.core.models import Association, User
from apps.members.models import (
    Membership, Role, MemberRole, BureauPosition, BureauMember,
)


# 1x1 PNG transparent (le plus petit PNG valide)
TINY_PNG_DATAURL = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)


def _uniq(prefix="t"):
    return f"{prefix}-{secrets.token_hex(4)}"


def make_user(*, telephone=None, first_name="Jean", last_name="Test", email=None):
    user = User.objects.create(
        telephone=telephone or f"+237{secrets.randbelow(10**9):09d}",
        first_name=first_name,
        last_name=last_name,
        email=email,
        is_active=True,
    )
    return user


def make_association(*, name=None, slug=None):
    name = name or f"Tontine {_uniq()}"
    slug = slug or _uniq("asso")
    return Association.objects.create(name=name, slug=slug)


def make_membership(association, user=None, *, status='active', is_active=True, is_founder=False):
    user = user or make_user()
    return Membership.all_objects.create(
        association=association,
        user=user,
        status=status,
        is_active=is_active,
        is_founder=is_founder,
    )


def make_bureau_position(association, *, name="Président", slug="president"):
    """Crée la position si pas créée par les signals."""
    pos, _ = BureauPosition.all_objects.get_or_create(
        association=association, slug=slug, defaults={'name': name},
    )
    return pos


def assign_bureau(membership, position):
    return BureauMember.all_objects.create(
        association=membership.association,
        membership=membership,
        position=position,
        start_date=date.today(),
        is_active=True,
        designation_method='nomination',
    )


def make_authed_client(user, association):
    """APIClient déjà authentifié + header X-Tenant."""
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_TENANT=association.slug)
    return client


class TestScenario:
    """
    Scénario standard partagé : 1 association avec :
    - 1 président (`president`)
    - 2 autres membres bureau (`bureau1`, `bureau2`)
    - 3 membres simples (`member1`, `member2`, `member3`)

    Permet de tester double validation (Pres + Bureau1 + Bureau2 si triple),
    et toutes les variantes d'approbation/correction.
    """

    @classmethod
    def build_full(cls, *, slug=None):
        scenario = cls()
        scenario.association = make_association(slug=slug)

        # Positions bureau (les signals peuvent les avoir déjà créées)
        pos_president = make_bureau_position(scenario.association, name="Président", slug="president")
        pos_tresorier = make_bureau_position(scenario.association, name="Trésorier", slug="tresorier")
        pos_secretaire = make_bureau_position(scenario.association, name="Secrétaire Général", slug="secretaire-general")

        # Président
        scenario.president = make_membership(
            scenario.association,
            make_user(first_name="Paul", last_name="President", telephone=f"+237600{secrets.randbelow(1000000):06d}"),
            is_founder=True,
        )
        assign_bureau(scenario.president, pos_president)

        # Bureau 1 (Trésorier)
        scenario.bureau1 = make_membership(
            scenario.association,
            make_user(first_name="Marie", last_name="Tresoriere", telephone=f"+237601{secrets.randbelow(1000000):06d}"),
        )
        assign_bureau(scenario.bureau1, pos_tresorier)

        # Bureau 2 (Secrétaire)
        scenario.bureau2 = make_membership(
            scenario.association,
            make_user(first_name="Jean", last_name="Secretaire", telephone=f"+237602{secrets.randbelow(1000000):06d}"),
        )
        assign_bureau(scenario.bureau2, pos_secretaire)

        # Membres simples
        scenario.member1 = make_membership(
            scenario.association,
            make_user(first_name="Alice", last_name="Membre1", telephone=f"+237610{secrets.randbelow(1000000):06d}"),
        )
        scenario.member2 = make_membership(
            scenario.association,
            make_user(first_name="Bob", last_name="Membre2", telephone=f"+237611{secrets.randbelow(1000000):06d}"),
        )
        scenario.member3 = make_membership(
            scenario.association,
            make_user(first_name="Carla", last_name="Membre3", telephone=f"+237612{secrets.randbelow(1000000):06d}"),
        )

        return scenario

    def authed(self, membership):
        """Client API authentifié pour ce membership."""
        return make_authed_client(membership.user, self.association)
