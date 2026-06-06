from rest_framework import serializers
from apps.proxies.models import Proxy


class ProxyCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Proxy
        fields = [
            'proxy', 'session', 'tontine_type',
            'reason', 'signed_document', 'signature_image', 'cni_image',
        ]

    def validate(self, attrs):
        from apps.members.models import Membership
        from apps.cycles.models import Session
        from apps.tontines.models import MemberSubscription

        request = self.context.get('request')
        association = getattr(request, 'association', None)
        principal = self.context.get('principal')

        if not association or not principal:
            raise serializers.ValidationError("Contexte invalide.")

        proxy_membership = attrs.get('proxy')
        session = attrs.get('session')
        tontine_type = attrs.get('tontine_type')

        if proxy_membership.id == principal.id:
            raise serializers.ValidationError({'proxy': "Le procurataire doit être différent du principal."})

        if proxy_membership.association_id != association.id:
            raise serializers.ValidationError({'proxy': "Le procurataire doit appartenir à cette association."})

        if not Membership.all_objects.filter(
            id=proxy_membership.id, is_active=True, status=Membership.Status.ACTIVE,
        ).exists():
            raise serializers.ValidationError({'proxy': "Le procurataire doit être actif."})

        if session.association_id != association.id:
            raise serializers.ValidationError({'session': "Cette séance n'appartient pas à votre association."})

        if session.status not in (Session.Status.SCHEDULED, Session.Status.IN_PROGRESS):
            raise serializers.ValidationError({'session': "La séance doit être programmée ou en cours."})

        if tontine_type:
            if tontine_type.association_id != association.id:
                raise serializers.ValidationError({'tontine_type': "Cette tontine n'appartient pas à votre association."})
            sub = MemberSubscription.all_objects.filter(
                association=association, cycle=session.cycle,
                tontine_type=tontine_type, membership=principal,
            ).exists()
            if not sub:
                raise serializers.ValidationError({
                    'tontine_type': "Vous n'êtes pas souscripteur de cette tontine pour le cycle.",
                })
        else:
            has_any_sub = MemberSubscription.all_objects.filter(
                association=association, cycle=session.cycle, membership=principal,
            ).exists()
            if not has_any_sub:
                raise serializers.ValidationError(
                    "Vous n'avez aucune souscription active pour ce cycle."
                )

        cfg = (association.settings or {}).get('proxy', {})
        require_doc = cfg.get('require_document', False)
        if require_doc and not (
            attrs.get('signed_document') or attrs.get('signature_image')
        ):
            raise serializers.ValidationError(
                "Cette association exige un document signé ou une signature."
            )

        if Proxy.all_objects.filter(
            association=association,
            session=session,
            tontine_type=tontine_type,
            principal=principal,
            status__in=[Proxy.Status.PENDING, Proxy.Status.APPROVED],
        ).exists():
            raise serializers.ValidationError(
                "Vous avez déjà une procuration active pour cette séance / tontine."
            )

        return attrs


class ProxySerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    principal_name = serializers.SerializerMethodField()
    proxy_name = serializers.SerializerMethodField()
    session_number = serializers.IntegerField(source='session.session_number', read_only=True)
    session_date = serializers.DateField(source='session.date', read_only=True)
    tontine_name = serializers.CharField(source='tontine_type.name', read_only=True)

    class Meta:
        model = Proxy
        fields = [
            'id', 'principal', 'principal_name',
            'proxy', 'proxy_name',
            'session', 'session_number', 'session_date',
            'tontine_type', 'tontine_name',
            'reason', 'signed_document', 'signature_image', 'cni_image',
            'status', 'status_display',
            'requested_at', 'approved_by', 'approved_at', 'review_note',
            'used_at', 'resulting_payout',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'status_display',
            'requested_at', 'approved_by', 'approved_at', 'review_note',
            'used_at', 'resulting_payout',
            'created_at', 'updated_at',
            'principal_name', 'proxy_name', 'session_number', 'session_date', 'tontine_name',
        ]

    def get_principal_name(self, obj):
        u = obj.principal.user
        return f"{u.first_name} {u.last_name}"

    def get_proxy_name(self, obj):
        u = obj.proxy.user
        return f"{u.first_name} {u.last_name}"


class ProxyReviewSerializer(serializers.Serializer):
    review_note = serializers.CharField(required=False, allow_blank=True, default='')
