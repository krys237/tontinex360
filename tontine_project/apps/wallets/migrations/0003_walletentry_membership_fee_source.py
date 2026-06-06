from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallets', '0002_rename_wallets_assoc_balance_idx_wallets_associa_9b7432_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='walletentry',
            name='source_type',
            field=models.CharField(
                max_length=30,
                choices=[
                    ('auction_premium', "Prime d'enchère"),
                    ('loan_interest', "Intérêt de prêt remboursé"),
                    ('sanction_payment', "Sanction payée"),
                    ('contribution_default', "Cotisation impayée"),
                    ('default_compensation', "Compensation collective de défaut"),
                    ('expense', "Dépense distribuée"),
                    ('manual_adjustment', "Ajustement manuel"),
                    ('membership_fee', "Frais d'adhésion (inscription/fond de membre)"),
                ],
            ),
        ),
    ]
