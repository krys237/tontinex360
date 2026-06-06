import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_transaction_distribute_to_members'),
        ('tontines', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tontinetype',
            name='default_account',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='default_for_tontine_types',
                to='finance.treasuryaccount',
                help_text='Caisse physique par défaut pour les flux de cette cotisation.',
            ),
        ),
    ]
