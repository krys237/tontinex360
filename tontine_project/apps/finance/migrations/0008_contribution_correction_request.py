from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('members', '0001_initial'),
        ('finance', '0007_receipts_contributions_repayments'),
    ]

    operations = [
        migrations.CreateModel(
            name='ContributionCorrectionRequest',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('original_paid_amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('new_paid_amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('original_status', models.CharField(max_length=20)),
                ('new_status', models.CharField(blank=True, max_length=20)),
                ('reason', models.TextField()),
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
                    ],
                    default='pending', max_length=20,
                )),
                ('applied_at', models.DateTimeField(blank=True, null=True)),
                ('expires_at', models.DateTimeField(help_text='24h après création')),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('contribution', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='correction_requests', to='finance.contribution')),
                ('requested_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='correction_requests_made', to='members.membership')),
                ('president_approval', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='correction_requests_approved_pres', to='members.membership')),
                ('bureau_approval', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='correction_requests_approved_bureau', to='members.membership')),
                ('rejected_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='correction_requests_rejected', to='members.membership')),
                ('reversal_transaction', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='correction_reversal_for', to='finance.transaction')),
                ('new_transaction', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='correction_replacement_for', to='finance.transaction')),
            ],
            options={
                'db_table': 'contribution_correction_requests',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['association', 'status'], name='ccr_assoc_status_idx'),
                    models.Index(fields=['contribution', 'status'], name='ccr_contrib_status_idx'),
                ],
            },
        ),
    ]
