from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cycles', '0007_cycle_recurrence_session_host'),
    ]

    operations = [
        migrations.AddField(
            model_name='beneficiarypayout',
            name='is_in_kind',
            field=models.BooleanField(
                default=False,
                help_text='Versement en nature (héritée du TontineType).',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='in_kind_quantity',
            field=models.DecimalField(
                max_digits=14, decimal_places=2, null=True, blank=True,
                help_text='Quantité versée en nature (ex: 10 sacs).',
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='in_kind_unit_label',
            field=models.CharField(
                max_length=100, blank=True,
                help_text="Snapshot du libellé d'unité au moment du versement.",
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='was_converted_to_cash',
            field=models.BooleanField(
                default=False,
                help_text='True si le versement initialement prévu en nature a été converti en argent.',
            ),
        ),
    ]
