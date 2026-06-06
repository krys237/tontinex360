from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from common.mixins import TenantViewMixin
from common.permissions import IsAuthenticated, HasAssociation, IsMember
from apps.governance.models import (
    Document, Election, ElectionCandidate, Vote,
    Announcement, AnnouncementReadStatus,
    Poll, PollOption, PollVote,
)
from apps.governance.serializers import (
    DocumentSerializer, ElectionSerializer, ElectionCandidateSerializer, VoteSerializer,
    AnnouncementSerializer,
    PollSerializer, PollOptionSerializer,
)


class DocumentViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Document.all_objects.all()
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['doc_type', 'is_active']


class ElectionViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Election.all_objects.prefetch_related('candidates__membership__user', 'candidates__position')
    serializer_class = ElectionSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['cycle', 'status']

    # Validation des résultats = Tier 4 (triple validation)
    PROTECTED_STATUS_TRANSITIONS = ('completed',)

    def _guard_status(self, request, election):
        from apps.approvals.guards import reject_direct_write
        body = request.data if hasattr(request, 'data') else {}
        if 'status' not in body:
            return None
        if body.get('status') not in self.PROTECTED_STATUS_TRANSITIONS:
            return None
        return reject_direct_write(
            request,
            target_model='governance.Election',
            target_id=election.id,
            action_type='election.validate_results',
            protected_fields=('status',),
        )

    def update(self, request, *args, **kwargs):
        election = self.get_object()
        guard = self._guard_status(request, election)
        if guard is not None:
            return guard
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        election = self.get_object()
        guard = self._guard_status(request, election)
        if guard is not None:
            return guard
        return super().partial_update(request, *args, **kwargs)

    def perform_create(self, serializer):
        instance = serializer.save(association=self.request.association)
        # Notification à tous les membres actifs
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify_all_members(
                association=self.request.association,
                notification_type='election_started',
                title=f"Nouvelle élection : {instance.title}",
                body=(
                    f"Méthode : {instance.get_method_display()} · "
                    f"Date prévue : {instance.date}"
                ),
                data={'election_id': str(instance.id)},
            )
        except Exception:
            pass


class ElectionCandidateViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = ElectionCandidate.all_objects.select_related('membership__user', 'position')
    serializer_class = ElectionCandidateSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['election']

    @action(detail=False, methods=['post'], url_path='bulk-save-results')
    def bulk_save_results(self, request):
        """
        Saisie en bloc des résultats post-AG.
        Body : { election: <id>, results: [{candidate_id, votes_count, is_elected}, ...] }
        Met à jour candidates + bascule l'élection en 'completed' si demandé
        (avec triple validation via le workflow election.validate_results).
        """
        from django.db import transaction as db_transaction
        election_id = request.data.get('election')
        results = request.data.get('results') or []
        if not election_id or not isinstance(results, list):
            return Response({'error': 'election + results requis.'}, status=400)
        try:
            election = Election.all_objects.get(
                id=election_id, association=request.association,
            )
        except Election.DoesNotExist:
            return Response({'error': 'Election introuvable.'}, status=404)
        if election.status in ('completed', 'cancelled'):
            return Response(
                {'error': f"Election déjà {election.status}, modification impossible."},
                status=400,
            )

        updated = 0
        errors = []
        with db_transaction.atomic():
            for r in results:
                try:
                    c = ElectionCandidate.all_objects.select_for_update().get(
                        id=r.get('candidate_id'),
                        election=election,
                        association=request.association,
                    )
                except ElectionCandidate.DoesNotExist:
                    errors.append({'candidate_id': r.get('candidate_id'), 'error': 'Candidat introuvable.'})
                    continue
                try:
                    vc = int(r.get('votes_count', 0))
                    if vc < 0:
                        raise ValueError("votes_count négatif")
                except (TypeError, ValueError):
                    errors.append({'candidate_id': str(c.id), 'error': 'votes_count invalide.'})
                    continue
                c.votes_count = vc
                c.is_elected = bool(r.get('is_elected', False))
                c.save(update_fields=['votes_count', 'is_elected', 'updated_at'])
                updated += 1

            # Marquer comme in_progress si on a au moins des votes saisis
            if election.status == 'planned' and updated > 0:
                election.status = 'in_progress'
                election.save(update_fields=['status', 'updated_at'])

        return Response({
            'election_id': str(election.id),
            'election_status': election.status,
            'updated': updated,
            'errors': errors,
            'next_step': (
                "Pour officialiser les résultats, soumettez l'action "
                "'election.validate_results' (Tier 4, triple validation)."
            ) if updated > 0 else None,
        })


class VoteViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Vote.all_objects.all()
    serializer_class = VoteSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['election']


