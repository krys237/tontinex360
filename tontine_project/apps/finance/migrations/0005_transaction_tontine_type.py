import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0004_transaction_distribute_to_members'),
        ('tontines', '0002_tontinetype_default_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='tontine_type',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='transactions',
                to='tontines.tontinetype',
                help_text='Type de cotisation (fonds virtuel) auquel appartient cette transaction.',
            ),
        ),
        migrations.AddIndex(
            model_name='transaction',
            index=models.Index(
                fields=['association', 'tontine_type', 'created_at'],
                name='tx_assoc_tt_created_idx',
            ),
        ),
    ]
