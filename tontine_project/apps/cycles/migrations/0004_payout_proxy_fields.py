import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cycles', '0003_initial'),
        ('members', '0001_initial'),
        ('proxies', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='beneficiarypayout',
            name='received_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='payouts_received_for_others',
                to='members.membership',
                help_text="Membre ayant physiquement reçu l'argent (différent du titulaire si procuration).",
            ),
        ),
        migrations.AddField(
            model_name='beneficiarypayout',
            name='proxy_record',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='payouts',
                to='proxies.proxy',
                help_text='Procuration utilisée pour cette remise (le cas échéant).',
            ),
        ),
    ]
