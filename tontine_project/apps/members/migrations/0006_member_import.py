from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0005_membership_signature_reference'),
    ]

    operations = [
        migrations.CreateModel(
            name='MemberImportBatch',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('filename', models.CharField(blank=True, max_length=255)),
                ('mode', models.CharField(
                    max_length=20, default='invite',
                    choices=[
                        ('direct', 'Ajout direct (memberships actifs immédiatement)'),
                        ('invite', 'Envoyer une invitation à chaque ligne'),
                    ],
                )),
                ('status', models.CharField(
                    max_length=20, default='previewed',
                    choices=[
                        ('previewed', 'Prévisualisé (non traité)'),
                        ('processing', 'En cours de traitement'),
                        ('completed', 'Traité'),
                        ('failed', 'Échec global'),
                    ],
                )),
                ('total_rows', models.PositiveIntegerField(default=0)),
                ('success_count', models.PositiveIntegerField(default=0)),
                ('error_count', models.PositiveIntegerField(default=0)),
                ('skipped_count', models.PositiveIntegerField(default=0)),
                ('processed_at', models.DateTimeField(blank=True, null=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('imported_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='import_batches', to='members.membership')),
            ],
            options={
                'db_table': 'member_import_batches',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['association', '-created_at'], name='mib_assoc_created_idx'),
                ],
            },
        ),
        migrations.CreateModel(
            name='MemberImportRow',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('row_number', models.PositiveIntegerField()),
                ('raw_data', models.JSONField(default=dict)),
                ('parsed_telephone', models.CharField(blank=True, max_length=20)),
                ('parsed_first_name', models.CharField(blank=True, max_length=100)),
                ('parsed_last_name', models.CharField(blank=True, max_length=100)),
                ('parsed_email', models.EmailField(blank=True, max_length=254)),
                ('parsed_member_number', models.CharField(blank=True, max_length=50)),
                ('status', models.CharField(
                    max_length=20, default='pending',
                    choices=[
                        ('pending', 'En attente'),
                        ('success', 'Succès'),
                        ('error', 'Erreur'),
                        ('skipped', 'Ignorée (déjà membre / doublon)'),
                    ],
                )),
                ('error_message', models.TextField(blank=True)),
                ('resulting_invitation_id', models.UUIDField(blank=True, null=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('batch', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rows', to='members.memberimportbatch')),
                ('resulting_membership', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='from_import_rows', to='members.membership')),
            ],
            options={
                'db_table': 'member_import_rows',
                'ordering': ['batch', 'row_number'],
                'indexes': [
                    models.Index(fields=['batch', 'status'], name='mir_batch_status_idx'),
                ],
            },
        ),
    ]