class AnnouncementViewSet(TenantViewMixin, viewsets.ModelViewSet):
    queryset = Announcement.all_objects.select_related('author__user').order_by(
        '-is_pinned', '-created_at',
    )
    serializer_class = AnnouncementSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['priority', 'audience', 'is_published', 'is_pinned']

    def get_queryset(self):
        qs = super().get_queryset()
        # Filtre auto : si non-staff, ne voir que les annonces publiées et non expirées
        now = timezone.now()
        active_only = self.request.query_params.get('active_only')
        if active_only and active_only.lower() in ('1', 'true', 'yes'):
            qs = qs.filter(is_published=True)
            qs = qs.exclude(starts_at__gt=now)
            qs = qs.exclude(ends_at__lt=now)
        return qs

    def perform_create(self, serializer):
        from apps.members.models import Membership
        membership = Membership.all_objects.filter(
            user=self.request.user, association=self.request.association, is_active=True,
        ).first()
        instance = serializer.save(
            association=self.request.association,
            author=membership,
        )
        # Notifie les membres si l'annonce est publiée immédiatement
        if instance.is_published and (not instance.starts_at or instance.starts_at <= timezone.now()):
            try:
                from apps.notifications.services import NotificationService
                NotificationService.notify_all_members(
                    association=self.request.association,
                    notification_type='announcement',
                    title=f"📢 {instance.title}",
                    body=(instance.content[:200] + '...') if len(instance.content) > 200 else instance.content,
                    data={
                        'announcement_id': str(instance.id),
                        'priority': instance.priority,
                    },
                    audience=instance.audience,
                )
            except Exception:
                pass

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        announcement = self.get_object()
        from apps.members.models import Membership
        membership = Membership.all_objects.filter(
            user=request.user, association=request.association, is_active=True,
        ).first()
        if not membership:
            return Response({'error': 'Membership requis'}, status=status.HTTP_403_FORBIDDEN)
        AnnouncementReadStatus.all_objects.get_or_create(
            announcement=announcement,
            membership=membership,
            defaults={'association': request.association},
        )
        return Response({'status': 'ok'})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        from apps.members.models import Membership
        membership = Membership.all_objects.filter(
            user=request.user, association=request.association, is_active=True,
        ).first()
        if not membership:
            return Response({'count': 0})

        total = self.get_queryset().filter(is_published=True).count()
        read = AnnouncementReadStatus.all_objects.filter(membership=membership).count()
        return Response({'count': max(0, total - read)})


# ─── Sondages (Polls) ────────────────────────────────────────────────


class PollViewSet(TenantViewMixin, viewsets.ModelViewSet):
    """Sondage électronique : vote radio (single) ou checklist (multi)."""
    queryset = Poll.all_objects.prefetch_related('options').select_related('created_by__user')
    serializer_class = PollSerializer
    permission_classes = [IsAuthenticated, HasAssociation, IsMember]
    filterset_fields = ['status', 'kind']
    ordering_fields = ['created_at', 'starts_at', 'ends_at']

    def _current_membership(self):
        from apps.members.models import Membership
        return Membership.all_objects.filter(
            user=self.request.user, association=self.request.association, is_active=True,
        ).first()

    def perform_create(self, serializer):
        membership = self._current_membership()
        serializer.save(
            association=self.request.association,
            created_by=membership,
        )

    @action(detail=True, methods=['post'])
    def open(self, request, pk=None):
        """Bascule status=draft → open + envoie une notification à tous les membres."""
        poll = self.get_object()
        if poll.status != Poll.Status.DRAFT:
            return Response({'error': "Seul un sondage en brouillon peut être ouvert."}, status=400)
        if not poll.options.exists():
            return Response({'error': "Ajoutez au moins une option avant d'ouvrir le sondage."}, status=400)
        poll.status = Poll.Status.OPEN
        if not poll.starts_at:
            poll.starts_at = timezone.now()
        poll.save(update_fields=['status', 'starts_at', 'updated_at'])

        # Notification à tous les membres
        try:
            from apps.notifications.services import NotificationService
            NotificationService.notify_all_members(
                association=request.association,
                notification_type='poll_open',
                title=f"📊 Nouveau sondage : {poll.title}",
                body=poll.question[:200],
                data={'poll_id': str(poll.id)},
            )
        except Exception:
            pass
        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def close(self, request, pk=None):
        """Clôture manuelle d'un sondage avant la date de fin."""
        poll = self.get_object()
        if poll.status != Poll.Status.OPEN:
            return Response({'error': "Seul un sondage ouvert peut être clôturé."}, status=400)
        poll.status = Poll.Status.CLOSED
        if not poll.ends_at:
            poll.ends_at = timezone.now()
        poll.save(update_fields=['status', 'ends_at', 'updated_at'])
        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def vote(self, request, pk=None):
        """
        Vote d'un membre actif sur un sondage ouvert.
        Body : { option_ids: ["uuid1", "uuid2", ...] }
        """
        from apps.governance.poll_service import cast_vote
        poll = self.get_object()
        membership = self._current_membership()
        if not membership:
            return Response({'error': 'Vous devez être membre actif pour voter.'}, status=403)
        option_ids = request.data.get('option_ids') or []
        if not isinstance(option_ids, list):
            return Response({'error': 'option_ids doit être une liste.'}, status=400)
        try:
            cast_vote(poll=poll, voter=membership, option_ids=[str(o) for o in option_ids])
        except ValueError as e:
            return Response({'error': str(e)}, status=400)
        # Recharge le poll pour avoir les compteurs à jour
        poll.refresh_from_db()
        return Response(PollSerializer(poll, context={'request': request}).data)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        """Résultats agrégés (cachés si results_visible_before_close=False
        et que le poll n'est pas encore clos)."""
        from apps.governance.poll_service import aggregate_results
        poll = self.get_object()
        return Response(aggregate_results(poll))
