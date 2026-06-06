from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0001_initial'),
        ('cycles', '0006_payout_receipt_fields'),
    ]

    operations = [
        # ── Cycle : pattern de récurrence ──────────────────────────────
        migrations.AddField(
            model_name='cycle',
            name='recurrence_kind',
            field=models.CharField(
                max_length=30, blank=True, default='none',
                choices=[
                    ('none', 'Aucun pattern'),
                    ('fixed_day_of_month', 'Jour fixe du mois (ex: le 15)'),
                    ('nth_weekday', 'Nième jour de semaine du mois (ex: 3ᵉ samedi)'),
                    ('every_weekday', 'Chaque semaine, un jour précis'),
                ],
                help_text='Type de pattern pour calculer les dates des séances.',
            ),
        ),
        migrations.AddField(
            model_name='cycle',
            name='recurrence_nth',
            field=models.PositiveSmallIntegerField(
                null=True, blank=True,
                help_text='Pour `nth_weekday` : 1=premier, 2=deuxième, ..., 5=dernier.',
            ),
        ),
        migrations.AddField(
            model_name='cycle',
            name='recurrence_weekday',
            field=models.PositiveSmallIntegerField(
                null=True, blank=True,
                help_text='Pour `nth_weekday` ou `every_weekday` : 0=lundi, ..., 6=dimanche.',
            ),
        ),
        migrations.AddField(
            model_name='cycle',
            name='recurrence_day_of_month',
            field=models.PositiveSmallIntegerField(
                null=True, blank=True,
                help_text='Pour `fixed_day_of_month` : 1-31.',
            ),
        ),
        migrations.AddField(
            model_name='cycle',
            name='sessions_generated_at',
            field=models.DateTimeField(
                null=True, blank=True,
                help_text='Horodatage de la dernière auto-génération de séances.',
            ),
        ),
        # ── Session : adresse personnalisée + hôte ────────────────────
        migrations.AlterField(
            model_name='session',
            name='location',
            field=models.CharField(
                max_length=255, blank=True,
                help_text='Adresse finale (vide = utiliser celle du cycle / siège social).',
            ),
        ),
        migrations.AddField(
            model_name='session',
            name='host_member',
            field=models.ForeignKey(
                null=True, blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='hosted_sessions',
                to='members.membership',
                help_text=(
                    'Membre qui héberge cette séance (typique pour les tontines '
                    'tour-de-rôle/random chez le bénéficiaire). Optionnel.'
                ),
            ),
        ),
    ]
