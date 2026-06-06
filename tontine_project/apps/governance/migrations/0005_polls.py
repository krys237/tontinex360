from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0001_initial'),
        ('governance', '0004_rename_announcemen_assoc_pub_idx_announcemen_associa_53ab91_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='Poll',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('question', models.TextField(help_text='Question posée aux membres.')),
                ('kind', models.CharField(
                    choices=[('single_choice', 'Un seul choix (radio)'),
                             ('multi_choice', 'Plusieurs choix (checklist)')],
                    default='single_choice', max_length=20,
                )),
                ('status', models.CharField(
                    choices=[('draft', 'Brouillon'), ('open', 'Ouvert au vote'),
                             ('closed', 'Clôturé'), ('cancelled', 'Annulé')],
                    default='draft', max_length=20,
                )),
                ('starts_at', models.DateTimeField(blank=True, null=True, help_text="Début de la période de vote (vide = ouvert dès status=open).")),
                ('ends_at', models.DateTimeField(blank=True, null=True, help_text="Fin de la période de vote (vide = ouvert jusqu'à clôture manuelle).")),
                ('is_anonymous', models.BooleanField(default=False, help_text="Si True, l'identité du votant n'est pas stockée (voter=NULL).")),
                ('allow_change_vote', models.BooleanField(default=False, help_text='Si True, le membre peut modifier son vote tant que le sondage est ouvert.')),
                ('max_choices', models.PositiveSmallIntegerField(blank=True, null=True, help_text="Pour kind=multi_choice : nombre max d'options sélectionnables (vide = pas de limite).")),
                ('results_visible_before_close', models.BooleanField(default=True, help_text="Si False, les résultats ne sont visibles qu'après clôture.")),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='polls_created', to='members.membership')),
            ],
            options={
                'db_table': 'polls',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['association', 'status', '-created_at'], name='poll_assoc_status_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='PollOption',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('label', models.CharField(max_length=255)),
                ('display_order', models.PositiveSmallIntegerField(default=0)),
                ('votes_count', models.PositiveIntegerField(default=0)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('poll', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='options', to='governance.poll')),
            ],
            options={
                'db_table': 'poll_options',
                'ordering': ['display_order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='PollVote',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('voter_fingerprint', models.CharField(blank=True, max_length=64, help_text='SHA-256(voter.id + poll.id) — utilisé en sondage anonyme pour éviter les doublons.')),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('option', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='votes_cast', to='governance.polloption')),
                ('poll', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='votes_cast', to='governance.poll')),
                ('voter', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='poll_votes_cast', to='members.membership')),
            ],
            options={
                'db_table': 'poll_votes',
                'indexes': [
                    models.Index(fields=['poll', 'voter'], name='pollvote_poll_voter_idx'),
                    models.Index(fields=['poll', 'voter_fingerprint'], name='pollvote_poll_fp_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='pollvote',
            constraint=models.UniqueConstraint(
                condition=models.Q(('voter__isnull', False)),
                fields=('poll', 'option', 'voter'),
                name='unique_vote_per_option_per_member',
            ),
        ),
    ]
