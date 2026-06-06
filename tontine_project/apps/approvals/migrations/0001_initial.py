from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='BureauApprovalRequest',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('action_type', models.CharField(help_text="Identifiant du handler. Ex: 'loan_repayment.correction'.", max_length=64)),
                ('target_model', models.CharField(help_text="App.Model du ciblé. Ex: 'finance.LoanRepayment'.", max_length=128)),
                ('target_id', models.UUIDField()),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('original_snapshot', models.JSONField(blank=True, default=dict)),
                ('reason', models.TextField()),
                ('summary', models.TextField(blank=True, help_text='Texte humain pour notifications/UI')),
                ('president_approval_at', models.DateTimeField(blank=True, null=True)),
                ('bureau_approval_at', models.DateTimeField(blank=True, null=True)),
                ('rejection_reason', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'En attente'),
                        ('pres_approved', 'Validé par le Président'),
                        ('bureau_approved', 'Validé par un membre du Bureau'),
                        ('approved', 'Approuvé et appliqué'),
                        ('rejected', 'Rejeté'),
                        ('cancelled', 'Annulé par le requérant'),
                        ('expired', 'Expiré (24h dépassées)'),
                        ('failed', "Échec de l'application"),
                    ],
                    default='pending', max_length=20,
                )),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField()),
                ('apply_error', models.TextField(blank=True)),
                ('side_effects', models.JSONField(blank=True, default=dict)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='approval_requests_made', to='members.membership')),
                ('president_approval', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approval_requests_approved_pres', to='members.membership')),
                ('bureau_approval', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approval_requests_approved_bureau', to='members.membership')),
                ('rejected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approval_requests_rejected', to='members.membership')),
            ],
            options={
                'db_table': 'bureau_approval_requests',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['association', 'status'], name='ba_assoc_status_idx'),
                    models.Index(fields=['association', 'action_type', 'status'], name='ba_assoc_action_idx'),
                    models.Index(fields=['target_model', 'target_id'], name='ba_target_idx'),
                ],
            },
        ),
    ]
