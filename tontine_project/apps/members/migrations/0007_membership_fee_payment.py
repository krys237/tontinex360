from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('cycles', '0001_initial'),
        ('members', '0006_member_import'),
    ]

    operations = [
        migrations.CreateModel(
            name='MembershipFeePayment',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('fee_type', models.CharField(
                    max_length=20,
                    choices=[
                        ('registration', 'Inscription (one-shot)'),
                        ('membership_fund', 'Fond de membre'),
                    ],
                )),
                ('expected_amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('paid_amount', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('status', models.CharField(
                    max_length=20, default='pending', db_index=True,
                    choices=[
                        ('pending', 'À payer'),
                        ('partial', 'Paiement partiel'),
                        ('paid', 'Payé'),
                        ('waived', 'Exonéré'),
                    ],
                )),
                ('first_payment_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(
                    blank=True, null=True,
                    help_text="Date du paiement final (ou de l'exonération).",
                )),
                ('waiver_reason', models.TextField(blank=True)),
                ('notes', models.TextField(blank=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('membership', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fee_payments', to='members.membership')),
                ('cycle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_payments', to='cycles.cycle')),
                ('waived_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_payments_waived', to='members.membership')),
            ],
            options={
                'db_table': 'membership_fee_payments',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['association', 'status'], name='mfp_assoc_status_idx'),
                    models.Index(fields=['membership', 'fee_type'], name='mfp_member_type_idx'),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name='membershipfeepayment',
            constraint=models.UniqueConstraint(
                condition=models.Q(('fee_type', 'registration')),
                fields=('membership', 'fee_type'),
                name='unique_registration_per_membership',
            ),
        ),
        migrations.AddConstraint(
            model_name='membershipfeepayment',
            constraint=models.UniqueConstraint(
                condition=models.Q(('fee_type', 'membership_fund'), ('cycle__isnull', True)),
                fields=('membership', 'fee_type'),
                name='unique_lifetime_fund_per_membership',
            ),
        ),
        migrations.AddConstraint(
            model_name='membershipfeepayment',
            constraint=models.UniqueConstraint(
                condition=models.Q(('fee_type', 'membership_fund'), ('cycle__isnull', False)),
                fields=('membership', 'fee_type', 'cycle'),
                name='unique_fund_per_cycle_per_membership',
            ),
        ),
        migrations.CreateModel(
            name='MembershipFeeInstallment',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('paid_at', models.DateTimeField()),
                ('payment_method', models.CharField(blank=True, max_length=50)),
                ('transaction_id', models.UUIDField(blank=True, null=True)),
                ('wallet_entry_id', models.UUIDField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('association', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='core.association')),
                ('payment', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='installments', to='members.membershipfeepayment')),
                ('recorded_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fee_installments_recorded', to='members.membership')),
            ],
            options={
                'db_table': 'membership_fee_installments',
                'ordering': ['paid_at'],
            },
        ),
    ]
