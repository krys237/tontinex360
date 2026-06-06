import uuid
from decimal import Decimal
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('core', '0001_initial'),
        ('cycles', '0001_initial'),
        ('members', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Wallet',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('balance', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('total_credits', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('total_debits', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('last_entry_at', models.DateTimeField(blank=True, null=True)),
                ('is_frozen', models.BooleanField(default=False, help_text='Gelé après démission, plus aucune écriture acceptée.')),
                ('association', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='wallet_set', to='core.association')),
                ('membership', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='wallet', to='members.membership')),
            ],
            options={
                'db_table': 'wallets',
            },
        ),
        migrations.AddIndex(
            model_name='wallet',
            index=models.Index(fields=['association', 'balance'], name='wallets_assoc_balance_idx'),
        ),
        migrations.CreateModel(
            name='WalletEntry',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('direction', models.CharField(choices=[('credit', 'Crédit (+)'), ('debit', 'Débit (−)')], max_length=10)),
                ('amount', models.DecimalField(decimal_places=2, help_text='Toujours positif. Le signe est porté par direction.', max_digits=14)),
                ('source_type', models.CharField(choices=[
                    ('auction_premium', "Prime d'enchère"),
                    ('loan_interest', 'Intérêt de prêt remboursé'),
                    ('sanction_payment', 'Sanction payée'),
                    ('contribution_default', 'Cotisation impayée'),
                    ('default_compensation', 'Compensation collective de défaut'),
                    ('expense', 'Dépense distribuée'),
                    ('manual_adjustment', 'Ajustement manuel'),
                ], max_length=30)),
                ('source_id', models.UUIDField(blank=True, null=True)),
                ('distribution_batch', models.UUIDField(blank=True, db_index=True, null=True)),
                ('total_distributed', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('members_count', models.PositiveIntegerField(default=1)),
                ('per_member_amount', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('balance_after', models.DecimalField(decimal_places=2, default=Decimal('0'), max_digits=14)),
                ('association', models.ForeignKey(db_index=True, on_delete=django.db.models.deletion.CASCADE, related_name='walletentry_set', to='core.association')),
                ('cycle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_entries', to='cycles.cycle')),
                ('session', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='wallet_entries', to='cycles.session')),
                ('wallet', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entries', to='wallets.wallet')),
            ],
            options={
                'db_table': 'wallet_entries',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='walletentry',
            index=models.Index(fields=['wallet', '-created_at'], name='wallet_entry_wal_recent_idx'),
        ),
        migrations.AddIndex(
            model_name='walletentry',
            index=models.Index(fields=['association', 'source_type', '-created_at'], name='wallet_entry_assoc_src_idx'),
        ),
        migrations.AddIndex(
            model_name='walletentry',
            index=models.Index(fields=['session', 'source_type'], name='wallet_entry_sess_src_idx'),
        ),
        migrations.AddIndex(
            model_name='walletentry',
            index=models.Index(fields=['distribution_batch'], name='wallet_entry_batch_idx'),
        ),
    ]
