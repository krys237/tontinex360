from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tontines', '0003_tontine_in_kind'),
    ]

    operations = [
        migrations.AddField(
            model_name='tontinetype',
            name='payout_pattern',
            field=models.CharField(
                max_length=30,
                default='rotating',
                choices=[
                    ('rotating', 'Tontine rotative (1 bénéficiaire / séance)'),
                    ('individual_savings', 'Épargne individuelle (banque scolaire)'),
                    ('collective_savings', 'Caisse commune (trésorerie)'),
                ],
                help_text=(
                    'Comment les fonds collectés sont restitués : rotation (1 '
                    'bénéficiaire/séance), épargne individuelle (chacun récupère son '
                    'cumul en fin de cycle) ou caisse commune.'
                ),
            ),
        ),
        migrations.AddField(
            model_name='tontinetype',
            name='default_acquisition_method',
            field=models.CharField(
                max_length=20,
                default='random',
                choices=[
                    ('random', 'Tirage aléatoire'),
                    ('sequential', 'Tour de rôle'),
                    ('auction', 'Enchère (plus offrant)'),
                    ('vote', 'Vote des membres'),
                    ('need_based', 'Selon le besoin (décision bureau)'),
                    ('manual', 'Attribution manuelle'),
                ],
                help_text=(
                    "Méthode d'attribution du bénéficiaire utilisée par défaut quand "
                    "on crée un cycle pour cette tontine. Le bureau peut toujours "
                    "l'overrider au niveau du cycle ou de la séance."
                ),
            ),
        ),
        migrations.AlterField(
            model_name='tontinetype',
            name='has_beneficiary',
            field=models.BooleanField(
                default=True,
                help_text=(
                    'Conservé pour compatibilité. Dérivé de `payout_pattern` : '
                    'True si rotating, False sinon.'
                ),
            ),
        ),
    ]
