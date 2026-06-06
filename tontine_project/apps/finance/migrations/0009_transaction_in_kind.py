from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0008_contribution_correction_request'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='in_kind_quantity',
            field=models.DecimalField(
                max_digits=14, decimal_places=2, null=True, blank=True,
                help_text="Quantité d'unités si transaction en nature (ex: 3 sacs). Null si cash.",
            ),
        ),
        migrations.AddField(
            model_name='transaction',
            name='in_kind_unit_label',
            field=models.CharField(
                max_length=100, blank=True,
                help_text="Libellé de l'unité (snapshot du TontineType au moment de la transaction).",
            ),
        ),
    ]
