from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0003_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='transaction',
            name='distribute_to_members',
            field=models.BooleanField(
                default=False,
                help_text=(
                    'Si True et type=expense : la dépense est répercutée sur '
                    'les wallets des membres souscripteurs du cycle.'
                ),
            ),
        ),
    ]
