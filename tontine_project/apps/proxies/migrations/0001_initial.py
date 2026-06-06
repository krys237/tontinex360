import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0001_initial'),
        ('cycles', '0001_initial'),
        ('tontines', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Proxy',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('reason', models.TextField(blank=True)),
                ('signed_document', models.FileField(blank=True, null=True, upload_to='proxies/documents/')),
                ('signature_image', models.FileField(blank=True, null=True, upload_to='proxies/signatures/')),
                ('cni_image', models.FileField(blank=True, help_text='CNI du principal pour vérification.', null=True, upload_to='proxies/cni/')),
                ('status', models.CharField(choices=[
                    ('pending', 'En attente'),
                    ('approved', 'Approuvée'),
                    ('used', 'Utilisée'),
                    ('rejected', 'Rejetée'),
                    ('cancelled', 'Annulée'),
                    ('expired', 'Expirée'),
                ], db_index=True, default='pending', max_length=20)),
                ('requested_at', models.DateTimeField(auto_now_add=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('review_note', models.TextField(blank=True)),
                ('used_at', models.DateTimeField(blank=True, null=True)),
                ('association', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='proxy_set', to='core.association')),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='proxies_approved', to='members.membership')),
                ('principal', models.ForeignKey(help_text='Souscripteur titulaire qui délègue.', on_delete=django.db.models.deletion.CASCADE, related_name='proxies_given', to='members.membership')),
                ('proxy', models.ForeignKey(help_text='Membre désigné pour collecter physiquement.', on_delete=django.db.models.deletion.CASCADE, related_name='proxies_received', to='members.membership')),
                ('session', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='proxies', to='cycles.session')),
                ('tontine_type', models.ForeignKey(blank=True, help_text='Tontine spécifique. Null = vaut pour toutes les tontines de la séance.', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='proxies', to='tontines.tontinetype')),
                ('resulting_payout', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='originating_proxies', to='cycles.beneficiarypayout')),
            ],
            options={
                'db_table': 'proxies',
                'ordering': ['-requested_at'],
            },
        ),
        migrations.AddIndex(
            model_name='proxy',
            index=models.Index(fields=['association', 'status'], name='proxy_assoc_status_idx'),
        ),
        migrations.AddIndex(
            model_name='proxy',
            index=models.Index(fields=['session', 'status'], name='proxy_session_status_idx'),
        ),
        migrations.AddIndex(
            model_name='proxy',
            index=models.Index(fields=['principal', 'status'], name='proxy_principal_status_idx'),
        ),
        migrations.AddConstraint(
            model_name='proxy',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status__in', ['pending', 'approved'])),
                fields=('principal', 'session', 'tontine_type'),
                name='unique_active_proxy_per_session_tontine',
            ),
        ),
    ]
