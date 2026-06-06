from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0001_initial'),
        ('events', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='audience_mode',
            field=models.CharField(
                max_length=20, default='all',
                choices=[
                    ('all', 'Tous les membres actifs'),
                    ('specific', 'Membres sélectionnés uniquement'),
                ],
                help_text="ALL : tous les membres actifs · SPECIFIC : liste `invitees`.",
            ),
        ),
        migrations.AddField(
            model_name='event',
            name='invitees',
            field=models.ManyToManyField(
                blank=True, related_name='invited_events', to='members.membership',
                help_text="Membres invités si audience_mode='specific'. Ignoré si 'all'.",
            ),
        ),
    ]
