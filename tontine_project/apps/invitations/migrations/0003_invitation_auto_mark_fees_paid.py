from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('invitations', '0002_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='invitation',
            name='auto_mark_fees_paid',
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Si True, les frais d'adhésion sont marqués comme 'paid' à "
                    "l'acceptation (cas où le président invite un membre déjà à jour)."
                ),
            ),
        ),
    ]
