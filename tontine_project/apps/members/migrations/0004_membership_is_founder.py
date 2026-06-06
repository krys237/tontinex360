from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('members', '0003_rename_memb_req_assoc_status_idx_membership__associa_c82e99_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='membership',
            name='is_founder',
            field=models.BooleanField(
                default=False,
                help_text="Vrai pour le fondateur de l'association (irrévocable, accès total).",
            ),
        ),
    ]
