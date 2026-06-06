"""
Tests pour l'action `set_signature` sur MembershipViewSet.

Garde-fou contre la régression du 404 sur :
    POST /api/members/memberships/{id}/signature/

Ce test échoue dès que l'action est supprimée par mégarde, ce qui force
le mainteneur à comprendre pourquoi l'enregistrement de signature
ne fonctionne plus avant de pouvoir merge.
"""
import base64
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Association, User
from apps.members.models import Membership


# 1x1 PNG transparent (le plus petit PNG valide)
TINY_PNG_BASE64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
)
TINY_PNG_DATAURL = f"data:image/png;base64,{TINY_PNG_BASE64}"


class MembershipSignatureEndpointTests(TestCase):
    """L'endpoint doit exister, accepter des PNG base64, refuser sinon."""

    def setUp(self):
        self.association = Association.objects.create(
            name="Test Tontine", slug="test-tontine",
        )
        self.user = User.objects.create(
            telephone="+237699999999", first_name="Jean", last_name="Test",
            is_active=True,
        )
        self.membership = Membership.objects.create(
            association=self.association,
            user=self.user,
            status=Membership.Status.ACTIVE,
            is_active=True,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        # Multi-tenant : header X-Tenant requis par le middleware
        self.client.credentials(HTTP_X_TENANT=self.association.slug)

        self.url = f"/api/members/memberships/{self.membership.id}/signature/"

    # ─── Garde-fou principal : l'endpoint EXISTE ────────────────────
    def test_signature_endpoint_is_registered(self):
        """Régression : la route doit exister (ne pas renvoyer 404)."""
        response = self.client.post(self.url, {
            "signature": TINY_PNG_DATAURL,
        }, format="json")
        # Peu importe le code exact (200/400), l'important est que ce
        # ne soit PAS un 404 (endpoint manquant).
        self.assertNotEqual(
            response.status_code, status.HTTP_404_NOT_FOUND,
            f"L'endpoint /api/members/memberships/{{id}}/signature/ doit exister. "
            f"Status reçu : {response.status_code}. "
            f"Body : {response.content[:200]}",
        )

    # ─── Cas nominal : un membre signe sa propre fiche ──────────────
    def test_member_can_save_own_signature(self):
        response = self.client.post(self.url, {
            "signature": TINY_PNG_DATAURL,
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.membership.refresh_from_db()
        self.assertTrue(bool(self.membership.signature_reference))
        self.assertIsNotNone(self.membership.signature_reference_at)

    # ─── Validation : refus si payload invalide ─────────────────────
    def test_rejects_missing_signature(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_non_dataurl_signature(self):
        response = self.client.post(self.url, {
            "signature": "not-a-dataurl",
        }, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rejects_corrupted_base64(self):
        response = self.client.post(self.url, {
            "signature": "data:image/png;base64,not-real-base64!!!",
        }, format="json")
        # Soit 400 (rejet propre), soit autre erreur — mais pas 200
        self.assertNotEqual(response.status_code, status.HTTP_200_OK)

    # ─── Sécurité : un membre étranger ne peut PAS signer ──────────
    def test_other_member_without_bureau_cannot_sign(self):
        other_user = User.objects.create(
            telephone="+237688888888", first_name="Autre",
            is_active=True,
        )
        Membership.objects.create(
            association=self.association, user=other_user,
            status=Membership.Status.ACTIVE, is_active=True,
        )
        client = APIClient()
        client.force_authenticate(user=other_user)
        client.credentials(HTTP_X_TENANT=self.association.slug)

        response = client.post(self.url, {
            "signature": TINY_PNG_DATAURL,
        }, format="json")
        self.assertIn(
            response.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED),
            "Un membre sans autorité bureau ne doit pas pouvoir signer "
            "pour un autre membre.",
        )
