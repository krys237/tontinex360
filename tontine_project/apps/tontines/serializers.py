from rest_framework import serializers
from apps.tontines.models import TontineType, MemberSubscription


class TontineTypeSerializer(serializers.ModelSerializer):
    default_account_name = serializers.CharField(
        source='default_account.name', read_only=True, default=None,
    )
    contribution_kind_display = serializers.CharField(
        source='get_contribution_kind_display', read_only=True,
    )
    payout_pattern_display = serializers.CharField(
        source='get_payout_pattern_display', read_only=True,
    )
    default_acquisition_method_display = serializers.CharField(
        source='get_default_acquisition_method_display', read_only=True,
    )

    class Meta:
        model = TontineType
        fields = [
            'id', 'name', 'slug', 'description',
            'contribution_kind', 'contribution_kind_display',
            'in_kind_unit_label', 'in_kind_unit_value',
            'rate_mode', 'fixed_rate', 'min_rate', 'max_rate', 'currency',
            'allows_multiple_shares', 'max_shares_per_member', 'share_unit_name',
            'has_beneficiary',
            'payout_pattern', 'payout_pattern_display',
            'default_acquisition_method', 'default_acquisition_method_display',
            'is_active', 'display_order',
            'default_account', 'default_account_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'has_beneficiary', 'created_at', 'updated_at']

    def validate(self, attrs):
        mode = attrs.get('rate_mode', 'range')
        if mode == 'fixed' and not attrs.get('fixed_rate'):
            raise serializers.ValidationError({'fixed_rate': 'Requis pour le mode taux fixe.'})
        if mode == 'range':
            mn, mx = attrs.get('min_rate'), attrs.get('max_rate')
            if not mn or not mx:
                raise serializers.ValidationError('min_rate et max_rate requis pour le mode variable.')
            if mn > mx:
                raise serializers.ValidationError({'min_rate': 'Ne peut depasser le maximum.'})

        # Validation in_kind
        kind = attrs.get('contribution_kind', 'cash')
        if kind == 'in_kind':
            if not attrs.get('in_kind_unit_label'):
                raise serializers.ValidationError({
                    'in_kind_unit_label': "Requis pour une cotisation en nature (ex: 'Sac de riz 25kg').",
                })
            if not attrs.get('in_kind_unit_value'):
                raise serializers.ValidationError({
                    'in_kind_unit_value': "Valeur de référence requise pour les rapports financiers.",
                })

        # Pattern de restitution : la banque scolaire impose le mode libre
        pattern = attrs.get('payout_pattern', TontineType.PayoutPattern.ROTATING)
        if pattern == TontineType.PayoutPattern.INDIVIDUAL_SAVINGS:
            if mode != 'free':
                raise serializers.ValidationError({
                    'payout_pattern': (
                        "L'épargne individuelle (banque scolaire) nécessite "
                        "un mode de cotisation libre — chaque membre choisit "
                        "son montant à chaque séance."
                    ),
                })
        return attrs


class MemberSubscriptionSerializer(serializers.ModelSerializer):
    amount_per_session = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)
    member_name = serializers.CharField(source='membership.user.first_name', read_only=True)
    tontine_name = serializers.CharField(source='tontine_type.name', read_only=True)

    class Meta:
        model = MemberSubscription
        fields = [
            'id', 'membership', 'tontine_type', 'cycle',
            'num_shares', 'rate_per_share', 'amount_per_session',
            'is_active', 'member_name', 'tontine_name', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
