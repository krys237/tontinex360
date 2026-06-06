from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tontines', '0002_tontinetype_default_account'),
    ]

    operations = [
        migrations.AddField(
            model_name='tontinetype',
            name='contribution_kind',
            field=models.CharField(
                max_length=20, default='cash',
                choices=[('cash', 'En argent'), ('in_kind', 'En nature')],
                help_text='Argent ou bien en nature.',
            ),
        ),
        migrations.AddField(
            model_name='tontinetype',
            name='in_kind_unit_label',
            field=models.CharField(
                max_length=100, blank=True,
                help_text="Étiquette de l'unité (ex: 'Sac de riz 25kg'). Requis si contribution_kind='in_kind'.",
            ),
        ),
        migrations.AddField(
            model_name='tontinetype',
            name='in_kind_unit_value',
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True,
                help_text="Valeur XAF de référence d'une unité (pour rapports + seuils d'abonnement).",
            ),
        ),
    ]
